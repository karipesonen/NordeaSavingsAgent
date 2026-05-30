# Nora — Nordea Savings Copilot

**Course:** TU-E5080 AI agents and the real world (Aalto University)

A conversational AI copilot for personal finance. Two implementation tracks live side-by-side:

- **`agent/`** — Nora main orchestrator built with the Claude Agent SDK (OpenRouter, Node.js). One strong orchestrator backed by deterministic specialist tools. This is the hackathon demo track.
- **`luca/`** — Full LangGraph multi-agent backend (Python) with a mobile-style React frontend. Seven specialist agents, live market data, and CSV-backed banking.

---

## Project layout

```
NordeaSavingsAgent/
│
├── agent/                     # Claude Agent SDK orchestrator (demo track)
│   ├── system_prompt.md       # Nora's tone, workflow, guardrails, memory policy
│   ├── config.json            # Runtime config (OpenRouter model, parameters)
│   ├── memory_schema.json     # Compact user memory schema
│   ├── tools/                 # Deterministic specialist tool implementations (.mjs)
│   │   ├── nora_tools.schema.json
│   │   ├── goal_savings_plan_agent.mjs
│   │   ├── education_risk_lesson_agent.mjs
│   │   ├── expense_review_agent.mjs
│   │   ├── learning_progress_agent.mjs
│   │   ├── snapshot_insight_agent.mjs
│   │   └── action_approval_agent.mjs
│   ├── subagents/             # Prompt + contract per sub-agent
│   └── examples/              # First-session sample input + expected output
│
├── agent_state/               # Runtime memory for the demo agent (JSON/JSONL per session)
│
├── luca/                      # Python backend — agents, API, data
│   ├── main.py                # LangGraph graph + CLI entry point
│   ├── api.py                 # FastAPI wrapper (used by the frontend)
│   ├── db_tools.py            # CSV CRUD layer
│   ├── daily_recap.py         # Daily financial summary (no LLM, pure data aggregation)
│   ├── agents/                # One file per agent
│   │   ├── main_agent.py
│   │   ├── personalanalyzer_agent.py
│   │   ├── web_searcher_agent.py
│   │   ├── aggregator_agent.py
│   │   ├── bank_automation.py
│   │   ├── investment_agent.py
│   │   ├── learner_agent.py
│   │   └── daily_recap_agent.py   # LLM-based daily health monitor (runs at 18:00)
│   ├── tools/                 # LangChain tool wrappers
│   │   ├── database_tools.py
│   │   ├── finance_tools.py   # yfinance — stock/ETF/crypto market data
│   │   ├── learning_tools.py
│   │   ├── image_processing.py
│   │   └── web_search.py
│   ├── memory/                # LangGraph State + SqliteSaver checkpointer
│   └── data/                  # CSV files (profile, transactions, goals, investments…)
│
├── front-nora-mobile/         # Node.js + React frontend
│   ├── server.js              # Express server — proxies to Python API
│   └── public/                # Browser-side React (Babel, no bundler)
│       ├── nora-app.jsx
│       ├── nora-screens.jsx
│       ├── nora-components.jsx
│       └── nora-tabs.jsx
│
├── tests/                     # Automated Nora conversation simulator + unit tests
├── synthetic_data/            # Fake users and transactions (no prod data)
├── brief/                     # Original Nordea project brief (PDF)
├── demo/                      # Demo prototype notes and assets
└── notes/                     # Design decisions and concept notes
```

---

## Architecture — `agent/` track (demo)

Nora is the single user-facing orchestrator. All specialist work is handled by deterministic tools:

```
Nora (Claude Agent SDK, OpenRouter)
  ├── reads bank context + user memory
  ├── Goal/Savings Plan Agent      — contribution math, feasibility
  ├── Education/Risk Lesson Agent  — learning cards before investment drafts
  ├── Expense Review Agent         — recurring expense tables + review habit
  ├── Learning Progress Agent      — confidence journey tracking
  ├── Snapshot/Insights Agent      — state summaries, next-best-action
  └── Action/Approval Agent        — demo-only action drafts + Trust Ledger
```

The `agent_state/` folder holds everything the running agent remembers (user profile, conversation history, action log). Wiping a session folder resets it completely.

