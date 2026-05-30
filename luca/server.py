"""
Luca web research microservice.

Run:  uv run uvicorn server:app --port 8001 --reload

POST /research  →  structured trip/product price research via Firecrawl
GET  /health    →  liveness check
"""

import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import START, END, StateGraph
from langgraph.prebuilt import ToolNode
from typing import Annotated
from typing_extensions import TypedDict, NotRequired
from langgraph.graph.message import add_messages

from model import llm_web, llm
from tools.web_search import WEB_TOOLS
from agents.web_searcher_agent import WEB_RESEARCHER_PROMPT

MAX_SYNTH_INPUT_CHARS = 14000

def _cap_synthesis_input(text: str, max_chars: int = MAX_SYNTH_INPUT_CHARS) -> str:
    text = text or ""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n[research output truncated before synthesis]"

# ── Pydantic models for request / response ──────────────────────────────────

class ResearchRequest(BaseModel):
    destination: str = Field(..., description="Where to travel, e.g. 'Japan'")
    duration_days: int = Field(10, description="Trip length in days")
    travelers: int = Field(1, description="Number of travelers")
    month: str = Field("", description="Preferred month, e.g. 'August'")
    origin: str = Field("Helsinki", description="Departure city")

class BreakdownItem(BaseModel):
    category: str
    amount_eur: int
    note: str = ""

class Source(BaseModel):
    url: str
    title: str = ""

class ResearchResponse(BaseModel):
    destination: str
    duration_days: int
    travelers: int
    total_eur: int = 0
    breakdown: list[BreakdownItem] = []
    sources: list[Source] = []
    summary: str = ""
    error: str | None = None

# ── Price research models ─────────────────────────────────────────────────────

class PriceResearchRequest(BaseModel):
    item: str = Field(..., description="What to research, e.g. 'MacBook Air M4', '2-bedroom apartment in Kallio'")
    category: str = Field("product", description="product | real_estate | car")
    region: str = Field("Finland", description="Where to search prices")

class PriceResearchResponse(BaseModel):
    item: str
    category: str
    price_low_eur: int = 0
    price_high_eur: int = 0
    typical_eur: int = 0
    breakdown: list[BreakdownItem] = []
    sources: list[Source] = []
    summary: str = ""
    error: str | None = None

# ── Minimal web-only LangGraph graph ────────────────────────────────────────

class WebState(TypedDict):
    messages: Annotated[list, add_messages]
    web_messages: NotRequired[Annotated[list, add_messages]]

_llm = llm_web.bind_tools(WEB_TOOLS, parallel_tool_calls=True)
_llm_forced = llm_web.bind_tools(WEB_TOOLS, parallel_tool_calls=True, tool_choice="any")

def _web_node(state: WebState):
    current = state.get("web_messages") or []
    context = [m for m in state["messages"] if getattr(m, "type", None) == "human"] + current
    today = datetime.date.today().isoformat()
    system = SystemMessage(content=f"Today's date: {today}\n\n{WEB_RESEARCHER_PROMPT}")
    active = _llm_forced if not current else _llm
    response = active.invoke([system] + context)
    return {"web_messages": [response]}

def _web_next(state: WebState):
    msgs = state.get("web_messages") or []
    if msgs and getattr(msgs[-1], "tool_calls", None):
        return "web_tools"
    return "synthesize"

SYNTH_PROMPT = """You are a price synthesizer. A web researcher just gathered pricing data.
Summarize the findings as valid JSON with this exact structure — no markdown fences, just JSON:
{
  "total_eur": 2500,
  "breakdown": [
    {"category": "Flights", "amount_eur": 800, "note": "round-trip Helsinki-Tokyo"},
    {"category": "Accommodation", "amount_eur": 1200, "note": "10 nights mid-range hotel"},
    {"category": "Daily expenses", "amount_eur": 500, "note": "food, transport, activities"}
  ],
  "sources": [
    {"url": "https://example.com", "title": "Source name"}
  ],
  "summary": "A 10-day trip to Japan for 1 person costs approximately €2,500."
}

Rules:
- total_eur must equal the sum of breakdown amounts
- All amounts in EUR, rounded to nearest integer
- Include 2-5 sources with real URLs from the research
- summary should be 1-2 sentences
- If the research was inconclusive, estimate based on what was found and note uncertainty
"""

def _synthesize_node(state: WebState):
    web_msgs = state.get("web_messages") or []
    last_text = ""
    for msg in reversed(web_msgs):
        if isinstance(msg, AIMessage) and not getattr(msg, "tool_calls", None):
            last_text = msg.content if isinstance(msg.content, str) else ""
            if last_text.strip():
                break

    system = SystemMessage(content=SYNTH_PROMPT)
    human = HumanMessage(content=f"Web research output:\n\n{_cap_synthesis_input(last_text)}")
    response = llm.invoke([system, human])
    return {"messages": [response]}

# Build the graph
_builder = StateGraph(WebState)
_builder.add_node("web", _web_node)
_builder.add_node("web_tools", ToolNode(WEB_TOOLS, messages_key="web_messages"))
_builder.add_node("synthesize", _synthesize_node)
_builder.add_edge(START, "web")
_builder.add_conditional_edges("web", _web_next)
_builder.add_edge("web_tools", "web")
_builder.add_edge("synthesize", END)

_research_graph = _builder.compile()

# ── In-memory cache ─────────────────────────────────────────────────────────

_cache: dict[str, ResearchResponse] = {}

def _cache_key(req: ResearchRequest) -> str:
    return f"{req.destination}|{req.duration_days}|{req.travelers}|{req.month}|{req.origin}"

