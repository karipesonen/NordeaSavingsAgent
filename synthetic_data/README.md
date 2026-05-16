# Synthetic Data

Fake transactions, personas, and scenarios. No production customer data is used — the brief explicitly forbids it.

Planned contents:

- `personas/` — 2–3 demo personas (e.g., `maya_24_first_job.json`, `elias_21_student.json`) with income, fixed costs, discretionary patterns, life goals
- `transactions/` — matching 3–6 months of transaction history per persona
- `scenarios/` — trigger events for the demo (payday, unexpected expense, subscription detected, market dip, etc.)

Generate deterministically (fixed seed) so demos are reproducible.
