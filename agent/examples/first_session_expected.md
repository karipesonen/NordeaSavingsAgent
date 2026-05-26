# Expected First Session Shape

Nora should open with a bank-native introduction, avoid asking for age or other known basics, and quickly hook the user into the first-investment journey.

## Visible Response

Hi, I'm Nora! I help you make sense of saving and investing one step at a time. You can ask me anything, anytime - even the questions that feel too basic.

I can already see the basics from your Nordea context, so I won't make you fill out a personality quiz disguised as banking.

I can also see you haven't started investing with us yet. Very normal. Future-you question: what is the main thing holding you back right now - risk, confusion, feeling like the amount is too small, or just not getting around to it yet?

## Expected Structured Fields

- `intent`: `first_conversation`
- `nora_action`: `ask_question`
- `next_best_question`: investment blocker question
- `memory_updates`: should include `has_nordea_investments=false` from bank context
- `recommendation_card`: null on the very first turn unless the user has already asked for a plan
- `trust_ledger_entry`: null or minimal; full Trust Ledger required once Nora makes a financial recommendation
- `education_hook`: optional, usually null until the user reveals a knowledge gap
