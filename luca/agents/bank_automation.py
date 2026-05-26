import json
import datetime
from langchain_core.messages import SystemMessage, AIMessage
from langchain_core.tools import tool
from langchain_anthropic import ChatAnthropic
from langgraph.store.base import BaseStore
from langgraph.types import interrupt
from tools.database_tools import READING_TOOLS, WRITING_TOOLS
from memory.short_term import State, namespace
import db_tools as db


BANKING_AGENT_PROMPT = """You are a banking automation agent for a personal finance system.
You help users execute banking actions: transfers, creating savings goals, and requesting loans.

## CRITICAL — you cannot execute anything directly
You have NO write tools. The ONLY way to execute an action is to call propose_action.
If you have all required information → call propose_action. That is the ONLY valid next step.

## Capabilities
- Transfer money to a contact or external IBAN: make_transaction
- Create a new savings goal: create_goal
- Update a savings goal: update_goal
- Delete a savings goal: delete_goal
- Submit a loan request: create_loan_request
- Card management is read-only (block/unblock handled separately)

## Your workflow
1. GATHER — use reading tools to look up any required IDs (contacts, cards, goals)
2. CLARIFY — ask the user for any missing required field before proceeding
3. CONFIRM — call propose_action with all arguments. This is the ONLY step that triggers execution.

## Required fields per action
- make_transaction: amount (signed float, negative = expense), counterpart_name, counterpart_account_or_iban, note (optional)
- create_goal: name, description, category (travel|electronics|emergency|event|investment), amount_goal, rule_value, rule_type (fixed_amount|percentage), deadline (YYYY-MM-DD)
- update_goal: goal_id (required), plus any fields to change: name, description, amount_goal, deadline, status, rule_value
- delete_goal: goal_id (required) — always look it up with get_goals first
- create_loan_request: total_amount, interest_rate, monthly_amount, description, date_starting, date_ending

## Extracting parameters from conversation context
If the conversation already contains a **Suggested savings goal** block (output by the planning agent),
extract all parameters directly from it — do NOT ask the user again.
The block looks like:
  Name / Category / Target amount / Monthly contribution / Suggested deadline / Rule type

Use those values verbatim to populate create_goal arguments, then call propose_action immediately.

## Rules
- Never guess IDs or IBANs — always look them up with reading tools first
- Only ask for missing fields that are NOT already present in the conversation
- Call propose_action ONLY ONCE as your last step — never mix it with other tool calls
- Write a clear, specific confirmation_message (e.g. "Send €50 to Marco Rossi (IBAN: IT123...) with note 'dinner'")
"""

model = ChatAnthropic(model="claude-haiku-4-5-20251001")


@tool
def propose_action(tool_name: str, tool_args: str, confirmation_message: str) -> str:
    """Call this as your FINAL step when you have ALL required information.
    This triggers a human confirmation before anything is executed.
    tool_name: the write tool to call after confirmation (make_transaction | create_goal | update_goal | delete_goal | create_loan_request)
    tool_args: JSON string with all arguments for that tool
    confirmation_message: clear, specific description of what will happen (shown to the user)"""
    return f"[{tool_name}] {confirmation_message} | args: {tool_args}"


BANKING_TOOLS = READING_TOOLS + [propose_action]
llm = model.bind_tools(BANKING_TOOLS, parallel_tool_calls=False)


_ROUTING_WORDS = {"analyst", "web", "both", "banking"}


def banking_agent(state: State, store: BaseStore):
    # Full conversation history: human messages + clean AI replies across all turns
    # This lets the agent remember info the user gave in previous messages (e.g. an IBAN)
    conversation = []
    for m in state["messages"]:
        msg_type = getattr(m, "type", None)
        if msg_type == "human":
            conversation.append(m)
        elif msg_type == "ai":
            content = m.content if isinstance(m.content, str) else ""
            if content.strip().lower() not in _ROUTING_WORDS and not getattr(m, "tool_calls", None):
                conversation.append(m)

    # Current-turn tool loop messages (read tool calls + results within this invocation)
    turn_start = state.get("banking_turn_start", 0)
    current_turn_msgs = (state.get("banking_messages") or [])[turn_start:]

    context = conversation + current_turn_msgs
    today = datetime.date.today().isoformat()
    system = SystemMessage(content=f"Today's date: {today}\n\n{BANKING_AGENT_PROMPT}")
    response = llm.invoke([system] + context)

    # Intercept propose_action to store pending_action in state
    pending = None
    if hasattr(response, "tool_calls"):
        for tc in response.tool_calls:
            if tc.get("name") == "propose_action":
                raw_args = tc["args"].get("tool_args", "{}")
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except Exception:
                    args = {}
                pending = {
                    "tool": tc["args"].get("tool_name"),
                    "args": args,
                    "message": tc["args"].get("confirmation_message", ""),
                }

    result = {"banking_messages": [response]}
    if pending is not None:
        result["pending_action"] = pending
    # Surface plain-text replies (clarifications, questions) to the shared channel so the CLI shows them
    if not getattr(response, "tool_calls", None):
        result["messages"] = [response]
    return result


def banking_confirm(state: State):
    pending = state.get("pending_action", {})
    msg = pending.get("message", "Unknown action")
    user_response = interrupt(
        f"Action pending — please confirm:\n\n{msg}\n\nType 'yes' to confirm or 'no' to cancel."
    )
    confirmed = user_response.strip().lower() in ("yes", "y", "confirm", "ok")
    return {"confirmed": confirmed}


def banking_execute(state: State, store: BaseStore):
    pending = state.get("pending_action", {})
    tool_name = pending.get("tool")
    tool_args = pending.get("args", {})

    tool_map = {t.name: t for t in WRITING_TOOLS}
    t = tool_map.get(tool_name)

    if not t:
        msg = f"Error: unknown action '{tool_name}'. No changes were made."
    else:
        try:
            result = t.invoke(tool_args)
            msg = f"Done. {result}"
            # Refresh the profile in long-term store so the updated balance is visible to all agents
            store.put(namespace, "info", db.get_profile())
        except Exception as e:
            msg = f"Failed to execute '{tool_name}': {e}"

    return {"messages": [AIMessage(content=msg)], "pending_action": None}


def banking_cancelled(_state: State):
    return {"messages": [AIMessage(content="Action cancelled. Nothing was changed.")]}
