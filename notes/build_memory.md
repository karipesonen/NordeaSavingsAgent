# Nora Build Memory

Last updated: 2026-05-26

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
- `education_resources.json`: lightweight curated education resource database with articles/videos mapped to Nora learning domains. Stored at `agent/resources/education_resources.json`.
- `education_resource_suggestion`: deterministic support tool that selects one curated article/video/podcast after an education-progress moment, using domain/topic, preferred format, readiness, and recommendation history.

## Luca Prototype Branch Note

The GitHub branch `feature/agent_structure` contains a separate `luca/` Python/LangGraph prototype. It is not integrated into Nora's current JS demo stack.

Luca currently includes:

- a main router agent
- a personal finance analyst reading CSV bank data
- a Firecrawl web search/scraping agent for prices and research
- a yfinance investment/market-data agent for stocks, ETFs, and crypto
- a banking automation agent with human confirmation before CSV write actions
- an aggregator that combines personal finance data with web research

Current caveats:

- Treat Luca as experimental teammate work, not final Nora architecture.
- It is hardcoded around a Sofia / `acc_001` CSV-backed dataset.
- It has no tests yet.
- `learner_agent.py` is empty.
- It contains committed `__pycache__` files that should be cleaned before merging.
- It uses `ChatAnthropic` throughout, so `ANTHROPIC_API_KEY` is required as written.
- It could be edited to use other providers such as OpenAI, OpenRouter, or Ollama, but that provider abstraction is not implemented yet.
- The README calls Firecrawl optional, but `tools/web_search.py` creates `FirecrawlApp(api_key=os.environ["FIRECRAWL_API_KEY"])` at import time, so the full app likely needs `FIRECRAWL_API_KEY` to start unless web tools are refactored/lazily loaded.

Recommendation:

- Do not merge Luca into `main` blindly. Keep it on the feature branch until the teammate confirms it is ready.
- For Nora's final demo, consider extracting only useful ideas: resource/web lookup, market lookup, CSV fake-bank patterns, or confirmation-flow ideas.
- Avoid confusing the repo with two competing architectures unless the team intentionally wants multiple prototype systems.

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

As of 2026-05-25, think from a demo perspective rather than a full banking-system perspective. The core architecture is already built; the next work should make the demo feel sharper, more cheerful, and easier to understand.

Already fixed and should not be treated as open backlog:

- Nora's introduction was changed so she no longer literally calls herself "your cheerful money friend." The visible intro now says she helps make money decisions smaller and clearer.
- Goal realism was implemented. Nora now flags safe-but-demotivating timelines, suggests milestones, and avoids presenting a very slow plan as fully solved.
- Action confirmation cards exist in transcripts.
- Loans education exists as a Money Confidence domain.

Current demo-first priorities:

- Nora's main/demo voice now has a light cheeriness tweak: use selective exclamation points on momentum lines and first-message warmth, not on empathy, affordability warnings, or risk cautions.
- Resource suggestions are now integrated into the offline Nora demo after education progress. Next resource-related work should be copy polish or live-chat UI rendering, not basic selector plumbing.
- Possibly add a future-self mode as a demo feature for showing how today's choices affect future flexibility.
- Tweak subagent/tool-generated text so education cards, learning progress, snapshots, expense summaries, and goal summaries match Nora's Cheerful Money Friend voice.
- Keep new data generation minimal. Do not invent a large bank backend unless it creates a visible demo moment.

## Open Decisions / Final Demo Reminders