---

## Architecture — `luca/` track (full backend)

```
Browser
   │  POST /api/nora/chat
   │  POST /api/nora/confirm      (banking interrupt resume)
   │  GET  /api/nora/daily-recap
   ▼
┌─────────────────────┐
│  Node.js server.js  │   proxies requests, formats cards
└────────┬────────────┘
         │  POST /chat  /confirm  GET /daily-recap
         ▼
┌─────────────────────┐
│   FastAPI  api.py   │   manages LangGraph state + interrupt detection
└────────┬────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       LangGraph graph                           │
│                                                                 │
│   main_agent (Haiku) ──routes──► analyst  ──► analyst_tools    │
│         │                        web      ──► web_tools        │
│         │                        both ──► analyst + web        │
│         │                               └──► aggregator        │
│         │                        investment ──► investment_tools│
│         │                        learner    ──► learner_tools  │
│         └──────────────────────► banking                       │
│                                     │                          │
│                               read tool? ──► banking_read_tools│
│                               write tool?──► banking_write_confirm
│                                                  │  interrupt  │
│                                            user confirms/cancels
│                                                  │             │
│                                             banking (summary)  │
└─────────────────────────────────────────────────────────────────┘
```

### Agents

| Agent | Model | Role |
|---|---|---|
| `main_agent` | Haiku 4.5 | Supervisor — classifies intent and routes; hard-bypasses LLM when banking is mid-conversation |
| `analyst_agent` | Haiku 4.5 | Reads personal financial data (balance, transactions, goals, loans, cards) |
| `web_agent` | Haiku 4.5 | Searches and scrapes the web for real-world prices |
| `aggregator_agent` | Haiku 4.5 | Merges analyst + web output (parallel mode only) |
| `banking_agent` | Sonnet 4.6 | Executes write actions with a human confirmation interrupt before every write |
| `investment_agent` | Haiku 4.5 | Live market data (stocks, ETFs, crypto) cross-referenced with the user's financial capacity |
| `learner_agent` | Sonnet 4.6 | Investment education — explanations, quizzes, curated resources |
| `daily_recap_agent` | Haiku 4.5 | LLM-based daily financial health monitor; runs at 18:00, searches web for investment/product goal news, writes `data/daily_brief.json` |

### Banking confirmation flow

Every write action is intercepted by `banking_write_confirm`, which pauses via `langgraph.interrupt()` and resumes only when the user explicitly confirms or cancels through the frontend's confirmation card.

```
banking ──read tool──► banking_read_tools ──┐
        ──write tool─► banking_write_confirm─┤──► banking (summary) ──► END
        ──no tools───► END
```

After a confirmed `make_transaction`, the counterpart is automatically added to the user's contacts if not already saved.

### Mid-conversation routing guard

A pair of state flags (`banking_awaiting_reply`, `banking_just_wrote`) let `main_agent` hard-route follow-up replies (amounts, "yes", "no") straight to the banking agent without calling the LLM — preventing hallucinated transaction outcomes.

---

## Setup

### Backend (Python)

