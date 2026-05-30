import datetime
import json
import os
import sys

from concurrent.futures import ThreadPoolExecutor, as_completed
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

import db_tools as db

# Add parent dir to path so tools/ is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from tools.web_search import search as web_search

DATA_DIR   = os.path.join(os.path.dirname(__file__), "..", "data")
BRIEF_PATH = os.path.join(DATA_DIR, "daily_brief.json")

PROMPT = """You are Nora's daily financial health monitor. All financial numbers have been
pre-computed for you — do NOT re-derive or recalculate anything.

The JSON you receive contains:
- today_spending      : total non-goal expenses today (€)
- daily_avg_30d       : average daily spending over the last 30 days (€)
- spending_ratio      : today_spending / daily_avg_30d  (use this directly)
- today_categories    : breakdown of today's spending by category
- monthly_summary     : income vs spending for the current month
- goals               : each goal has on_track (bool), remaining, needed_per_month, months_left
- balance, credit_score
- web_insights        : live web search results for investment and product goals (may be empty)

Your job: interpret the pre-computed data and write a short, honest daily recap with concrete suggestions.
When web_insights is non-empty, weave relevant findings into observations or suggestions
(e.g. bad news on a held position → suggest reviewing it; a deal found → suggest acting on it).

Status — use spending_ratio and goals[].on_track:
- green  : spending_ratio ≤ 1.0  AND  all goals on_track
- yellow : spending_ratio 1.0–1.5  OR  exactly 1 goal not on_track  OR  a web alert found
- red    : spending_ratio > 1.5   OR  2+ goals not on_track

Reply with ONLY a valid JSON object — no markdown, no explanation:
{
  "status": "green" | "yellow" | "red",
  "headline": "One sentence, max 12 words, use real numbers",
  "observations": ["max 3 — cite actual figures, no filler, no contradictions"],
  "goals": [{"name": "...", "reachable": true | false, "note": "one line with numbers"}],
  "web_insights": [{"goal": "...", "type": "news"|"deal", "summary": "one concise line"}],
  "suggestions": [
    "max 3 specific, actionable suggestions derived from the data — each must reference actual numbers or positions.
     Draw from: overspending categories, goals behind pace, positions with significant P&L, salary vs expense gap,
     web news that warrants action (e.g. bad earnings → consider trimming a position),
     deals found that match a product goal (e.g. iPhone on sale → good time to act)."
  ],
  "advice": "Single most important action right now, or null if status is green and no suggestions are urgent"
}
"""

# Categories that warrant a web search
_INVESTMENT_CATEGORIES = {"investment"}
_PRODUCT_CATEGORIES    = {"electronics"}


def _search_for_goal(goal: dict) -> dict | None:
    """Run a targeted search for one goal. Returns a web insight dict or None."""
    name     = goal["name"]
    category = goal.get("category", "")

    if category in _INVESTMENT_CATEGORIES:
        query        = f"{name} investment news today risks 2026"
        insight_type = "news"
    elif category in _PRODUCT_CATEGORIES:
        query        = f"{name} best price discount deal 2026"
        insight_type = "deal"
    else:
        return None

    try:
        raw = web_search.invoke({"query": query})
        if "[search error]" in raw or "[search returned no results]" in raw:
            return None
        first_result = raw.split("\n\n")[0]
        return {"goal": name, "type": insight_type, "raw": first_result}
    except Exception:
        return None


def _search_for_position(position: dict) -> dict | None:
    """Search for news about an active investment position."""
    ticker = position.get("ticker", "")
    name   = position.get("name", ticker)
    query  = f"{name} {ticker} stock news today 2026"
    try:
        raw = web_search.invoke({"query": query})
        if "[search error]" in raw or "[search returned no results]" in raw:
            return None
        first_result = raw.split("\n\n")[0]
        return {"goal": f"{name} ({ticker})", "type": "news", "raw": first_result}
    except Exception:
        return None


