# Nordea Savings — Hackathon Project

**Course:** TU-E5080 AI agents and the real world (Aalto)

**Brief:** Next-generation digital savings/investment experience for Nordea, aimed at younger customers. Move past the "buttons and numbers" mobile-banking paradigm toward something conversational, personal, frictionless, and trustworthy.

**Course-side showcase:** Strongest demos shown to Nordea leadership (feeds into August top-management presentation).

## Project layout

```
nordea-savings-hackathon/
├── brief/            Source material (PDF brief, prior ChatGPT ideation chat)
├── notes/            Distilled decisions, concept choice, persona, flow
├── agent/            System prompts, tools, config for the demo agent
├── demo/             Frontend / UI / harness that shows the agent in action
├── synthetic_data/   Fake transactions, personas, test scenarios (no prod data)
├── agent_state/      The agent's "closed box" runtime memory — wipe between test runs
└── README.md
```

## Workshop vs. project separation

Framework-level assets (the Agent Architect meta-prompt, templates, conventions) live in `C:\Users\karip\agent-lab`. This project *uses* those assets but does not fork them. If a framework improvement emerges during this build, it gets written back to agent-lab — not duplicated here.

The architect's system prompt: `C:\Users\karip\agent-lab\agents\architect\system_prompt.md`
The agent template: `C:\Users\karip\agent-lab\templates\agent_template.md`

## Two kinds of "memory" at play here

1. **Build-process memory** — Claude Code's memory, auto-scoped to this working directory. Notes about this project go here. General-framework lessons go to agent-lab's memory instead.
2. **The demo agent's runtime memory** — the "closed box" under `agent_state/`. This is what the *built agent* uses at runtime (user profile, conversation history, derived financial state). Wipe between test runs to keep the box closed.

## Data constraint

No production customer data. Use synthetic transactions and public Nordea info only. See `synthetic_data/` for generated personas and transaction streams.

## Current status

- [x] Brief and prior ideation chat captured under `brief/`
- [x] Project scaffolded
- [x] Concept direction distilled (see `notes/concept.md`)
- [ ] Architect run to produce formal agent design
- [x] Nora main agent prompt drafted
- [x] Goal/Savings Plan Agent built and integrated into Nora's workflow
- [x] Education/Risk Lesson Agent built and integrated into Nora's workflow
- [x] Expense Review Agent built and integrated into Nora's workflow
- [x] Learning Progress Agent built and integrated into Nora's workflow
- [x] Snapshot/Insights Agent built and integrated into Nora's workflow
- [x] Action/Approval Agent built and integrated into Nora's workflow
- [x] Action Confirmation transcript card added for approval moments without building a frontend UI
- [x] Synthetic user + transactions generated/imported from `synthetic_data/source/nordea_5users_2025.xlsx`
- [ ] Demo harness built
- [x] Automated Nora simulation loop working in offline mode (`npm run test:nora:offline`)


## Automated simulation

The Nora conversation simulator lives under `tests/`.

- Import the Excel workbook: `npm run import:data`
- Run the goal planner unit tests: `npm run test:goal-plan`
- Run the education lesson unit tests: `npm run test:education`
- Run the expense review unit tests: `npm run test:expense`
- Run the learning progress unit tests: `npm run test:learning`
- Run the snapshot/insights unit tests: `npm run test:snapshot`
- Run the action/approval unit tests: `npm run test:action`
- Run deterministic/offline conversations: `npm run test:nora:offline`
- Run model-backed conversations with OpenRouter: `npm run test:nora:openrouter`

Full transcript files are written to timestamped folders under `tests/transcripts/`. Approval moments render both a user-facing `Action Confirmation` card and the debug `Action / Approval Agent` block.
