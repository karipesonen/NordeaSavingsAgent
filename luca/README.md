# Personal Finance Multi-Agent System

A conversational AI assistant for personal finance built with **LangGraph** and **Claude**. It routes your questions to specialised agents that read your financial data, search the web for real-world prices, and execute banking actions — pausing for human confirmation before every write operation.

---

## Architecture

```
User Input
    │
    ▼
┌─────────┐
│  main   │  Supervisor — classifies intent and routes
└────┬────┘
     │
     ├─────────────────────┬──────────────────┬──────────────────┐
     ▼                     ▼                  ▼                  ▼
┌──────────┐         ┌──────────┐       ┌─────────┐       ┌────────────┐
│ analyst  │         │   web    │       │ banking │       │ investment │
│  agent   │         │  agent   │       │  agent  │       │   agent    │
└────┬─────┘         └────┬─────┘       └────┬────┘       └─────┬──────┘
     │                    │                  │                   │
     ▼                    ▼           ┌──────┴──────┐           ▼
┌──────────────┐  ┌───────────────┐  │             │    ┌──────────────────┐
│analyst_tools │  │   web_tools   │  ▼             ▼    │ investment_tools │
│  (DB reads)  │  │(search/scrape)│ banking_    banking_ │ (yfinance +      │
└──────┬───────┘  └──────┬────────┘ read_tools  write_   │  DB reads)       │
       └──────────────────┘         (DB reads)  confirm  └──────────────────┘
              │                                  │
              ▼                           human interrupt
         aggregator                             │
    (parallel mode only)                        ▼
                                         banking agent
                                       (summarises result)
```

### Agents

| Agent | Model | Role |
|---|---|---|
| `main_agent` | Haiku 4.5 | Supervisor — classifies intent and routes; hard-bypasses LLM when banking is mid-conversation |
| `analyst_agent` | Haiku 4.5 | Reads personal financial data (balance, transactions, goals, loans, cards) |
| `web_agent` | Haiku 4.5 | Searches and scrapes the web for real-world prices and market data |
| `aggregator_agent` | Haiku 4.5 | Merges analyst + web outputs into one coherent response (parallel mode only) |
| `banking_agent` | **Sonnet 4.6** | Executes write actions — transfers, goals, loans, card management — with human confirmation before every write |
| `investment_agent` | Haiku 4.5 | Fetches live market data (stocks, ETFs, crypto) and cross-references it with the user's financial capacity |
| `learner_agent` | **Sonnet 4.6** | Investment education — explains concepts, generates quizzes, surfaces curated resources |

### Routing Logic

The supervisor routes each message to one destination:

| Destination | When |
|---|---|
| `analyst` | Personal financial data only (balance, spending, goals, loans, cards) |
| `web` | Real-world prices only (products, travel, real estate, cars) |
| `both` | Needs both — runs analyst + web in parallel, then aggregator |
| `banking` | Any write action (send money, create/update/delete goal, request loan, block card) |
| `investment` | Stocks, ETFs, crypto, or any question combining market data with the user's financial capacity |

### Banking confirmation flow

The banking agent has direct access to all read **and** write tools. Whenever it calls a write tool, `banking_write_confirm` intercepts the call, pauses for user confirmation, and only then executes it. After execution (confirmed or cancelled) the agent produces a plain-language summary.

```
banking ──read tool──→ banking_read_tools ──┐
        ──write tool─→ banking_write_confirm─┤──→ banking (summary) ──→ END
        ──no tools───→ END
```

- Non-contact IBANs are flagged with a `[!]` warning inside the confirmation prompt — the user is the final safety check.
- The account balance is checked before any outgoing transaction; insufficient-funds transactions are rejected before execution.
- Deleting a savings goal automatically refunds the accumulated balance to the account and logs a `goal_refund` transaction.

---

## Project Structure

```
luca/
├── main.py                        # LangGraph graph definition and CLI entry point
├── api.py                         # FastAPI wrapper (POST /chat, POST /confirm, GET /daily-recap)
├── db_tools.py                    # Raw CRUD layer — CSV-backed, no external dependencies
├── daily_recap.py                 # Daily financial summary — no LLM, pure data aggregation
├── pyproject.toml
│
├── agents/
│   ├── main_agent.py              # Supervisor / router (hard-routes banking follow-ups)
│   ├── personalanalyzer_agent.py  # Financial analyst agent
│   ├── web_searcher_agent.py      # Web research agent
│   ├── aggregator_agent.py        # Synthesis agent (parallel mode)
│   ├── bank_automation.py         # Banking agent + write-confirmation flow
│   ├── investment_agent.py        # Investment research agent
│   └── learner_agent.py           # Investment education agent
│
├── tools/
│   ├── database_tools.py          # LangChain tool wrappers (READING_TOOLS / WRITING_TOOLS)
│   ├── finance_tools.py           # Stock / ETF / crypto market data tools (yfinance)
│   ├── learning_tools.py          # RAG tools for the learner agent
│   └── web_search.py              # Web search and scrape tools (Firecrawl)
│
├── memory/
│   └── short_term.py              # LangGraph State, SqliteSaver checkpointer, InMemoryStore
│
└── data/                          # CSV files — the user's financial database
    ├── profile.csv                # Account profile and balance
    ├── transactions.csv           # Full transaction ledger
    ├── goals.csv                  # Savings goals (each has an auto-generated wallet IBAN)
    ├── loans.csv                  # Loan requests and accepted loans
    ├── cards.csv                  # Debit / credit cards
    └── contacts.csv               # Saved payees (auto-populated after transactions)
```

