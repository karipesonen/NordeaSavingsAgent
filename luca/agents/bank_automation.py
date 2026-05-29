import datetime
from langchain_core.messages import SystemMessage, ToolMessage
from langchain_anthropic import ChatAnthropic
from langgraph.store.base import BaseStore
from langgraph.types import interrupt
from tools.database_tools import READING_TOOLS, WRITING_TOOLS
from memory.short_term import State, namespace, ROUTING_WORDS
import db_tools as db


BANKING_AGENT_PROMPT = """You are a banking automation agent for a personal finance system.
You help users execute banking actions: transfers, savings goals, loan requests, and card management.

## Tools available
Reading (free to call anytime): get_profile, get_contacts, get_cards, get_goals,
  get_transactions, get_balance_summary, get_loans, and their single-item variants.
Writing: make_transaction, create_goal, update_goal, delete_goal,
  create_loan_request, update_card

## CRITICAL: call write tools immediately — never ask conversationally for confirmation
The system automatically pauses for user confirmation before any write executes.
You must NOT replicate that step by saying "Should I proceed?", "Shall I send?",
"Can I confirm?" or anything similar. The moment you have all required fields,
call the write tool in that same response — no exceptions.

If the user's reply is "yes" / "go ahead" / "do it" without you having called a write tool:
they are responding to something you said conversationally. Treat their message as
confirmation of intent and call the write tool immediately using the details already in
the conversation.

## Workflow
1. GATHER — call reading tools to resolve IDs and IBANs. Never guess them.
2. CLARIFY — ask only for fields that are genuinely missing from the conversation.
3. EXECUTE — call the write tool the moment every required field is known.

## Required fields per write action
- make_transaction : amount (signed float, negative = outgoing), counterpart_name,
    counterpart_account_or_iban, note (optional)
- create_goal      : name, description, category (travel|electronics|emergency|event|investment),
    amount_goal, rule_value, rule_type (fixed_amount|percentage), deadline (YYYY-MM-DD)
- update_goal      : goal_id, plus any fields to change
- delete_goal      : goal_id — always look it up with get_goals first
- create_loan_request : total_amount, interest_rate, monthly_amount, description,
    date_starting, date_ending
- update_card      : card_id, status ('blocked'|'active'), and optional limit/contactless fields

## IBAN lookup rule
For contacts in your saved list: call get_contacts and copy linked_iban exactly.
For recipients NOT in contacts: if the user has provided an IBAN in the conversation,
use it directly. Do not invent or modify IBANs.

## Suggested savings goal blocks
If the conversation contains a **Suggested savings goal** block from the planning agent,
extract all parameters from it and call create_goal immediately — do not ask again.
"""

model = ChatAnthropic(model="claude-sonnet-4-6")

ALL_BANKING_TOOLS = READING_TOOLS + WRITING_TOOLS
llm = model.bind_tools(ALL_BANKING_TOOLS, parallel_tool_calls=False)

WRITE_TOOL_NAMES = {t.name for t in WRITING_TOOLS}
_WRITE_TOOL_MAP = {t.name: t for t in WRITING_TOOLS}


def banking_agent(state: State, store: BaseStore):
    conversation = []
    for m in state["messages"]:
        msg_type = getattr(m, "type", None)
        if msg_type == "human":
            conversation.append(m)
        elif msg_type == "ai":
            content = m.content if isinstance(m.content, str) else ""
            if content.strip().lower() not in ROUTING_WORDS and not getattr(m, "tool_calls", None):
                conversation.append(m)

    turn_start = state.get("banking_turn_start", 0)
    current_turn_msgs = (state.get("banking_messages") or [])[turn_start:]

    today = datetime.date.today().isoformat()
    system = SystemMessage(content=f"Today's date: {today}\n\n{BANKING_AGENT_PROMPT}")
    response = llm.invoke([system] + conversation + current_turn_msgs)

    result = {"banking_messages": [response]}
    if not getattr(response, "tool_calls", None):
        result["messages"] = [response]
    return result


def _format_confirmation(tool_name: str, tool_args: dict) -> str:
    if tool_name == "make_transaction":
        amount = float(tool_args.get("amount", 0))
        name = tool_args.get("counterpart_name", "?")
        iban = tool_args.get("counterpart_account_or_iban", "")
        note = tool_args.get("note", "")
        verb = "Send" if amount < 0 else "Receive"
        prep = "to" if amount < 0 else "from"
        line = f"{verb} €{abs(amount):.2f} {prep} {name}"
        if iban:
            line += f"  (IBAN: {iban})"
        if note:
            line += f"\nNote: {note}"
        return line
    if tool_name == "create_goal":
        return (
            f"Create savings goal '{tool_args.get('name', '?')}'\n"
            f"Target: €{tool_args.get('amount_goal', '?')}   "
            f"Deadline: {tool_args.get('deadline', '?')}"
        )
    if tool_name == "update_goal":
        return f"Update goal {tool_args.get('goal_id', '?')}: {tool_args}"
    if tool_name == "delete_goal":
        return f"Permanently delete goal {tool_args.get('goal_id', '?')}"
    if tool_name == "update_card":
        card = tool_args.get("card_id", "?")
        status = tool_args.get("status", "")
        return f"Update card {card}" + (f" → {status}" if status else f": {tool_args}")
    if tool_name == "create_loan_request":
        return (
            f"Submit loan request: €{tool_args.get('total_amount', '?')} "
            f"at {tool_args.get('interest_rate', '?')}% interest\n"
            f"{tool_args.get('description', '')}"
        )
    return f"{tool_name}({tool_args})"


def banking_write_confirm(state: State, store: BaseStore):
    msgs = state.get("banking_messages") or []
    last = msgs[-1]
    tc = last.tool_calls[0]          # parallel_tool_calls=False guarantees one at a time
    tool_name = tc["name"]
    tool_args = tc["args"]

    confirmation = _format_confirmation(tool_name, tool_args)

    # Flag IBANs not in contacts so the user can spot a hallucinated address,
    # but still let them confirm — they may have provided it explicitly.
    if tool_name == "make_transaction":
        iban = tool_args.get("counterpart_account_or_iban", "")
        if iban:
            known_ibans = {c["linked_iban"] for c in db.get_contacts()}
            if iban not in known_ibans:
                confirmation += "\n[!] This IBAN is not in your saved contacts — verify before confirming."

    user_response = interrupt(
        f"Action pending — please confirm:\n\n"
        f"{confirmation}\n\n"
        "Type 'yes' to confirm or 'no' to cancel."
    )

    if user_response.strip().lower() in ("yes", "y", "confirm", "ok"):
        try:
            result = _WRITE_TOOL_MAP[tool_name].invoke(tool_args)
            store.put(namespace, "info", db.get_profile())
            content = str(result)
        except Exception as e:
            content = f"Error: {e}"
    else:
        content = "Cancelled by user."

    return {
        "banking_messages": [ToolMessage(content=content, tool_call_id=tc["id"])]
    }
