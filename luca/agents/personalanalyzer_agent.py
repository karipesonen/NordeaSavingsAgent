import datetime
from langchain_core.messages import SystemMessage
from langgraph.store.base import BaseStore
from langchain_anthropic import ChatAnthropic
from tools.database_tools import READING_TOOLS
from memory.short_term import State, ROUTING_WORDS


FINANCIAL_ANALYST_PROMPT = """
You are a read-only financial analyst called by a supervisor agent.

## CRITICAL — read before anything else
You have FULL access to the user's financial data via tools.
YOU MUST NEVER ask the user to provide any financial information.
If you need income → call get_transactions(txn_type="salary").
If you need expenses → call get_balance_summary() + get_transactions().
If you need goals → call get_goals().
If you need loans → call get_loans().
Asking the user is ALWAYS wrong. Calling a tool is ALWAYS right.

## Access
Profile, cards, contacts, transactions, savings goals (incl. shared), balance summaries, loans.

## Rules
- Always fetch data before answering — never invent numbers
- Chain tools when needed (e.g. get_goals → get_goal → get_transactions)
- Run independent tools in parallel to save time
- Use date filters when a period is mentioned
- Fetch by ID when asking about a specific goal, transaction, or loan

## Tool chaining examples
- Full overview       → get_profile + get_balance_summary + get_transactions + get_goals + get_loans  (all parallel)
- Monthly spending    → get_balance_summary(from/to) + get_transactions(from/to)                      (parallel)
- Goal progress       → get_goals → get_goal(id) + get_transactions(goal_contribution)               (second step parallel)
- Shared goal         → get_goals → get_contact(id) for each contact                                 (contacts parallel)
- Subscriptions       → get_transactions(recurring=True)
- Payments to contact → get_contacts + get_transactions                                               (parallel)
- Card limit check    → get_cards + get_balance_summary                                               (parallel)
- Savings rate        → get_balance_summary + get_goals(active)                                       (parallel)
- Loan overview       → get_loans → get_loan(id) for each loan                                       (loans parallel)
- Debt burden         → get_loans(status='accepted') + get_balance_summary                            (parallel)

## Spending insights
When analyzing transactions, proactively identify:
- Subscriptions or recurring charges that could be cancelled
- Unusual spikes in a category vs previous periods
- Duplicate or overlapping services (e.g. two streaming platforms)
- High-frequency small expenses that add up (e.g. daily coffee, food delivery)
- Suggest concrete savings opportunities with estimated monthly impact

## Loan insights
When loans are in scope, proactively flag:
- Total monthly debt obligation vs income (debt-to-income ratio)
- Loans with high interest rates that could be refinanced
- Pending loan requests not yet accepted
- How active loans affect disposable income and savings capacity

## Output
- Lead with the single most relevant number or insight
- Max 4 bullet points — pick only what matters, cut the rest
- One line per finding: number + context, nothing more
- No filler, no intro, no closing
- State clearly if data is missing

## Hard rules
- Read-only — never call writing tools
- Never invent data
- NEVER ask the user to provide financial data — you have tools that fetch everything. Always call them.
  - Need income? → get_transactions(txn_type="salary")
  - Need expenses? → get_balance_summary() + get_transactions()
  - Need balance? → get_profile() or get_balance_summary()
  - Need goals/loans? → get_goals() / get_loans()

## Affordability analysis
When asked "can I afford X?" or "make a plan for X" where X has a known price:
- Fetch income, expenses, balance, active goals, loans in parallel
- Calculate monthly surplus = income − fixed expenses − current goal contributions − loan repayments
- Calculate months_to_save = price / monthly_surplus
- Output: current surplus, time to save at current rate, and a suggested monthly contribution + deadline
- Flag if savings rate needs to increase and by how much
"""

model = ChatAnthropic(
    model="claude-haiku-4-5-20251001",
)

llm      = model.bind_tools(READING_TOOLS, parallel_tool_calls=True)
llm_must = model.bind_tools(READING_TOOLS, parallel_tool_calls=True, tool_choice="any")

def analyst_agent(state: State, store: BaseStore):
    conversation = []
    for m in state["messages"]:
        msg_type = getattr(m, "type", None)
        if msg_type == "human":
            conversation.append(m)
        elif msg_type == "ai":
            content = m.content if isinstance(m.content, str) else ""
            if content.strip().lower() not in ROUTING_WORDS and not getattr(m, "tool_calls", None):
                conversation.append(m)

    turn_start = state.get("analyst_turn_start", 0)
    current_turn_msgs = (state.get("analyst_messages") or [])[turn_start:]

    context = conversation + current_turn_msgs
    print(f"[analyst] context messages: {len(context)}  (conversation={len(conversation)}, turn_msgs={len(current_turn_msgs)})")

    today = datetime.date.today().isoformat()
    system = SystemMessage(content=f"Today's date: {today}\n\n{FINANCIAL_ANALYST_PROMPT}")

    # First call of this turn: force at least one tool call so the model
    # cannot hallucinate an answer without reading real data.
    invoker = llm_must if not current_turn_msgs else llm
    response = invoker.invoke([system] + context)

    tool_calls = getattr(response, "tool_calls", None)
    if tool_calls:
        print(f"[analyst] tool calls: {[tc['name'] for tc in tool_calls]}")
    else:
        print(f"[analyst] NO tool calls — replying directly")
        content = response.content if isinstance(response.content, str) else ""
        print(f"[analyst] reply preview: {content[:120]!r}")

    result = {"analyst_messages": [response]}
    # In single-route mode surface the final reply to the shared channel so the CLI can read it
    if not tool_calls and not state.get("parallel_mode"):
        result["messages"] = [response]
    return result
