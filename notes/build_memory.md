# Nora Build Memory

Last updated: 2026-05-28

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
- `future_perspective_card`: deterministic support tool that shows one short future-you decision lens for meaningful tradeoffs such as slow goals, approval moments, expense support, or borrowing pressure.

## Luca / Mobile Demo Integration Note

As of 2026-05-30, Luca is present in the local project tree and is partially integrated with `nora-mobile` through HTTP services. Treat it as teammate prototype work that extends the demo, not as the canonical offline Nora architecture.

Luca currently includes:

- a main router agent
- a personal finance analyst reading CSV bank data
- a Firecrawl web search/scraping agent for prices and research
- a yfinance investment/market-data agent for stocks, ETFs, and crypto
- a banking automation agent with human confirmation before CSV write actions
- an aggregator that combines personal finance data with web research
- a FastAPI web research microservice in `luca/server.py` with `/research`, `/price-research`, and `/health`
- a FastAPI graph API in `luca/api.py` with `/chat`, `/confirm`, `/daily-recap`, `/run-daily-recap`, and `/health`
- a daily recap agent in `luca/agents/daily_recap_agent.py`
- richer CSV demo data including loans and investments

Current caveats:

- Luca is still hardcoded around a Sofia / `acc_001` CSV-backed dataset.
- It has no tests yet.
- `learner_agent.py` is empty.
- It contains committed `__pycache__` files that should be cleaned before merging.
- It uses `ChatAnthropic` for most subagents/web/daily recap and `ChatOpenAI` for the router, so `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are required as written.
- It could be edited to use other providers such as OpenAI, OpenRouter, or Ollama, but that provider abstraction is not implemented yet.
- The README calls Firecrawl optional, but `tools/web_search.py` creates `FirecrawlApp(api_key=os.environ["FIRECRAWL_API_KEY"])` at import time, so the full app likely needs `FIRECRAWL_API_KEY` to start unless web tools are refactored/lazily loaded.
- `luca/api.py` tries to load `env.env`, while `luca/model.py` loads `.env`; verify env loading before demo day.

Current `nora-mobile` connection:

- `nora-mobile/server.js` calls Luca web research at `LUCA_URL` default `http://localhost:8001`.
- `nora-mobile/server.js` calls Luca banking/investment/daily recap API at `LUCA_API_URL` default `http://localhost:8000`.
- `trip_research` and `price_research` produce UI cards from Luca web research.
- `banking` and `investment` proxy the latest user message into Luca `/chat`; banking can return a `banking_confirm` card and is confirmed through `/api/nora/confirm`.
- `daily-recap` is fetched once on chat mount and shown if Luca API is running.
- `start-demo.ps1` launches `nora-mobile` on port 3001, Luca web research on 8001, and Luca agent API on 8000. `-Minimal` runs only Nora mobile; `-NoAgent` runs Nora mobile plus web research only.

Recommendation:

