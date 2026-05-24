# Personal Finance Multi-Agent System

A conversational AI assistant for personal finance built with LangGraph and Claude. It routes your questions to specialized agents that read your financial data, search the web for real-world prices, and execute banking actions — all with a human confirmation step before any write operation.

## Architecture

```
User Input
    │
    ▼
┌─────────┐
│  main   │  Supervisor — routes to the right agent(s)
└────┬────┘
     │
     ├──────────────────────────┬────────────────────┬──────────────────┐
     ▼                          ▼                    ▼                  ▼
┌──────────┐            ┌─────────────┐       ┌─────────┐       ┌────────────┐
│ analyst  │            │     web     │       │ banking │       │ investment │
│  agent   │            │    agent    │       │  agent  │       │   agent    │
└────┬─────┘            └──────┬──────┘       └────┬────┘       └─────┬──────┘
     │                         │                   │                  │
     ▼                         ▼                   ▼                  ▼
┌──────────────┐    ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────┐
│ analyst_tools│    │    web_tools     │  │   banking_tools    │  │   finance_tools      │
│ (DB reads)   │    │ (search/scrape)  │  │ (DB reads +        │  │ (yfinance: stocks,   │
└──────────────┘    └──────────────────┘  │  propose_action)   │  │  ETFs, crypto)       │
                                          └────────────────────┘  │ + DB reads           │
                                                   │              └──────────────────────┘
     ┌───────────────────────────────────┐         ▼
     │          aggregator               │  ┌──────────────────┐
     │  (merges analyst + web outputs)   │  │ banking_confirm  │  ← human interrupt
     └───────────────────────────────────┘  └────────┬─────────┘
                                                      │
                                          ┌───────────┴──────────┐
                                          ▼                       ▼
                                  ┌──────────────┐     ┌──────────────────┐
                                  │banking_execute│    │banking_cancelled │
                                  └──────────────┘     └──────────────────┘
```

### Agents

| Agent | Role |
|---|---|
| `main_agent` | Supervisor — classifies intent and routes to the right agent(s) |
| `analyst_agent` | Reads personal financial data (balance, transactions, goals, loans, cards) |
| `web_agent` | Searches and scrapes the web for real-world prices and market data |
| `aggregator_agent` | Merges analyst + web outputs into a single coherent response (parallel mode only) |
| `banking_agent` | Executes write actions — transfers, goals, loans — with human confirmation |
| `investment_agent` | Fetches live market data (stocks, ETFs, crypto) and cross-references it with the user's financial situation to produce grounded investment advice |

### Routing Logic

The supervisor routes each message to one of five destinations:

- **`analyst`** — personal financial data only (balance, spending, goals, loans)
- **`web`** — real-world prices only (products, travel, real estate, cars)
- **`both`** — needs both (e.g. "can I afford a trip to Japan?") → runs analyst + web in parallel, then aggregator
- **`banking`** — write action (send money, create/update goal, request loan)
- **`investment`** — stocks, ETFs, crypto, or any question combining market data with the user's financial capacity

## Project Structure

```
agentic_ai_project/
├── main.py                        # LangGraph graph definition and CLI entry point
├── db_tools.py                    # Raw DB read/write functions (CSV-backed)
├── pyproject.toml
│
├── agents/
│   ├── main_agent.py              # Supervisor / router
│   ├── personalanalyzer_agent.py  # Financial analyst agent
│   ├── web_searcher_agent.py      # Web research agent
│   ├── aggregator_agent.py        # Synthesis agent (parallel mode)
│   ├── bank_automation.py         # Banking agent + confirmation flow
│   └── investment_agent.py        # Investment research agent (market data + personal context)
│
├── tools/
│   ├── database_tools.py          # LangChain tools wrapping db_tools (read + write)
│   ├── web_search.py              # DuckDuckGo search + Firecrawl scrape tools
│   ├── finance_tools.py           # Stock/ETF/crypto market data tools (yfinance)
│   └── image_processing.py        # Image utilities
│
├── memory/
│   └── short_term.py              # LangGraph State, checkpointer, and in-memory store
│
└── data/                          # CSV data files (user's financial data)
    ├── profile.csv
    ├── transactions.csv
    ├── goals.csv
    ├── loans.csv
    ├── cards.csv
    └── contacts.csv
```

## Setup

**Requirements:** Python 3.13+, [uv](https://github.com/astral-sh/uv)

1. Clone the repo and install dependencies:

```bash
uv sync
```

2. Create a `.env` file with your API keys:

```env
ANTHROPIC_API_KEY=your_key_here
FIRECRAWL_API_KEY=your_key_here   # optional, for web scraping
```

## Run

```bash
uv run main.py
```

The CLI prompts you for input in a loop:

```
ASK: What's my balance?
Bot: ...

ASK: Can I afford a trip to Japan in August?
Bot: ...

ASK: Should I invest in NVIDIA? How much can I afford monthly?
Bot: ...

ASK: Send €50 to Marco
Action pending — please confirm:

  Send €50 to Marco Rossi (IBAN: IT123...) with note 'dinner'

  Type 'yes' to confirm or 'no' to cancel.
Your answer: yes
Bot: Done. ...

ASK: quit
```

Type `quit` or `exit` to stop.

## Memory

- **Short-term:** conversation history is persisted per `thread_id` via `InMemorySaver` (resets on restart)
- **Long-term:** user profile is loaded into `InMemoryStore` at startup and refreshed after every write action