- Reconsider action autonomy before the final demo build: should Nora merely save drafts in demo memory, or should the demo show an authorized autonomous transfer flow after explicit consent? If explored, keep the framing clear: this would represent a future banking feature requiring strong user authorization, legal/compliance design, auditability, and bank-side protection, not the current MVP behavior.
- Consider adding a simple learning progress dashboard for the final demo: a lightweight progress bar / confidence view showing domains such as Starting Safely, Risk Without Panic, Money Habits, Goal Planning, and later Funds or other investment paths. Keep it simple and confidence-oriented, not course-like.
- Keep refining Nora's language before the final demo. Current target voice is Cheerful Money Friend with receipts: friendly, lightly witty, useful, bank-safe, and not repetitive. Exclamation points are allowed sparingly on momentum lines such as "Hi, I'm Nora!", "Let's put numbers on it!", "Good call!", "Gentle it is!", and "Marked!", while empathy and risk lines stay calmer.
- Nora's introduction no longer literally calls herself "your cheerful money friend." Keep the underlying vibe, but describe herself in natural user-facing language: "I help make money decisions smaller and clearer: saving goals, spending patterns, first investing steps, and all the questions that feel too basic to ask. You can ask me anything anytime."
- Important voice consistency note: the first language revamp updated Nora's main prompt and offline wrapper copy, but several tool-generated text surfaces still have older/decided personas. Next copy pass should align learning cards, progress summaries, snapshots, and tool summaries with the Cheerful Money Friend voice.
- Review goal realism. Nora should avoid plans that are technically feasible but emotionally unrealistic, such as saving EUR 30/month for a laptop over several years. It should suggest goals and timelines users are likely to keep up with, and ask whether the user is actually willing to stay patient for a slow plan.
- Resource suggestions are now backed by `agent/resources/education_resources.json` and the deterministic `education_resource_suggestion` tool. Nora suggests one relevant resource after education progress, not during onboarding or every turn.
- Consider future-self mode as a demo moment, not necessarily a full new subsystem: trigger when the user faces a tradeoff, approves a habit, or asks what the choice changes over time.

## Latest Implementation Notes

2026-05-25 education resources pass:

- Created `agent/resources/education_resources.json` with 12 curated resources: 8 article links and 4 video/podcast links.
- Domains covered: Starting Safely, Risk Without Panic, Money Habits, Goal Planning, Funds, and Borrowing & Loans.
- Chose The Investor's Podcast article as the better dollar-cost averaging resource over the LAT London alternative because it is newer and has clearer DCA vs lump sum / market timing structure. Nora should still avoid any profit-heavy framing from the source and present DCA as consistency/timing-risk reduction.
- Stored video resources as YouTube URLs plus local transcript paths in `C:\Users\karip\Downloads\Transcripts` when available; full transcripts were not copied into the repo.
- Missing resource metadata noted in the JSON: the time-horizon video transcript has no usable body, some article dates are unavailable, Diamond CU page content could not be directly fetched, and some YouTube creator/duration metadata is missing.

2026-05-25 education resource suggestion system:

- Added `agent/tools/education_resource_suggestion.mjs` as a deterministic selector over the curated resource JSON.
- The selector matches by learning domain first, then topic/trigger keywords, next suggested domain, preferred format, readiness, and previous resource suggestions.
- Resource suggestions are now rendered in offline transcripts as a compact `Resource Suggestion` block and a debug `Education Resource Suggestion Tool` JSON block.
- Offline simulation calls resource suggestion after the learning progress moment and before Snapshot/Insights, so resources appear occasionally without turning Nora into a school app.
- Added `npm run test:resources` and updated the offline evaluator to require at least one domain-matched resource suggestion in full demo transcripts.

2026-05-26 cheeriness punctuation pass:

- Added a prompt rule that Nora can use one well-placed exclamation point for upbeat transitions, confirmations, and first-message warmth.
- Updated offline demo copy from flat momentum lines such as "Hi, I'm Nora.", "Let's put numbers on it.", "Gentle it is.", and "Marked." to the slightly warmer versions with exclamation points.
- Kept `Totally fair.` and `Let's make the choices visible.` calmer by default because they are empathy/clarity lines, not momentum lines.

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

As of 2026-05-26, these passed:

- `npm run test:goal-plan`
- `npm run test:education`
- `npm run test:expense`
- `npm run test:learning`
- `npm run test:resources`
- `npm run test:snapshot`
- `npm run test:action`
- `npm run test:nora:offline`

Latest passing full offline simulation:

`tests/transcripts/20260526_145913/index.md`

All five synthetic personas passed:

- Aino
- Pekka
- Emma
- Mikael
- Sofia

## Practical Build Notes

- The project is now a git repository. `main` is the stable Nora demo branch; `feature/agent_structure` contains the separate Luca prototype branch.
- Framework-level agent-building rules live in `C:\Users\karip\agent-lab`.
- For agent creation/design work, use `C:\Users\karip\agent-lab\agents\architect\system_prompt.md` by default.
- Project-specific decisions belong here under `notes/`, not in `agent-lab`.
- Runtime demo memory belongs under `agent_state/` and should be resettable between test runs.
