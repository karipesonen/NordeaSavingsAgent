# Quickstart

## Run with PowerShell to automate opening 3 terminals and close them (PowerShell available on MacOS as well):
start-demo.ps1
stop-demo.ps1


## OR manually open 3 terminals and run:
cd nora-mobile
npm run dev

cd luca
uv run uvicorn server:app --port 8001 --reload

cd luca
uv run uvicorn api:app --port 8000 --reload


# Copy-Paste Test Prompts:

## Nora main agent, Expense Review, education/resource suggestion, savings-first investment bridge:
I feel like investing is for people who already know what they are doing, and my budget is pretty small. I'd like to set up a monthly savings goal that works with monthly expenses. Can you show me a table of them so we know where to cut?

## Education toward investing:
I found about EUR 150/month I could redirect from spending. I still want to save for my goal, but I also don’t want to wait forever before learning investing. How would you split this between short-term savings and eventually starting with funds? And can you explain why funds would make sense before individual stocks?

## Expense Details: expense reasoning and merchant/category specificity:
Should I cut spending from some habit in particular? What would be the easiest thing to remove? Any specific store or subscription should I look at first?

## Goal Planner and active context:
Build me a plan.

## Price Research and `/price-research`:
I want to buy a Toyota Yaris, how much should I budget?

## Price Research: Product:
I want to save for a MacBook Air M4.

## Tests: Trip Research and original `/research`:
I want to go to Lisbon in the summer.

## Tests: Banking Agent, contacts lookup, confirmation card, CSV write:
Send EUR 15 to mom.

## Tests: Banking Agent and card controls:
Block my card.

## Loan Request: Banking Agent, loan confirmation, monthly payment estimation:
Apply for a personal loan of EUR 3,000 for a car over 24 months.

If asks for details:
Use 5.5% interest, starting two months from now.

## Portfolio Check: Luca Investment Agent and `investments.csv`:
How is my portfolio doing?

## Luca Investment Agent and market lookup.
What's the Apple stock price right now?
