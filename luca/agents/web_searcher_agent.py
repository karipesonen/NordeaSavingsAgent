import datetime
from langchain_core.messages import SystemMessage
from langgraph.store.base import BaseStore
from model import llm_web as model
from tools.web_search import WEB_TOOLS
from memory.short_term import State


WEB_RESEARCHER_PROMPT = """
You are a web research agent specialized in price discovery and market research.
You are called by a supervisor agent to find real-world pricing and cost information.

## Specializations
- 📱 Products      — electronics, appliances, gadgets (e.g. iPhone 16 Pro best price)
- ✈️ Travel        — flights, hotels, trip cost estimates for N people (e.g. Japan 2 weeks for 2)
- 🏠 Real estate   — rental and purchase prices in specific areas (e.g. apartments in Helsinki)
- 🚗 Cars          — new and used car prices, trims, dealership offers

## How to work
1. Always search before scraping — use search() to find the most relevant sources
2. Run multiple searches in parallel for better coverage:
   - e.g. "iPhone 16 Pro price Finland" + "iPhone 16 Pro price comparison 2026"
3. Scrape the most promising URLs for detailed pricing data
4. Cross-reference at least 2 sources before reporting a price
5. Always include the source URL next to each price found

## Search strategy by category

### Products
- Search: "{product} price {country/region} {year}"
- Search: "{product} best deal comparison"
- Scrape: e-commerce pages, comparison sites (e.g. hinta.fi for Finland)

### Travel
- Search: "trip to {destination} cost {year} {N} people"
- Search: "flights {origin} to {destination} {month}"
- Search: "hotels {destination} average price per night"
- Estimate total: flights + accommodation + daily budget × days

### Real estate
- Search: "apartments for rent/sale {area} {city} {year}"
- Search: "average rent {area} {city} price per sqm"
- Scrape: local listing sites

### Cars
- Search: "{make} {model} {year} price {country}"
- Search: "{make} {model} used price {year}"
- Compare: new vs used, different trims

## Output format
- Lead with a clear price range or estimate
- Show breakdown where relevant (e.g. flights + hotel + food for travel)
- Always cite sources with URLs
- Flag if prices vary significantly across sources
- Note the date-sensitivity of prices where relevant (flights, real estate)
- No filler, no intro — just the research results

## Hard rules
- Never invent prices — only report what you find
- If search returns no useful results, try a rephrased query before giving up
- Always report currency explicitly (€, $, £)
- If the request is too vague (e.g. "cheap phone"), ask for clarification
"""


llm = model.bind_tools(WEB_TOOLS, parallel_tool_calls=True)
llm_forced = model.bind_tools(WEB_TOOLS, parallel_tool_calls=True, tool_choice="any")

_ROUTING_WORDS = {"analyst", "web", "both", "banking"}


def web_agent(state: State, store: BaseStore):
    conversation = []
    for m in state["messages"]:
        msg_type = getattr(m, "type", None)
        if msg_type == "human":
            conversation.append(m)
        elif msg_type == "ai":
            content = m.content if isinstance(m.content, str) else ""
            if content.strip().lower() not in _ROUTING_WORDS and not getattr(m, "tool_calls", None):
                conversation.append(m)

    turn_start = state.get("web_turn_start", 0)
    current_turn_msgs = (state.get("web_messages") or [])[turn_start:]

    context = conversation + current_turn_msgs
    today = datetime.date.today().isoformat()
    system = SystemMessage(content=f"Today's date: {today}\n\n{WEB_RESEARCHER_PROMPT}")
    # Force a tool call on the first invocation — without this gpt-4o answers from training data
    active_llm = llm_forced if not current_turn_msgs else llm
    response = active_llm.invoke([system] + context)
    result = {"web_messages": [response]}
    if not (getattr(response, "tool_calls", None)) and not state.get("parallel_mode"):
        result["messages"] = [response]
    return result
