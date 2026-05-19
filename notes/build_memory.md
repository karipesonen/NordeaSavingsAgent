# Nora Build Memory

Last updated: 2026-05-19

## Current Product Direction

Nora is a Nordea hackathon demo agent for younger first-time savers/investors. The core value proposition is not another passive chatbot: Nora observes synthetic financial context, proposes one safe next step, explains why through a Trust Ledger, teaches only when useful, and manages draft actions through explicit approval gates.

Hackathon execution is demo memory only. Nora must never imply that real transfers, investments, subscription cancellations, or sharing actions were executed.

Important future-demo reminder: before creating the final demo version, revisit whether Nora should be allowed to autonomously transfer funds in the demo when the user has explicitly authorized it, for example through a contract/checkbox style consent flow and bank-side legal protection for mistakes. The current implementation is intentionally conservative, but the hackathon framing is about imagining the future of banking and building the features the team wants to see.

The desired feel is now Warm Spark / Cheerful Money Friend: warm, practical, lightly witty, gently opinionated, and bank-safe. Nora should make the user feel capable, not tested or sold to. She should make money feel less heavy without becoming unserious.

## Implemented Agent Stack

- `Nora Main Agent`: user-facing orchestrator in `agent/system_prompt.md`.
- `goal_savings_plan_agent`: creates feasibility-aware savings plans, contribution options, adjustment levers, Trust Ledger inputs, and goal memory updates.
- `expense_review_agent`: creates recurring-expense tables and one safe review habit without automatic cancellation or shame framing.
- `education_risk_lesson_agent`: creates short blocker-aware education cards before investment drafts and now covers relevance-triggered loan basics such as student loans, interest, repayment, and borrowing vs saving.
- `learning_progress_agent`: tracks confidence progress with warm visible statuses instead of course-like raw states, including the `Borrowing & Loans` Money Confidence domain when relevant.
- `snapshot_insight_agent`: synthesizes current state, next best action, memory review prompts, and recap-style summaries.
- `action_approval_agent`: owns draft action lifecycle for savings transfers, investment drafts, expense review habits, subscription cancellation requests, shared goals, and goal contribution requests. All execution is `demo_memory_only`.
- `action_confirmation_card`: user-facing transcript/product-card layer that shows pending approval actions as compact cards without requiring a frontend UI.

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

Action/Approval appears in transcripts as an `Action / Approval Agent` debug block and replaces loose legacy approval tool usage in Nora's preferred workflow.

User-facing approval moments now render an `Action Confirmation` block in transcripts before the debug JSON. The card shows the action type, draft, status, and normal product options such as Approve, Edit amount or Choose category, and Not now. It should not expose internal agent names in Nora's visible user copy.

## Current Work Focus

As of 2026-05-19, the next improvement pass is focused on making the demo feel more practical, realistic, and product-like rather than adding many new agents. Today's focus areas:

- Improve Nora's language so it feels more alive, personal, and motivating while staying trustworthy. Implemented the first Warm Spark / Cheerful Money Friend pass in Nora prompt and offline simulation copy.
- Make goals more realistic by challenging very slow or unlikely savings timelines and asking whether the user is willing to stay patient. Implemented a first deterministic goal realism layer in the Goal/Savings Plan Agent.
- Add loans education, especially student loans, interest, repayment, and borrowing vs saving tradeoffs. Implemented as a Money Confidence domain, not a new loan agent or Investment Path.
- Create richer synthetic bank/test data, including more realistic records such as savings accounts, investments, salary dates, subscriptions, and prior bank interactions.
- Clarify action confirmation: current Action/Approval is demo-memory-only; transcripts now show a card-like Action Confirmation block. Future UI can turn the same concept into buttons/cards or a mobile confirmation flow.
- Think through future-self simulation as a possible practical/emotional layer for showing how today's choices affect the user's future.

## Open Decisions / Final Demo Reminders

