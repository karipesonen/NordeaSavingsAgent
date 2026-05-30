"""
daily_recap.py
──────────────
Pure data-aggregation module — no LLM.
Returns a structured dict the API serves as JSON to the frontend.
"""

import datetime
import db_tools as db


def _today() -> str:
    return datetime.date.today().isoformat()


def _days_passed_this_month() -> int:
    today = datetime.date.today()
    return today.day


def get_daily_recap() -> dict:
    today = _today()
    month_start = datetime.date.today().replace(day=1).isoformat()

    # ── Fetch in one pass ──────────────────────────────────────────
    today_txns     = db.get_transactions("acc_001", from_date=today, to_date=today)
    monthly_txns   = db.get_transactions("acc_001", from_date=month_start, to_date=today)
    recurring_txns = db.get_transactions("acc_001", recurring=True)
    goals          = db.get_goals("acc_001", status="active")
    profile        = db.get_profile()

    # ── Today's expenses ──────────────────────────────────────────
    today_expenses = [t for t in today_txns if float(t["amount"]) < 0
                      and t.get("type") != "goal_contribution"]
    today_total = sum(abs(float(t["amount"])) for t in today_expenses)

    by_category: dict[str, float] = {}
    for t in today_expenses:
        cat = t.get("category") or "other"
        by_category[cat] = by_category.get(cat, 0) + abs(float(t["amount"]))

    today_breakdown = [
        {"category": cat, "amount": round(amt, 2)}
        for cat, amt in sorted(by_category.items(), key=lambda x: -x[1])
    ]

    # ── Overspending alert ─────────────────────────────────────────
    # Compare today's total to the daily average so far this month
    monthly_expenses_so_far = sum(
        abs(float(t["amount"])) for t in monthly_txns
        if float(t["amount"]) < 0 and t.get("type") != "goal_contribution"
    )
    days_passed = _days_passed_this_month()
    daily_avg = monthly_expenses_so_far / days_passed if days_passed else 0
    overspending = today_total > daily_avg * 1.5 and today_total > 0

    # ── Upcoming subscriptions (recurring, next 3 days) ────────────
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    in_3_days = (datetime.date.today() + datetime.timedelta(days=3)).isoformat()

    # Use the day-of-month of the last transaction to estimate next occurrence
    upcoming = []
    seen = set()
    for t in recurring_txns:
        if float(t["amount"]) >= 0:
            continue
        name = t.get("counterpart_name") or t.get("note") or "Unknown"
        if name in seen:
            continue
        seen.add(name)
        try:
            last_date = datetime.date.fromisoformat(t["timestamp"][:10])
        except Exception:
            continue
        # Estimate next occurrence: same day next month
        year  = last_date.year + (last_date.month // 12)
        month = (last_date.month % 12) + 1
        try:
            next_due = last_date.replace(year=year, month=month)
        except ValueError:
            # Day doesn't exist in next month (e.g. 31 → clamp to last day)
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            next_due = last_date.replace(year=year, month=month, day=last_day)

        if tomorrow <= next_due.isoformat() <= in_3_days:
            upcoming.append({
                "name":   name,
                "amount": round(abs(float(t["amount"])), 2),
                "date":   next_due.isoformat(),
            })

    upcoming.sort(key=lambda x: x["date"])

    # ── Goals close to deadline ────────────────────────────────────
    goal_alerts = []
    for g in goals:
        try:
            deadline = datetime.date.fromisoformat(g["deadline"])
        except Exception:
            continue
        days_left = (deadline - datetime.date.today()).days
        accumulated = float(g["accumulated"])
        target = float(g["amount_goal"])
        if target > 0 and accumulated < target and days_left <= 30:
            goal_alerts.append({
                "name":       g["name"],
                "days_left":  days_left,
                "remaining":  round(target - accumulated, 2),
            })

    return {
        "date":             today,
        "balance":          float(profile["balance"]),
        "today_total":      round(today_total, 2),
        "today_breakdown":  today_breakdown,
        "daily_avg":        round(daily_avg, 2),
        "overspending":     overspending,
        "upcoming_subscriptions": upcoming,
        "goal_alerts":      goal_alerts,
    }