- Do not present Luca as fully merged/canonical until the team validates the flows end to end.
- Before committing, clean or ignore `__pycache__` files and confirm whether the generated CSV state should be committed.
- For the final demo, decide whether Luca-powered real price lookup / investment lookup / banking confirmation are part of the main story or optional side demos.

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
-> future perspective card for meaningful goal/action tradeoffs
-> action/approval draft for proposed savings habit
-> expense review
-> action/approval draft for recurring expense review habit when relevant
-> education/risk lesson
-> learning progress
-> snapshot/insights synthesis
-> concise stopping point or next useful move
```

Snapshot/Insights is called after education/progress in the scripted simulation. It appears in transcripts as a `Snapshot / Insights Agent` block.

Future Perspective appears near the first goal/action tradeoff as a `Future Perspective` transcript block. It is not a full subagent and does not replace Snapshot/Insights. It uses known data to show a short future view and one practical choice question; it should not ask the user to describe their whole future life.

Action/Approval appears in transcripts as an `Action / Approval Agent` debug block and replaces loose legacy approval tool usage in Nora's preferred workflow.

User-facing approval moments now render an `Action Confirmation` block in transcripts before the debug JSON. The card shows the action type, draft, status, and normal product options such as Approve, Edit amount or Choose category, and Not now. It should not expose internal agent names in Nora's visible user copy.

## Current Work Focus

As of 2026-05-25, think from a demo perspective rather than a full banking-system perspective. The core architecture is already built; the next work should make the demo feel sharper, more cheerful, and easier to understand.

Already fixed and should not be treated as open backlog:

- Nora's introduction was changed so she no longer literally calls herself "your cheerful money friend." The visible intro now says she helps make money decisions smaller and clearer.
- Goal realism was implemented. Nora now flags safe-but-demotivating timelines, suggests milestones, and avoids presenting a very slow plan as fully solved.
- Action confirmation cards exist in transcripts.
- Loans education exists as a Money Confidence domain.
- Mobile demo card mention guard is implemented so rendered cards are introduced in Nora's visible reply.
- Mobile demo composer wrapping is implemented with an auto-growing textarea, Shift+Enter newlines, and wrapped multiline chat bubbles.
- Mobile demo expense review display is monthly-first: the UI converts `weeklyRoom` and `items[].weeklyAmount` to monthly amounts while keeping weekly values as backend/subagent data.
- Mobile demo expense-review rounding is backend-led: expense cards now include `monthlyRoom` and `items[].monthlyAmount`, and Nora's visible message normalizes near-miss euro amounts to the card's monthly source of truth.
- Mobile demo Tweaks panel now has its own visible bottom-right `Tweaks` button; it no longer relies only on the hidden host/edit-mode protocol trigger.

Current demo-first priorities:

- Nora's main/demo voice now has a light cheeriness tweak: use selective exclamation points on momentum lines and first-message warmth, not on empathy, affordability warnings, or risk cautions.
- Mobile demo readability tweak: consider splitting Nora's longer visible replies into short paragraphs in the chat UI, instead of rendering them as one dense text block.
- Resource suggestions are now integrated into the offline Nora demo after education progress. Next resource-related work should be copy polish or live-chat UI rendering, not basic selector plumbing.
- Future perspective cards are now implemented as a small demo feature for showing how today's choices affect future flexibility.
- Tweak subagent/tool-generated text so education cards, learning progress, snapshots, expense summaries, and goal summaries match Nora's Cheerful Money Friend voice.
- Keep new data generation minimal. Do not invent a large bank backend unless it creates a visible demo moment.
- ~~Mobile demo data improvement note: category-only spending context is too blunt...~~ **Done 2026-05-28.** `nora-mobile/server.js` now extracts top merchants per flexible category (incl. always-on Subscriptions) once at profile load via `topMerchantsByCategory()`, cached in `TEST_PROFILES`. A compact line appended to `<customer_context>` lets Nora say e.g. "Subscriptions — Phone bill, Netflix, Disney+; Food — Lidl, Prisma, S-Market" with zero per-turn latency cost.

## Architecture Decisions Pending

- **Nora personality and prompt separateness** — nora-mobile runs its own stripped-down `NORA_BASE` (~16 lines, "No exclamation marks") from `nora-mobile/agents/prompts.js`. The canonical Cheerful Money Friend persona in `agent/system_prompt.md` (622 lines) is not used by the mobile demo. The mobile sub-agents (`PLAN_BUILDER_SYSTEM`, `EXPENSE_REVIEW_SYSTEM`, `EDUCATION_RISK_SYSTEM`, `ACTION_APPROVAL_SYSTEM`) are also separate JS strings — the canonical agent/subagents/*.md files are only used by the offline simulation tests. Decision needed: (a) keep mobile deliberately sparse as a "polished bank-native copilot" divergence, or (b) port the canonical voice/tone rules into mobile prompts.js. Close the open-question note under "Open Decisions" once decided.

- **Luca integration validation** — Updated 2026-05-30. Luca now has HTTP endpoints and `nora-mobile` has proxy calls for trip research, price research, banking, investment, and daily recap. Pending decision is no longer "add HTTP integration"; it is "validate, polish, and decide which Luca-backed flows belong in the final demo story."

## Open Decisions / Final Demo Reminders

- Reconsider action autonomy before the final demo build: should Nora merely save drafts in demo memory, or should the demo show an authorized autonomous transfer flow after explicit consent? If explored, keep the framing clear: this would represent a future banking feature requiring strong user authorization, legal/compliance design, auditability, and bank-side protection, not the current MVP behavior.
- Consider adding a simple learning progress dashboard for the final demo: a lightweight progress bar / confidence view showing domains such as Starting Safely, Risk Without Panic, Money Habits, Goal Planning, and later Funds or other investment paths. Keep it simple and confidence-oriented, not course-like.
- Keep refining Nora's language before the final demo. Current target voice is Cheerful Money Friend with receipts: friendly, lightly witty, useful, bank-safe, and not repetitive. Exclamation points are allowed sparingly on momentum lines such as "Hi, I'm Nora!", "Let's put numbers on it!", "Good call!", "Gentle it is!", and "Marked!", while empathy and risk lines stay calmer.
- Open tone question: the team is not fully sure the cheerful personality fits the mobile demo. Consider reverting toward a simpler savings-copilot voice like: "Hey Emma — I'm Nora, your savings copilot. No forms, no jargon. What's on your mind today, or what are you trying to save toward?" This may fit better than extra cheer if the demo should feel more polished and bank-native.
- Nora's introduction no longer literally calls herself "your cheerful money friend." Keep the underlying vibe, but describe herself in natural user-facing language: "I help make money decisions smaller and clearer: saving goals, spending patterns, first investing steps, and all the questions that feel too basic to ask. You can ask me anything anytime."
- Important voice consistency note: the first language revamp updated Nora's main prompt and offline wrapper copy, but several tool-generated text surfaces still have older/decided personas. Next copy pass should align learning cards, progress summaries, snapshots, and tool summaries with the Cheerful Money Friend voice.
- Review goal realism. Nora should avoid plans that are technically feasible but emotionally unrealistic, such as saving EUR 30/month for a laptop over several years. It should suggest goals and timelines users are likely to keep up with, and ask whether the user is actually willing to stay patient for a slow plan.
- Resource suggestions are now backed by `agent/resources/education_resources.json` and the deterministic `education_resource_suggestion` tool. Nora suggests one relevant resource after education progress, not during onboarding or every turn.
- Future perspective is implemented as a demo moment, not a full subsystem: trigger when the user faces a tradeoff, approves a habit, or asks what the choice changes over time. Use it sparingly and keep it as a decision lens.

## Latest Implementation Notes

2026-05-30 demo failure fixes:

- Capped Luca web research token usage: `luca/tools/web_search.py` now limits search results to 3 and truncates scraped pages to compact price-relevant text; `luca/server.py` also caps the final synthesis input. This is meant to prevent Toyota Yaris / Lisbon style Anthropic context and TPM failures during the demo.
- `nora-mobile/public/nora-screens.jsx` now hides raw provider errors in trip/price research cards and shows short user-facing fallback text instead of JSON blobs, request IDs, rate-limit URLs, or token-limit internals.
- `luca/agents/bank_automation.py` now formats successful write results into user-facing confirmations instead of returning raw CSV dictionaries after actions like transfers or loan requests.
- Luca banking now supports card blocking/unblocking through `update_card` in `WRITING_TOOLS`, matching the UI/orchestrator behavior instead of saying card management is unavailable while still offering a confirm chip.
- Loan request prompting was softened: the banking agent should ask for practical customer choices such as purpose and repayment period/monthly comfort, while using demo estimates for backend-only fields when needed.

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

2026-05-28 future perspective card pass:

- Added `agent/tools/future_perspective_card.mjs` as a deterministic support tool, not a new LLM subagent.
- The card consumes goal plans, financial snapshots, action drafts, expense review context, education lessons, latest user message, and recommendation history.
- It returns `available` only when there is a meaningful tradeoff, such as a slow goal, down payment milestone choice, action approval, expense support, or borrowing/loan repayment pressure.
- Offline transcripts now render a `Future Perspective` block after the first goal realism moment and before the Action Confirmation card.
- Added `npm run test:future` and offline evaluator checks for one practical choice, no essay prompt, limited use, and no guaranteed-outcome wording.

2026-05-28 nora-mobile demo profile switch pass:

- Added a planned implementation to let `nora-mobile` run either the polished scripted Emma demo or a selected synthetic test profile.
- The mobile backend now summarizes `synthetic_data/generated/nordea_5users_2025.json` into compact customer context instead of sending raw transactions to prompts.
- Added demo profile endpoints and a first-reply endpoint so the frontend can choose between a hardcoded reliable opener and an agent-generated opener.
- Updated mobile prompts away from Emma-only wording; Nora and subagents should use selected customer context and mention all rendered cards in the visible reply.
- Added Tweaks controls for data source, selected profile, and first-reply mode. These are demo controls, not customer-facing phone UI.
- V1 mobile session memory remains local React state and should reset on profile/source/opening-mode changes.

2026-05-28 nora-mobile card mention guard:

- Added a deterministic server-side guard so Nora's visible mobile reply mentions every card rendered in that turn.
- The guard maps internal card types to user-facing labels such as savings plan, spending review, learning card, resource, and confirmation card.
- This prevents resource/article/spending cards from appearing in the UI without Nora introducing them first.

2026-05-28 nora-mobile composer wrapping pass:

- Replaced the mobile chat composer input with an auto-growing textarea so long user messages wrap inside the phone screen.
- Preserved keyboard behavior: Enter sends, Shift+Enter inserts a newline.
- Chat bubbles now preserve user-entered newlines and wrap long words/URLs instead of overflowing.

2026-05-28 nora-mobile monthly-first expense review pass:

- Updated the mobile demo expense review UI to display monthly amounts first, using `weeklyToMonthly(value) = Math.round(value * 4.33)` in `public/nora-tabs.jsx`.
- The compact Spending review chip now shows values like `€360/mo to redirect` instead of `€84/wk`.
- The full Spending tab card now shows `Room to redirect` as a monthly headline, keeps weekly context as a smaller secondary line, and shows expense rows as monthly values.
- No backend, prompt, or subagent schema changes were made; `weeklyRoom` and `items[].weeklyAmount` remain the source data.

2026-05-28 nora-mobile visible Tweaks button pass:

- Fixed the mobile demo controls by adding an always-visible bottom-right `Tweaks` pill button in `public/tweaks-panel.jsx`.
- The existing `TweaksPanel` implementation still supports the external edit-mode host messages, but the demo no longer depends on that hidden trigger for changing profile, opening mode, tags, vibe, or density.

2026-05-28 nora-mobile expense amount consistency pass:

- Added backend monthly display fields for expense review cards: `monthlyRoom` and `items[].monthlyAmount`.
- Updated the Spending card UI to prefer those backend-provided rounded values, with weekly-to-monthly conversion only as fallback for older card data.
- Added a narrow server-side message normalizer so if Nora says a near-miss euro/monthly amount while an expense review card is present, or while a previous expense review amount is carried in `sessionState.lastExpenseReview`, the visible text is corrected to the card's monthly room amount. The normalizer handles common variants such as `€151`, `151 euros`, `151 EUR`, `151€`, and `151/month`.
- Fixed follow-up turns by sending the latest displayed expense review monthly amount from the frontend session state back to the server. Without this, Nora could say `151` on a later turn because the server only saw `[rendered expense_review card]`, not the original `152` value.
- No first-reply, tone, prompt-opening, or goal-plan behavior was changed in this pass.

2026-05-30 nora-mobile Daily Brief demo-control pass:

- Confirmed Snapshot/Insights remains part of the canonical/offline agent stack, not wired into `nora-mobile` in this pass.
- Changed the Luca-backed Daily Brief into an explicit demo-control feature: hidden by default, no chat-mount auto-fetch, and no background regeneration/scraping.
- Added Tweaks controls for `Show daily brief`, `Load saved brief`, and `Refresh brief`; loading reads the saved brief, refreshing intentionally calls Luca regeneration.
- Changed mobile and Luca daily recap GET routes to read-only behavior; refresh now goes through explicit POST `/api/nora/run-daily-recap`.
- Disabled Luca's background daily recap scheduler and changed saved brief loading so stale cached briefs can still display with stale/cached status.
- Default mobile density is now compact and the Density Tweaks control was removed.

2026-05-30 Luca loan confirmation fix:

- Confirmed Luca is currently a single-account prototype: banking, investment, analyst, and daily brief tools read/write `acc_001`, and the Luca router still loads the `("Sofia", "Profile")` store namespace.
- This means selecting another profile in `nora-mobile` changes the mobile Nora/profile context, but Luca-backed workflows still use Sofia/`acc_001` data until an account-context refactor is done.
- Fixed loan confirmation failure where the banking agent could propose `create_loan_request` with a repayment period but no `monthly_amount`; the database tool now estimates monthly payment from loan amount, interest, and start/end dates when `monthly_amount` is missing.

2026-05-30 nora-mobile banking confirmation lifecycle fix:

- Fixed a mobile UI bug where Luca banking confirmation cards became clickable again after leaving chat for a tab and returning.
- Banking confirmation state now lives in `ScreenChat` instead of inside the card component, so answered confirmations remain confirmed/cancelled/processing across tab switches.
- Confirmation clicks no longer append a fake user bubble saying `Confirm` or `Cancel`; only Nora's resulting banking response is added to the chat.

## New Demo To-Do / Notes

- Education should play a larger role in ordinary chat, not only showcase: Nora should more often ask whether the user wants a short explanation that helps with the current topic, and should casually suggest resources when relevant.
- Expense/spending intelligence feels too shallow. The agent should have richer transaction context available, not only store/category labels; include numbers, category totals, recurring patterns, examples, and merchant-level summaries.
- For the interactive demo, likely stick with Sofia for Luca-backed flows because Luca currently uses Sofia/`acc_001` data. If profile switching remains visible, make clear or technically ensure what happens when a non-Sofia profile is selected.
- Check whether `nora-mobile` synthetic profile data and Luca `acc_001` transaction/loan/goal data match well enough for the demo. If not, either align Sofia's data or avoid mixing profile modes with Luca features.
- Consider using Luca data/tools to enrich the mobile spending explanation and interactive demo data access.
- Possibly revise the Daily Brief card if time remains; it is secondary polish after core chat/confirmation/data consistency.

2026-05-30 nora-mobile education + investment presence pass:

- Added light investment-pathway behavior to the mobile demo without creating a new readiness card or investment action draft.
- Expense review cards can now include an `investmentBridge` when there is enough monthly room: most money toward the current goal/buffer, with a smaller future fund habit once short-term money is protected.
- The Spending tab can show a compact `Possible path` split such as `EUR 100 goal · EUR 50 future funds`.
- Nora's orchestration prompt now treats beginner investing as funds/monthly fund habit education, not stock-picking or live market lookup.
- Luca `investment` remains for explicit stock/ETF/crypto/portfolio/current-market research only.
- Education is allowed to appear more often through soft nudges or cards/resources, but with guardrails so banking confirmations and execution flows stay focused.

2026-05-30 data-mode decision / next consideration:

- For the interactive demo, prefer Sofia/Luca as the detailed bank-data mode because Luca tools currently use Sofia/`acc_001`.
- Keep showcase and other synthetic profiles separate unless a later account-context refactor maps each profile to its own Luca account data.
- Avoid silently mixing Emma/Aino/etc. profile copy with Sofia/Luca transactions, loans, banking actions, or daily brief.
- Recommended future demo controls: label modes clearly as `Sofia · detailed bank data`, `Synthetic profile`, and `Showcase · scripted`.
- Rich expense work should use Luca data deterministically for Sofia first: category totals, merchant names, transaction counts, recurring subscriptions, recent/largest examples, loans, and goal contributions.

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

As of 2026-05-28, these passed:

- `npm run test:goal-plan`
- `npm run test:education`
- `npm run test:expense`
- `npm run test:learning`
- `npm run test:resources`
- `npm run test:future`
- `npm run test:snapshot`
- `npm run test:action`
- `npm run test:nora:offline`

Latest passing full offline simulation:

`tests/transcripts/20260528_124744/index.md`

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
