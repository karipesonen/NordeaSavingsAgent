import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

load_dotenv(Path(__file__).parent / ".env", override=True)

# OpenRouter setup from another project leaks via env vars and hijacks the
# Anthropic SDK (redirects base URL + uses Bearer auth). Clear them so Luca
# talks to api.anthropic.com directly with our .env key.
os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)
os.environ.pop("ANTHROPIC_BASE_URL", None)

_anthropic_key = os.environ.get("ANTHROPIC_API_KEY") or ""
_openai_key = os.environ.get("OPENAI_API_KEY") or ""

# ── Active model ──────────────────────────────────────────────────────────────

# Sub-agent model (analyst, banking, investment, aggregator)
llm = ChatAnthropic(model="claude-haiku-4-5-20251001", api_key=_anthropic_key)

# Orchestrator model (main router only) — gpt-4o for "both" vs single-route accuracy
llm_orchestrator = ChatOpenAI(model="gpt-4o", api_key=_openai_key)

# Web agent model
llm_web = ChatAnthropic(model="claude-haiku-4-5-20251001", api_key=_anthropic_key)

# ── Drop-in alternatives — uncomment one block to switch ─────────────────────

# OpenAI sub-agents — gpt-4o-mini (200K TPM on Tier 1, but skips tool calls for "obvious" answers)
# llm = ChatOpenAI(model="gpt-4o-mini")
# llm_web = ChatOpenAI(model="gpt-4o")

# OpenAI sub-agents — gpt-4o (30K TPM on Tier 1 — hits limit fast with long tool schemas)
# llm = ChatOpenAI(model="gpt-4o")
# llm_web = ChatOpenAI(model="gpt-4o")

# Featherless — Qwen2.5 72B (ungated but 4 concurrency units; 32K context cap)
# llm = ChatOpenAI(model="Qwen/Qwen2.5-72B-Instruct", base_url="https://api.featherless.ai/v1")

# Featherless — Kimi-K2-Thinking (best for agentic tasks, often at capacity)
# llm = ChatOpenAI(model="moonshotai/Kimi-K2-Thinking", base_url="https://api.featherless.ai/v1")
