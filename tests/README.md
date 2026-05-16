# Nora Simulation Tests

This folder contains the automated Nora conversation simulator.

## What it does

The simulator runs Nora against synthetic users so the team does not have to type test replies manually.

Flow:

```text
selected synthetic user data
-> Nora main agent
-> Goal/Savings Plan Agent when Nora proposes a goal plan
-> Education/Risk Lesson Agent when Nora bridges to learning
-> Expense Review Agent when Nora reviews recurring categories
-> Learning Progress Agent when Nora tracks confidence progress
-> Snapshot/Insights Agent when Nora summarizes state or chooses a next move
-> Action/Approval Agent when Nora creates or updates a demo-only draft/action
-> simulated user replies in character
-> repeat for N turns
-> save one readable Markdown transcript per user plus structured JSON artifacts
-> print short summary
```

## Goal planner unit test

Run the deterministic Goal/Savings Plan Agent tests:

```powershell
npm run test:goal-plan
```

These check target parsing, normal goal timelines, and large-goal adjustment behavior such as Aino's down-payment case.

## Education unit test

Run the deterministic Education/Risk Lesson Agent tests:

```powershell
npm run test:education
```

These check blocker-specific lesson routing, short-card output, concept checks, and education-only safety flags.

## Expense review unit test

Run the deterministic Expense Review Agent tests:

```powershell
npm run test:expense
```

These check selected-category handling, subscription-first defaults, no automatic cancellation guardrails, review-habit output, and empty-data behavior.

## Learning progress unit test

Run the deterministic Learning Progress Agent tests:

```powershell
npm run test:learning
```

These check Stage 1 domain routing, warm visible statuses, repeated-topic progress caps, Stage 2 gating, and explicit funds interest.

## Snapshot/insights unit test

Run the deterministic Snapshot/Insights Agent tests:

```powershell
npm run test:snapshot
```

These check current snapshots, next-best-action selection, memory review without automatic updates, bank-known age handling, and recap safety flags.

## Action/approval unit test

Run the deterministic Action/Approval Agent tests:

```powershell
npm run test:action
```

These check demo-only savings drafts, approval state, edits, pause/resume, blocked investment drafts, expense review habits, subscription cancellation requests, shared-goal privacy, and action logs.

## Data import

The source workbook is stored at:

`synthetic_data/source/nordea_5users_2025.xlsx`

Import it into JSON:

```powershell
npm run import:data
```

This creates:

`synthetic_data/generated/nordea_5users_2025.json`

## Offline scripted simulation

Runs without API keys and produces deterministic transcripts:

```powershell
npm run test:nora:offline
```

Or choose specific users:

```powershell
node tests/run_nora_simulation.mjs --data synthetic_data/generated/nordea_5users_2025.json --users Emma,Sofia --turns 11 --mode offline
```

The offline runner includes smoke checks for repeated Nora and simulated-user responses, Goal/Savings Plan Agent usage, Expense Review Agent usage, Education/Risk Lesson Agent usage, Learning Progress Agent usage, Snapshot/Insights Agent usage, Action/Approval Agent usage, concept-check questions, no raw progress-status wording in visible Nora copy, no real money-movement wording, delayed funds suggestions, and whether unrealistic large goals are flagged.

## OpenRouter simulation

Set `OPENROUTER_API_KEY`, then run:

```powershell
node tests/run_nora_simulation.mjs --data synthetic_data/generated/nordea_5users_2025.json --users all --turns 11 --mode openrouter
```

Optional model flags:

```powershell
--nora-model anthropic/claude-opus-4.7 --user-model openai/gpt-5-mini
```

## Where conversations appear

Each run creates a timestamped folder under:

`tests/transcripts/`

For each user, the top-level run folder writes only:

- <userId>_<firstName>.md - readable conversation transcript

Machine-readable artifacts are stored separately under:

- structured/<userId>_<firstName>.json - structured run data
- structured/manifest.json - run manifest

Codex can summarize the latest run, but the full conversations live in those transcript files.