---

## Setup

**Requirements:** Python 3.13+, [uv](https://github.com/astral-sh/uv)

1. Install dependencies:

```bash
uv sync
```

2. Add API keys to `env.env` (or a `.env` file):

```env
ANTHROPIC_API_KEY=your_key_here
FIRECRAWL_API_KEY=your_key_here   # required for web search and scraping
```

---

## Run

```bash
uv run main.py
```

The CLI prompts for input in a loop. Type `quit` or `exit` to stop.

```
ASK: What's my balance?
Bot: Your balance is €2,925.76.

ASK: Can I afford a trip to Japan in August?
Bot: [analyst + web run in parallel, aggregator merges results]
     Monthly surplus: €480. At current rate you can save €960 by August.
     Estimated trip cost (2 weeks, 2 people): ~€3,800. ...

ASK: Should I invest in NVIDIA? How much can I afford monthly?
Bot: [fetches live price + financials + your financial data]
     NVDA is trading at $... Your investable surplus is ~€96/month...

ASK: Send €50 to Mom
Action pending — please confirm:

  Send €50.00 to Mom  (IBAN: FI2100112233445522)

  Type 'yes' to confirm or 'no' to cancel.
Your answer: yes
Bot: Done. Transfer of €50 to Mom completed (txn_042).

ASK: Delete the Japan trip goal
Action pending — please confirm:

  Permanently delete goal goal_003

  Type 'yes' to confirm or 'no' to cancel.
Your answer: yes
Bot: Done. Goal deleted. €320.00 accumulated savings have been returned to your balance.
```

---

## Data model

All financial data is stored as CSV files in `data/`. The `db_tools.py` layer handles all reads and writes — no external database required.

| File | Contents |
|---|---|
| `profile.csv` | Name, IBAN, balance, credit score, contact details |
| `transactions.csv` | Full ledger — every income, expense, transfer, goal contribution, and refund |
| `goals.csv` | Savings goals with target amount, accumulated savings, deadline, and contribution rule |
| `loans.csv` | Loan requests and accepted loans with interest rate and repayment schedule |
| `cards.csv` | Debit / credit cards with limits and status |
| `contacts.csv` | Saved payees with nickname and linked IBAN |

### Write operations available to the banking agent

| Tool | Effect |
|---|---|
| `make_transaction` | Records a transaction and updates the account balance |
| `create_goal` | Creates a new savings goal |
| `update_goal` | Updates goal metadata or status |
| `delete_goal` | Deletes a goal and refunds accumulated savings to the balance |
| `contribute_to_goal` | Moves funds into a goal wallet and logs the contribution |
| `create_loan_request` | Submits a loan request (status: `requested`) |
| `update_card` | Blocks / unblocks a card or changes spending limits |
| `update_transaction_status` | Transitions a transaction between `pending`, `completed`, `cancelled`, `failed` |
| `add_contact` / `update_contact` / `delete_contact` | Manages saved payees |
| `update_profile` | Updates editable profile fields (email, phone, address) |

---

## Memory

| Layer | Implementation | Scope |
|---|---|---|
| Conversation history | `SqliteSaver` → `luca_checkpoints.db` | Persists across restarts per `thread_id` |
| User profile cache | `InMemoryStore` | Loaded at startup; refreshed after every write action |

---

## Key design decisions

- **CSV as the database** — zero infrastructure, easy to inspect and edit directly.
- **Separate private message channels per agent** (`analyst_messages`, `banking_messages`, etc.) — agents do not pollute each other's tool-call history.
- **Turn isolation via `*_turn_start`** — each agent only sees its own tool calls for the current user turn, set by `main_agent` at the start of every turn.
- **Single confirmation interrupt** — `banking_write_confirm` is the only place where execution pauses; the banking agent never asks "should I proceed?" conversationally.
- **Mid-conversation routing guard** — `banking_awaiting_reply` and `banking_just_wrote` state flags let `main_agent` hard-route follow-up replies (amounts, "yes", "no") to the banking agent without calling the LLM, preventing hallucinated outcomes.
- **Auto-contact creation** — after every confirmed `make_transaction`, the counterpart is added to contacts automatically if their IBAN is not already saved.
- **Auto wallet IBAN** — each new savings goal gets a randomly generated unique Finnish IBAN assigned at creation time.
- **Sonnet for banking and learning, Haiku everywhere else** — the agents that move money and generate educational content use the most capable model; read-only agents use the fastest one.
- **Daily recap without an LLM** — `daily_recap.py` computes today's spending, overspending alerts, upcoming subscription renewals, and goal deadline warnings purely from the CSV data.
