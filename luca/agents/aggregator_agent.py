from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from memory.short_term import State
from model import llm as model

ROUTING_WORDS = {"analyst", "web", "both"}

AGGREGATOR_PROMPT = """You are a synthesis agent. Two specialized sub-agents have just completed their research:
- A financial analyst who read the user's personal bank and transaction data
- A web researcher who searched real-world prices and market data

Your job: combine their findings into a single, coherent, actionable answer.

## Rules
- Lead with the most useful cross-referenced insight (e.g. "you spent €X on Y; current market price is €Z")
- Be concise — no filler, no re-stating the question
- If one agent returned nothing useful, present the other's output cleanly without mentioning the gap
- Always cite sources when the web agent found prices
- No intro, no closing — just the synthesis

## When the question is about affording or planning a purchase / trip
Always end your response with a **Suggested savings goal** block in this exact format so a banking agent can act on it:

**Suggested savings goal:**
- Name: <short name>
- Category: <travel | electronics | emergency | event | investment>
- Target amount: €<price>
- Monthly contribution: €<amount> (fixed) — based on <X>% of monthly surplus
- Suggested deadline: <YYYY-MM-DD>
- Rule type: fixed_amount
"""



def _last_text(msgs: list) -> str:
    """Return the last plain-text AI response from a private channel."""
    for msg in reversed(msgs or []):
        if not isinstance(msg, AIMessage):
            continue
        if getattr(msg, "tool_calls", None):
            continue
        content = msg.content if isinstance(msg.content, str) else ""
        text = content.strip()
        if text:
            return text
    return ""


def aggregator_agent(state: State):
    original_question = next(
        (m.content for m in reversed(state["messages"]) if getattr(m, "type", None) == "human"),
        ""
    )
    analyst_turn_start = state.get("analyst_turn_start", 0)
    web_turn_start = state.get("web_turn_start", 0)
    analyst_output = _last_text((state.get("analyst_messages") or [])[analyst_turn_start:])
    web_output = _last_text((state.get("web_messages") or [])[web_turn_start:])

    context = f"User question: {original_question}\n\n"
    if analyst_output:
        context += f"Financial analyst findings:\n{analyst_output}\n\n"
    if web_output:
        context += f"Web research findings:\n{web_output}\n\n"

    today = "2026-06-01"
    system = SystemMessage(content=f"Today's date: {today}\n\n{AGGREGATOR_PROMPT}")
    response = model.invoke([system, HumanMessage(content=context)])
    return {"messages": [response]}