def run_daily_recap() -> dict:
    today       = datetime.date.today().isoformat()
    month_start = datetime.date.today().replace(day=1).isoformat()
    past_30     = (datetime.date.today() - datetime.timedelta(days=30)).isoformat()

    # ── Fetch financial data ───────────────────────────────────────
    all_today       = db.get_transactions("acc_001", from_date=today, to_date=today)
    history         = db.get_transactions("acc_001", from_date=past_30, to_date=today)
    monthly_summary = db.get_balance_summary("acc_001", from_date=month_start, to_date=today)
    goals           = db.get_goals("acc_001", status="active")
    profile         = db.get_profile()

    # ── Pre-compute metrics ────────────────────────────────────────
    def is_real_expense(t):
        return float(t["amount"]) < 0 and t.get("type") != "goal_contribution"

    today_expenses = [t for t in all_today if is_real_expense(t)]
    today_total    = round(sum(abs(float(t["amount"])) for t in today_expenses), 2)

    hist_expenses  = [
        t for t in history
        if is_real_expense(t) and t["timestamp"][:10] != today
    ]
    days_with_data = len({t["timestamp"][:10] for t in hist_expenses}) or 1
    hist_total     = sum(abs(float(t["amount"])) for t in hist_expenses)
    daily_avg      = round(hist_total / days_with_data, 2)
    ratio          = round(today_total / daily_avg, 2) if daily_avg else 0

    goal_analysis = []
    for g in goals:
        target      = float(g["amount_goal"])
        accumulated = float(g["accumulated"])
        remaining   = round(target - accumulated, 2)
        rule_value  = float(g.get("rule_value") or 0)
        try:
            deadline    = datetime.date.fromisoformat(g["deadline"])
            months_left = max(1, (deadline.year - datetime.date.today().year) * 12
                              + deadline.month - datetime.date.today().month)
        except Exception:
            months_left = 1
        needed_per_month = round(remaining / months_left, 2) if months_left else remaining
        on_track = rule_value >= needed_per_month if rule_value > 0 else (remaining <= 0)
        goal_analysis.append({
            "name":             g["name"],
            "category":         g.get("category", ""),
            "target":           target,
            "accumulated":      accumulated,
            "remaining":        remaining,
            "months_left":      months_left,
            "monthly_rule":     rule_value,
            "needed_per_month": needed_per_month,
            "on_track":         on_track,
        })

    # ── Web searches (investment + electronics goals AND active positions, in parallel) ──
    positions       = db.get_investments("acc_001", status="active")
    goal_searchable = [g for g in goal_analysis
                       if g["category"] in _INVESTMENT_CATEGORIES | _PRODUCT_CATEGORIES]
    web_insights_raw: list[dict] = []
    if goal_searchable or positions:
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = (
                [pool.submit(_search_for_goal, g)     for g in goal_searchable] +
                [pool.submit(_search_for_position, p) for p in positions]
            )
            for fut in as_completed(futures):
                result = fut.result()
                if result:
                    web_insights_raw.append(result)

    # ── Build LLM payload ──────────────────────────────────────────
    payload = {
        "analysis_date":   today,
        "today_spending":  today_total,
        "daily_avg_30d":   daily_avg,
        "spending_ratio":  ratio,
        "today_categories": {
            t.get("category", "other"): round(
                sum(abs(float(x["amount"])) for x in today_expenses
                    if x.get("category") == t.get("category")), 2
            )
            for t in today_expenses
        },
        "monthly_summary": monthly_summary,
        "goals":           goal_analysis,
        "balance":         float(profile["balance"]),
        "credit_score":    profile["credit_score"],
        "positions":       positions,
        "web_insights":    web_insights_raw,
    }

    model    = ChatAnthropic(model="claude-haiku-4-5-20251001")
    response = model.invoke([
        SystemMessage(content=PROMPT),
        HumanMessage(content=json.dumps(payload)),
    ])

    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        raw = response.content.strip().lstrip("```json").rstrip("```").strip()
        result = json.loads(raw)

    result["date"]         = today
    result["generated_at"] = datetime.datetime.now().isoformat()
    if "web_insights" not in result:
        result["web_insights"] = []

    with open(BRIEF_PATH, "w") as f:
        json.dump(result, f, indent=2)

    return result


def load_latest_brief() -> dict | None:
    if not os.path.exists(BRIEF_PATH):
        return None
    with open(BRIEF_PATH) as f:
        data = json.load(f)
    # Discard if missing new-format fields
    if "status" not in data or "generated_at" not in data:
        return None
    # Saved briefs are useful for demos even when stale. Mark age instead of
    # triggering background regeneration.
    try:
        age = datetime.datetime.now() - datetime.datetime.fromisoformat(data["generated_at"])
        data["is_stale"] = age.total_seconds() > 70 * 60
    except Exception:
        data["is_stale"] = True
    return data
