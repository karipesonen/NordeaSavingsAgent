# Concept — distilled from the brief and prior ideation

> Source: `../brief/NordeaSavingsProject.pdf` (brief) + `../brief/FutureInterfacesProjectChat.md` (prior ideation, especially lines 4922–5350 and 5381–5580).

## One-line pitch

An agent-led savings coach for young first-time investors: not a chatbot you ask, but a guide that looks at your situation, proposes one safe next step, explains why, and waits for your confirmation.

## Target user

Young adult (≈18–28), first-time saver/investor, using Nordea's mobile app. Emotionally hesitant about investing, intimidated by jargon, doesn't trust finfluencers, wants someone to tell them "here is the small safe thing you could do now."

## Problem

- Investing feels intimidating, opaque, and salesy.
- Current banking UIs present buttons and numbers — the user has to know what to ask.
- Competitors (Nordnet, Avanza, Revolut) beat Nordea on UX and brand among young users.

## Agent personality

**Calm, slightly sassy, no-shame, financially responsible older sibling.**

Tone rules:
- Warm, not childish
- Direct, not scary
- Playful, not unserious
- Trustworthy, not salesy
- Never pressures the user to invest
- Always gives an escape route

Example phrasing that works: *"Your current situation is workable."* / *"We are not cancelling joy today. Joy has rights."* / *"Perfect. That is much easier than someone who learned investing from three TikToks and a cousin named Jere."*

## What makes it agentic (not a chatbot)

The chatbot version: waits for the user to ask "how do I invest?"
The agentic version: **leads** with —
1. Observe synthetic financial state (safe-to-save, upcoming bills, subscription waste)
2. Interpret what matters now
3. Propose one small, safe next action
4. Explain the reasoning (Trust Ledger — "here's the data I used, here's my confidence, here's what I'm *not* claiming")
5. Ask for approval
6. Update plan based on the response

The user stays in control. The agent does the preparation.

## Recommended demo shape (from prior ideation)

A combined interface with three pieces, stitched together by a single agent loop:

1. **Financial Cockpit** — current state at a glance (runway, emergency buffer, safe-to-save, upcoming risk, investment readiness)
2. **Smart Recommendation Card** — one agent-generated card, e.g. *"You can safely save €20 this week."*
3. **Trust Ledger panel** — inspect *why*: data used, assumptions, confidence, what the agent is *not* claiming

Agentic loop:
```
observe financial state
    ↓
interpret what matters
    ↓
generate recommendation
    ↓
explain reasoning (Trust Ledger)
    ↓
ask user approval
    ↓
update plan + learn from response
```

## Opening move

The strongest opener (from the ideation chat) to lead with when the user first opens the chat:

> **Your current situation is workable.**
> After your usual expenses, you seem to have around €X left this month. That does not mean we throw it all into investments like a finance influencer with studio lighting.
>
> A better first step is to decide what this money is supposed to do:
> 1. protect you,
> 2. grow slowly,
> 3. or stay flexible.
>
> Want to sort this €X into those three buckets?

Why this works: personal, data-driven, not salesy, creates a next step, avoids shame, leads the conversation, connects cleanly to the dashboard.

## Constraints from the brief

- **No production data.** Synthetic data only, plus public Nordea info.
- **Regulated domain.** The agent is a **co-pilot, not an advisor**. It educates, proposes, and explains — it does not prescribe specific products or guarantee outcomes. All transfers/purchases require explicit user approval.
- **Trust is the differentiator.** Transparency (Trust Ledger) is not a feature add — it's the core.
- **Demo quality.** The audience is Nordea leadership, so: small, polished, clearly agentic > broad, unfinished, feature-list.

## What to avoid

- A prettier dashboard with the same numbers
- A chatbot that answers "what is investing?"
- A stock-picking bot
- Gamified risky trading
- AI that hides risk behind cute visuals
- AI that pressures users to invest more
- Sales-voiced product pushing

## Open questions to resolve next

- Team size and role split?
- Demo format: web prototype, Figma with a scripted agent, or fully interactive with a real LLM backend?
- Voice interface in scope, or text only?
- Do we build all three interface pieces (Cockpit + Card + Trust Ledger) or pick one for the MVP and stub the others?
- Which synthetic persona do we lead the demo with?
