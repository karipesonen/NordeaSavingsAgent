import os

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "env.env"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langgraph.types import Command

from main import graph, ROUTING_WORDS

app = FastAPI(title="Nora agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / response models ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"

class ConfirmRequest(BaseModel):
    thread_id: str
    answer: str  # "yes" | "no" (or any text the user typed)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _extract_reply(result: dict) -> str:
    """Return the last meaningful text message from the graph's messages list."""
    for msg in reversed(result.get("messages", [])):
        content = getattr(msg, "content", "")
        text = content if isinstance(content, str) else ""
        if text.strip() and text.strip().lower() not in ROUTING_WORDS:
            return text.strip()
    return ""


def _pending_interrupt(thread_id: str) -> str | None:
    """Return the interrupt prompt string if the graph is paused, else None."""
    config = {"configurable": {"thread_id": thread_id}}
    snapshot = graph.get_state(config)
    if not snapshot.next:
        return None
    for task in snapshot.tasks:
        for intr in getattr(task, "interrupts", []):
            if intr.value:
                return intr.value
    return None


def _detect_agent(result: dict) -> list[str]:
    """
    Infer which specialised agent ran this turn by finding the most recent
    routing word emitted by main_agent in the message history.
    """
    for msg in reversed(result.get("messages", [])):
        content = getattr(msg, "content", "")
        word = content.strip().lower() if isinstance(content, str) else ""
        if word in ROUTING_WORDS:
            return [word]
    return []


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/chat")
async def chat(req: ChatRequest):
    config = {"configurable": {"thread_id": req.thread_id}}
    try:
        result = graph.invoke(
            {"messages": [{"role": "user", "content": req.message}]},
            config,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Check whether the graph is suspended at a banking interrupt
    interrupt_prompt = _pending_interrupt(req.thread_id)
    if interrupt_prompt:
        return {
            "message": "",
            "pending_confirmation": {"message": interrupt_prompt},
            "invoked_agents": ["banking"],
        }

    return {
        "message": _extract_reply(result),
        "pending_confirmation": None,
        "invoked_agents": _detect_agent(result),
    }


@app.post("/confirm")
async def confirm(req: ConfirmRequest):
    config = {"configurable": {"thread_id": req.thread_id}}
    try:
        result = graph.invoke(Command(resume=req.answer), config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # The graph might pause again (e.g. a second write action in the same turn)
    interrupt_prompt = _pending_interrupt(req.thread_id)
    if interrupt_prompt:
        return {
            "message": "",
            "pending_confirmation": {"message": interrupt_prompt},
            "invoked_agents": ["banking"],
        }

    return {
        "message": _extract_reply(result),
        "pending_confirmation": None,
        "invoked_agents": ["banking"],
    }


@app.get("/daily-recap")
async def daily_recap_endpoint():
    """Return the most recently stored daily brief without generating a new one."""
    from agents.daily_recap_agent import load_latest_brief
    brief = load_latest_brief()
    if brief is None:
        raise HTTPException(status_code=404, detail="No saved daily recap found")
    return brief


@app.post("/run-daily-recap")
async def run_daily_recap_now():
    """Manually trigger the daily recap agent."""
    from agents.daily_recap_agent import run_daily_recap
    try:
        return run_daily_recap()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"ok": True, "agents": list(ROUTING_WORDS)}


# ── Entrypoint ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)
