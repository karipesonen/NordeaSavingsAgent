# Nora Build Memory

Last updated: 2026-05-15

## Current Product Direction

Nora is a Nordea hackathon demo agent for younger first-time savers/investors. The core value proposition is not another passive chatbot: Nora observes synthetic financial context, proposes one safe next step, explains why through a Trust Ledger, teaches only when useful, and manages draft actions through explicit approval gates.

Hackathon execution is demo memory only. Nora must never imply that real transfers, investments, subscription cancellations, or sharing actions were executed.

Important future-demo reminder: before creating the final demo version, revisit whether Nora should be allowed to autonomously transfer funds in the demo when the user has explicitly authorized it, for example through a contract/checkbox style consent flow and bank-side legal protection for mistakes. The current implementation is intentionally conservative, but the hackathon framing is about imagining the future of banking and building the features the team wants to see.

The desired feel is a calm, slightly sassy, no-shame financial older sibling. Nora should make the user feel capable, not tested or sold to.

## Implemented Agent Stack

- `Nora Main Agent`: user-facing orchestrator in `agent/system_prompt.md`.
- `goal_savings_plan_agent`: creates feasibility-aware savings plans, contribution options, adjustment levers, Trust Ledger inputs, and goal memory updates.
- `expense_review_agent`: creates recurring-expense tables and one safe review habit without automatic cancellation or shame framing.
- `education_risk_lesson_agent`: creates short blocker-aware education cards before investment drafts.
- `learning_progress_agent`: tracks confidence progress with warm visible statuses instead of course-like raw states.
- `snapshot_insight_agent`: synthesizes current state, next best action, memory review prompts, and recap-style summaries.
- `action_approval_agent`: owns draft action lifecycle for savings transfers, investment drafts, expense review habits, subscription cancellation requests, shared goals, and goal contribution requests. All execution is `demo_memory_only`.

## Memory Architecture Decision

The demo does not need a full dedicated long-term memory agent.

Runtime memory remains controlled by `update_user_memory` and `agent/memory_schema.json`. Specialist agents may suggest memory updates when they have explicit or useful inferred facts.

Action/Approval stores simulated action state under `action_state` with `active_drafts`, `active_habits`, and `action_log`. Approved actions are saved in demo memory only; they are not real bank execution state.

Snapshot/Insights helps memory only by:

- detecting low-confidence, stale, or potentially changing inferred facts
- drafting a short confirmation question
- keeping stable bank-known basics out of correction prompts

Snapshot/Insights must not silently save memory. Its own output should keep `memory_updates: []`; Nora may ask the user for confirmation and only then call `update_user_memory`.

## Current Workflow

Offline demo flow:

```text
Nora onboarding
-> goal/savings plan
-> action/approval draft for proposed savings habit
-> expense review
-> action/approval draft for recurring expense review habit when relevant
-> education/risk lesson
-> learning progress
-> snapshot/insights synthesis
-> concise stopping point or next useful move
```

Snapshot/Insights is called after education/progress in the scripted simulation. It appears in transcripts as a `Snapshot / Insights Agent` block.

Action/Approval appears in transcripts as an `Action / Approval Agent` block and replaces loose legacy approval tool usage in Nora's preferred workflow.

## Open Decisions / Final Demo Reminders

- Reconsider action autonomy before the final demo build: should Nora merely save drafts in demo memory, or should the demo show an authorized autonomous transfer flow after explicit consent? If explored, keep the framing clear: this would represent a future banking feature requiring strong user authorization, legal/compliance design, auditability, and bank-side protection, not the current MVP behavior.
- Consider adding a simple learning progress dashboard for the final demo: a lightweight progress bar / confidence view showing domains such as Starting Safely, Risk Without Panic, Money Habits, Goal Planning, and later Funds or other investment paths. Keep it simple and confidence-oriented, not course-like.

## Testing Status

As of 2026-05-15, these passed:

- `npm run test:goal-plan`
- `npm run test:education`
- `npm run test:expense`
- `npm run test:learning`
- `npm run test:snapshot`
- `npm run test:action`
- `npm run test:nora:offline`

Latest passing full offline simulation:

`tests/transcripts/20260515_202519/index.md`

All five synthetic personas passed:

- Aino
- Pekka
- Emma
- Mikael
- Sofia

## Practical Build Notes

- The project is not currently a git repository.
- Framework-level agent-building rules live in `C:\Users\karip\agent-lab`.
- For agent creation/design work, use `C:\Users\karip\agent-lab\agents\architect\system_prompt.md` by default.
- Project-specific decisions belong here under `notes/`, not in `agent-lab`.
- Runtime demo memory belongs under `agent_state/` and should be resettable between test runs.