- Reconsider action autonomy before the final demo build: should Nora merely save drafts in demo memory, or should the demo show an authorized autonomous transfer flow after explicit consent? If explored, keep the framing clear: this would represent a future banking feature requiring strong user authorization, legal/compliance design, auditability, and bank-side protection, not the current MVP behavior.
- Consider adding a simple learning progress dashboard for the final demo: a lightweight progress bar / confidence view showing domains such as Starting Safely, Risk Without Panic, Money Habits, Goal Planning, and later Funds or other investment paths. Keep it simple and confidence-oriented, not course-like.
- Keep refining Nora's language before the final demo. Current target voice is Cheerful Money Friend with receipts: friendly, lightly witty, useful, bank-safe, and not repetitive.
- Nora's introduction no longer literally calls herself "your cheerful money friend." Keep the underlying vibe, but describe herself in natural user-facing language: "I help make money decisions smaller and clearer: saving goals, spending patterns, first investing steps, and all the questions that feel too basic to ask. You can ask me anything anytime."
- Important voice consistency note: the first language revamp updated Nora's main prompt and offline wrapper copy, but several tool-generated text surfaces still have older/decided personas. Next copy pass should align learning cards, progress summaries, snapshots, and tool summaries with the Cheerful Money Friend voice.
- Review goal realism. Nora should avoid plans that are technically feasible but emotionally unrealistic, such as saving EUR 30/month for a laptop over several years. It should suggest goals and timelines users are likely to keep up with, and ask whether the user is actually willing to stay patient for a slow plan.

## Latest Implementation Notes

2026-05-19 loans education pass:

- Added `Borrowing & Loans` as a relevance-triggered Money Confidence domain.
- Broadened the existing Education/Risk Lesson Agent to produce short borrowing education cards for student loans, interest, repayment, borrowing vs saving, and loan pressure.
- Kept the default first demo path unchanged: Starting Safely -> Risk Without Panic -> Money Habits -> Funds.
- Added guardrails so Nora does not recommend taking a loan, estimate eligibility, quote real rates, or recommend specific Nordea loan products.
- Updated Learning Progress so loan-topic progress can become `Started`, `Getting clearer`, or `Applied once` without unlocking investment-path domains by itself.

2026-05-19 language revamp pass:

- Repositioned Nora from "slightly sassy older sibling" to Warm Spark / Cheerful Money Friend.
- Updated Nora's system prompt with voice rules, phrase preferences, and examples for opening, confusion, realistic goal correction, action approval, expense review, and learning progress.
- Updated offline simulation transcript copy so tests visibly show the new tone.
- Added evaluator guardrails for warm first-turn identity and limited overuse of `future-you`, `tiny`, and `boring`.
- Follow-up needed: align subagent/tool-generated text with the new voice. Highest-priority surfaces are `education_risk_lesson_agent` lesson titles/plain answers/key points/future-self prompt, `learning_progress_agent` user-facing summaries, `snapshot_insight_agent` snapshot/next-action wording, `expense_review_agent` `nora_summary`, and `goal_savings_plan_agent` `nora_summary`/recommendation-card copy. These currently still read more like a plain educator/planner than Cheerful Money Friend.
- Updated the first-turn introduction to avoid saying the design label "cheerful money friend" directly in visible user copy. The simulator and evaluator now look for the more natural "money decisions smaller and clearer" framing.

2026-05-19 goal realism pass:

- Added `goal_realism` to the Goal/Savings Plan Agent so plans judge both cashflow feasibility and motivation realism.
- Added simple goal category inference for tech purchases, travel/events, emergency buffers, down payments, transport, moving/housing, retirement, education, and amount-based fallback categories.
- Added horizon-band rules so goals like a laptop over four years are marked as safe starter habits but probably too slow to stay motivating.
- Nora offline transcripts now surface realism nudges such as first milestones and "mathematically possible is not the same as motivating."
- Approval behavior remains a candid nudge: safe starter drafts can still exist, but high motivation-risk goals get `starter_habit_only` or `needs_adjustment` status rather than being presented as fully solved.

## Testing Status

As of 2026-05-19, these passed:

- `npm run test:goal-plan`
- `npm run test:education`
- `npm run test:expense`
- `npm run test:learning`
- `npm run test:snapshot`
- `npm run test:action`
- `npm run test:nora:offline`

Latest passing full offline simulation:

`tests/transcripts/20260519_143559/index.md`

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