# ── FastAPI app ─────────────────────────────────────────────────────────────

app = FastAPI(title="Luca Research Service", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/research", response_model=ResearchResponse)
async def research(req: ResearchRequest):
    key = _cache_key(req)
    if key in _cache:
        return _cache[key]

    query = (
        f"Research the cost of a {req.duration_days}-day trip to {req.destination} "
        f"for {req.travelers} {'person' if req.travelers == 1 else 'people'}"
        f"{f' in {req.month}' if req.month else ''}"
        f"{f', departing from {req.origin}' if req.origin else ''}. "
        f"Find current prices for flights, accommodation, and daily expenses."
    )

    try:
        result = _research_graph.invoke({"messages": [HumanMessage(content=query)]})
        raw = result["messages"][-1].content
        raw_text = raw if isinstance(raw, str) else str(raw)

        # Parse the JSON from the synthesizer
        import json, re
        # Strip markdown fences if present
        clean = re.sub(r"```(?:json)?\s*", "", raw_text).strip().rstrip("`")
        data = json.loads(clean)

        response = ResearchResponse(
            destination=req.destination,
            duration_days=req.duration_days,
            travelers=req.travelers,
            total_eur=data.get("total_eur", 0),
            breakdown=[BreakdownItem(**b) for b in data.get("breakdown", [])],
            sources=[Source(**s) for s in data.get("sources", [])],
            summary=data.get("summary", ""),
        )
    except Exception as e:
        response = ResearchResponse(
            destination=req.destination,
            duration_days=req.duration_days,
            travelers=req.travelers,
            error=str(e),
            summary=f"Research failed: {e}",
        )

    _cache[key] = response
    return response


# ── Price research ─────────────────────────────────────────────────────────────

PRICE_SYNTH_PROMPT = """You are a price synthesizer. A web researcher just gathered pricing data for a product, property, or vehicle.
Summarize the findings as valid JSON with this exact structure — no markdown fences, just JSON:
{
  "price_low_eur": 800,
  "price_high_eur": 1200,
  "typical_eur": 999,
  "breakdown": [
    {"category": "Base price", "amount_eur": 999, "note": "standard configuration"},
    {"category": "Accessories", "amount_eur": 150, "note": "case, adapter"}
  ],
  "sources": [
    {"url": "https://example.com", "title": "Source name"}
  ],
  "summary": "A MacBook Air M4 costs approximately €999–€1,200 in Finland."
}

Rules:
- price_low_eur: lowest real price found across sources
- price_high_eur: highest real price found
- typical_eur: the most common or representative price
- All amounts in EUR, rounded to nearest integer. Convert from other currencies if needed.
- breakdown is optional — include it for items with distinct cost components (e.g. apartment: deposit + agency fees + moving costs). Omit for simple products.
- Include 2-5 sources with real URLs from the research
- summary should be 1-2 sentences with the price range and item
- If the research was inconclusive, estimate based on what was found and note uncertainty
"""

_price_cache: dict[str, PriceResearchResponse] = {}

def _price_cache_key(req: PriceResearchRequest) -> str:
    return f"{req.item}|{req.category}|{req.region}"

def _synthesize_price(state: WebState):
    """Synthesize price research results into structured JSON."""
    web_msgs = state.get("web_messages") or []
    last_text = ""
    for msg in reversed(web_msgs):
        if isinstance(msg, AIMessage) and not getattr(msg, "tool_calls", None):
            last_text = msg.content if isinstance(msg.content, str) else ""
            if last_text.strip():
                break

    system = SystemMessage(content=PRICE_SYNTH_PROMPT)
    human = HumanMessage(content=f"Web research output:\n\n{_cap_synthesis_input(last_text)}")
    response = llm.invoke([system, human])
    return {"messages": [response]}

# Build a separate graph for price research (same web pipeline, different synth)
_price_builder = StateGraph(WebState)
_price_builder.add_node("web", _web_node)
_price_builder.add_node("web_tools", ToolNode(WEB_TOOLS, messages_key="web_messages"))
_price_builder.add_node("synthesize", _synthesize_price)
_price_builder.add_edge(START, "web")
_price_builder.add_conditional_edges("web", _web_next)
_price_builder.add_edge("web_tools", "web")
_price_builder.add_edge("synthesize", END)
_price_research_graph = _price_builder.compile()

@app.post("/price-research", response_model=PriceResearchResponse)
async def price_research(req: PriceResearchRequest):
    key = _price_cache_key(req)
    if key in _price_cache:
        return _price_cache[key]

    query = (
        f"Research current prices for {req.item} in {req.region}. "
        f"Find real listings and price comparisons from at least 2 sources. "
        f"Category: {req.category}."
    )

    try:
        result = _price_research_graph.invoke({"messages": [HumanMessage(content=query)]})
        raw = result["messages"][-1].content
        raw_text = raw if isinstance(raw, str) else str(raw)

        import json, re
        clean = re.sub(r"```(?:json)?\s*", "", raw_text).strip().rstrip("`")
        data = json.loads(clean)

        response = PriceResearchResponse(
            item=req.item,
            category=req.category,
            price_low_eur=data.get("price_low_eur", 0),
            price_high_eur=data.get("price_high_eur", 0),
            typical_eur=data.get("typical_eur", 0),
            breakdown=[BreakdownItem(**b) for b in data.get("breakdown", [])],
            sources=[Source(**s) for s in data.get("sources", [])],
            summary=data.get("summary", ""),
        )
    except Exception as e:
        response = PriceResearchResponse(
            item=req.item,
            category=req.category,
            error=str(e),
            summary=f"Research failed: {e}",
        )

    _price_cache[key] = response
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