**Requirements:** Python 3.13+, [uv](https://github.com/astral-sh/uv)

```bash
cd luca
uv sync
```

Add API keys to `luca/env.env`:

```env
ANTHROPIC_API_KEY=your_key_here
FIRECRAWL_API_KEY=your_key_here   # required for web search / scraping
```

### Frontend (Node.js)

**Requirements:** Node.js 18+

```bash
cd front-nora-mobile
npm install
```

Copy `.env.example` to `.env` and set:

```env
PORT=3001
PYTHON_API_URL=http://localhost:8000
```

### Agent / simulation (root)

```bash
npm install
```

Set `OPENROUTER_API_KEY` (required for the OpenRouter simulation runs).

---

## Running

### Full stack (Python API + React frontend)

Start the Python API (port 8000):

```bash
cd luca
uv run api.py
```

Start the frontend server (port 3001):

```bash
cd front-nora-mobile
node server.js
```

Open `http://localhost:3001` in your browser.

### CLI only (no frontend)

```bash
cd luca
uv run main.py
```

---

## Testing

All test scripts run from the project root via `npm run`:

| Command | What it runs |
|---|---|
| `npm run test:goal-plan` | Goal/Savings Plan Agent unit tests |
| `npm run test:education` | Education/Risk Lesson Agent unit tests |
| `npm run test:expense` | Expense Review Agent unit tests |
| `npm run test:learning` | Learning Progress Agent unit tests |
| `npm run test:snapshot` | Snapshot/Insights Agent unit tests |
| `npm run test:action` | Action/Approval Agent unit tests |
| `npm run test:nora:offline` | Full conversation simulation (no API keys, deterministic) |
| `npm run test:nora:openrouter` | Full conversation simulation against OpenRouter |
| `npm run import:data` | Import synthetic user workbook → JSON |

Offline simulation transcripts are saved under `tests/transcripts/<timestamp>/`.

To run the OpenRouter simulation for specific users:

```bash
node tests/run_nora_simulation.mjs --data synthetic_data/generated/nordea_5users_2025.json --users Emma,Sofia --turns 11 --mode openrouter
```

---

## Features

### Conversational banking
- Send money, create/update/delete savings goals, request loans, block cards — all with explicit confirmation before execution.
- Each write action shows a **confirmation card** in the UI; the backend uses LangGraph's `interrupt()` mechanism so the write is only executed after the user taps Confirm.
- Non-contact IBANs are flagged in the confirmation prompt.

### Savings goals
- Each goal gets a randomly generated dedicated wallet IBAN on creation.
- Goals can be shared with contacts.

### Financial analysis
- Personal data queries (balance, spending breakdown, goal progress, loan overview) are handled by the analyst agent with tool chaining.
- Affordability questions ("can I afford a trip to Japan?") run analyst + web in parallel and merge results.

### Investment research
- Live prices, P/E, 52-week range, and price history from yfinance.
- Recommendation is anchored to the user's actual monthly surplus.
- Active investment positions tracked in `data/investments.csv`.

### Investment education
- Explain concepts, take quizzes, get curated resources — grounded in a catalog of articles.

### Daily Brief
- A persistent card shown at the top of the chat screen on every app open.
- `daily_recap.py` computes today's spending, daily average comparison, upcoming subscription renewals (next 3 days), and goal deadline alerts — no LLM.
- `daily_recap_agent.py` extends this with an LLM-generated green/yellow/red health status, observations, and suggestions. It also runs parallel web searches for investment news and product-goal deals, and stores the result in `data/daily_brief.json`.

---

## Data model

All financial data lives in `luca/data/` as CSV files. `db_tools.py` handles all reads and writes.

| File | Contents |
|---|---|
| `profile.csv` | Name, IBAN, balance, credit score, contact details |
| `transactions.csv` | Full ledger — income, expenses, transfers, goal contributions, refunds |
| `goals.csv` | Savings goals with target, accumulated, deadline, contribution rule, wallet IBAN |
| `loans.csv` | Loan requests and accepted loans |
| `cards.csv` | Debit / credit cards with limits and status |
| `contacts.csv` | Saved payees with nickname, IBAN, and relationship |
| `investments.csv` | Active investment positions (ticker, name, quantity, purchase price) |

---

## Key design decisions

- **CSV as the database** — zero infrastructure, easy to inspect and edit directly.
- **Two parallel tracks** — `agent/` proves the orchestrator-first approach quickly; `luca/` is the full multi-agent backend. They share the same data model.
- **Private message channels per agent** — `analyst_messages`, `banking_messages`, etc. keep tool-call histories isolated.
- **Turn isolation via `*_turn_start`** — set by `main_agent` at the start of every turn so each agent only sees its own tool calls for the current turn.
- **Single confirmation interrupt** — `banking_write_confirm` is the only execution pause point; the banking agent never asks "should I proceed?" conversationally.
- **Sonnet for banking and learning, Haiku everywhere else** — the agents that move money and generate educational content use the most capable model; read-only agents use the fastest one.
- **No bundler on the frontend** — React and Babel run directly in the browser; all components are plain `.jsx` files served as static assets.
- **`agent_state/` is a closed box** — everything the demo agent remembers lives there; wiping a session folder gives a clean-slate demo.
