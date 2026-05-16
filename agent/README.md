# Nora Main Agent

Nora is the first concrete vertical slice of the Nordea Savings hackathon agent.

## Files

- `system_prompt.md` - Nora's main system prompt: tone, workflow, guardrails, memory policy, output contract, and examples.
- `config.json` - OpenRouter-oriented runtime config for Nora.
- `memory_schema.json` - compact user memory schema for the demo.
- `tools/nora_tools.schema.json` - tool contracts Nora expects the backend/demo harness to provide.
- `tools/goal_savings_plan_agent.mjs` - deterministic Goal/Savings Plan Agent implementation used by the simulator.
- `tools/education_risk_lesson_agent.mjs` - deterministic Education/Risk Lesson Agent implementation used by the simulator.
- `tools/expense_review_agent.mjs` - deterministic Expense Review Agent implementation used by the simulator.
- `tools/learning_progress_agent.mjs` - deterministic Learning Progress Agent implementation used by the simulator.
- `tools/snapshot_insight_agent.mjs` - deterministic Snapshot/Insights Agent implementation used by the simulator.
- `tools/action_approval_agent.mjs` - deterministic Action/Approval Agent implementation used by the simulator.
- `subagents/goal_savings_plan/` - prompt and contract for the first sub-agent behind Nora.
- `subagents/education_risk_lesson/` - prompt and contract for the education bridge sub-agent.
- `subagents/expense_review/` - prompt and contract for no-shame recurring expense review.
- `subagents/learning_progress/` - prompt and contract for confidence-journey progress tracking.
- `subagents/snapshot_insight/` - prompt and contract for synthesis, recap, next-action, and memory-review support.
- `subagents/action_approval/` - prompt and contract for demo-only action drafts, approvals, pauses, cancellations, and action logs.
- `examples/first_session_input.json` - sample first-session context.
- `examples/first_session_expected.md` - expected opening behavior.

## Build stance

This is intentionally not a full multi-agent backend yet. Nora starts as one strong orchestrator with deterministic tools behind it:

```text
Nora Main Agent
+ user memory file
+ synthetic financial snapshot
+ Goal/Savings Plan Agent
+ Education/Risk Lesson Agent
+ Expense Review Agent
+ Learning Progress Agent
+ Snapshot/Insights Agent
+ Action/Approval Agent
+ Trust Ledger / approval gate
```

That is enough to prove the agentic loop without recreating last year's basic chatbot.

## Required first-session behavior

Nora must:

1. Introduce herself as Nora.
2. Say the user can ask anything anytime.
3. Avoid asking for age/birthday/account basics already known by Nordea context.
4. Hook the user into investment thinking quickly, usually with a blocker question.
5. Ask only one primary question per turn.

## Current workflow

Nora remains the user-facing orchestrator. The Goal/Savings Plan Agent owns contribution and feasibility math. The Education/Risk Lesson Agent owns the first blocker-specific learning card before any investment draft:

```text
Nora
-> reads bank context + memory
-> calls Goal/Savings Plan Agent for savings plans
-> calls Education/Risk Lesson Agent for beginner learning cards
-> calls Expense Review Agent for recurring-expense tables and one review habit
-> calls Learning Progress Agent to track confidence without course-like UX
-> calls Snapshot/Insights Agent to summarize state, choose one next move, or draft a memory check
-> calls Action/Approval Agent to create or update demo-only action records
-> renders plan options, Trust Ledger, approval gate
-> updates memory
```

This keeps the agent demo concrete without adding unnecessary chatty sub-agents.
