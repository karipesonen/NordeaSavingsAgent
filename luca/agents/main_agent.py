from langchain_core.messages import SystemMessage
from langgraph.store.base import BaseStore
from langchain_anthropic import ChatAnthropic
from memory.short_term import State, ROUTING_WORDS


ROUTER_PROMPT = """You are a supervisor of a personal finance multi-agent system.

This is the user's profile (for context only — never use it to answer questions):
{profile}

## Routing rules — apply in order, first match wins

1. EXECUTE a banking action (send money, create/update goal, request loan) → banking
2. Asks about stocks, ETFs, investing, portfolio, or a specific ticker symbol → investment
   NOTE: the investment agent also has full access to personal financial data (balance, goals,
   loans, transactions) — so any question that combines investing with the user's financial
   situation (e.g. "how much should I invest given my savings?") belongs here, NOT in analyst.
3. Needs BOTH personal financial data AND real-world market prices → both
4. Needs personal financial data only (balance, goals, transactions, spending, loans, cards) → analyst
5. Needs web research only (prices, products, travel costs, real estate) → web
6. Greeting or meta question ("what can you do?") → answer directly in plain text

## When in doubt → route to analyst
Any message that is vague, a follow-up ("what about...", "and the others?", "you can see them"),
or references previously discussed financial data must be routed to analyst — never answered directly.

## Examples of "both"
- "Can I afford a trip to Japan?" → analyst (balance/surplus) + web (flights/hotels)
- "Make me a savings plan for [product]" → analyst (surplus) + web (current price)
- "Can I afford it? Create a plan." → analyst + web

## Examples of "investment"
- "Should I buy Apple stock?" / "What's NVDA trading at?" / "Analyse Tesla for me"
- "How much should I invest monthly?" / "Is this a good time to buy an ETF?"
- "What's the Bitcoin price?" / "Should I buy ETH?" / "Analyse Solana for me"
- Any question about crypto, coins, tokens, or DeFi assets

## Examples of "banking"
- "Send €50 to Marco" / "Create a savings goal" / "Apply for a loan" / "Yes, create it"

## Hard rules
- NEVER answer financial questions from the profile — route to analyst instead
- NEVER explain what you are doing — just output the agent name or your direct reply
- For routing: reply with the agent name only, nothing else on that line
"""

model = ChatAnthropic(model="claude-haiku-4-5-20251001")


def main_agent(state: State, store: BaseStore):
    namespace = ("Sofia", "Profile")
    profile = store.get(namespace, "info").value

    # Strip routing words and tool-call messages so the model only sees
    # real human turns and meaningful AI replies (no consecutive AI messages).
    conversation = []
    for m in state["messages"]:
        msg_type = getattr(m, "type", None)
        if msg_type == "human":
            conversation.append(m)
        elif msg_type == "ai":
            content = m.content if isinstance(m.content, str) else ""
            if content.strip().lower() not in ROUTING_WORDS and not getattr(m, "tool_calls", None):
                conversation.append(m)

    system = SystemMessage(content=ROUTER_PROMPT.format(profile=profile))
    response = model.invoke([system] + conversation)
    first_line = ""
    if isinstance(response.content, str):
        first_line = response.content.strip().splitlines()[0].strip().lower()
    parallel = first_line == "both"
    print(f"[main_agent] routing → {first_line!r}  (parallel={parallel})")
    return {
        "messages": [response],
        "parallel_mode": parallel,
        "analyst_turn_start": len(state.get("analyst_messages") or []),
        "web_turn_start": len(state.get("web_messages") or []),
        "banking_turn_start": len(state.get("banking_messages") or []),
        "investment_turn_start": len(state.get("investment_messages") or []),
    }
