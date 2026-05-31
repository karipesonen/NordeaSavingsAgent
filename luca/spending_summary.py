from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import datetime

import db_tools as db


REVIEWABLE_BASE = {
    "subscriptions",
    "dining_out",
    "shopping",
    "entertainment",
    "health_beauty",
}

CATEGORY_META = {
    "rent": ("Rent", "home"),
    "loan_repayment": ("Loan repayments", "landmark"),
    "savings_goals": ("Goal contributions", "piggy-bank"),
    "subscriptions": ("Subscriptions", "tv"),
    "dining_out": ("Dining out", "utensils"),
    "shopping": ("Shopping", "shopping-bag"),
    "entertainment": ("Entertainment", "ticket"),
    "health_beauty": ("Health & beauty", "heart-pulse"),
    "transport": ("Transport", "car"),
    "groceries": ("Groceries", "shopping-cart"),
    "friends": ("Friends", "users"),
    "other": ("Other", "wallet"),
}


def _money(value: float) -> int:
    return int(round(value))


def _month_label(month: str) -> str:
    dt = datetime.strptime(month + "-01", "%Y-%m-%d")
    return dt.strftime("%B %Y")


def _counterpart(txn: dict) -> str:
    return (
        txn.get("counterpart_name")
        or txn.get("note")
        or txn.get("category")
        or "Unknown"
    ).strip()


def _amount(txn: dict) -> float:
    try:
        return float(txn.get("amount", 0) or 0)
    except ValueError:
        return 0.0


def _is_complete_month(stats: dict) -> bool:
    return (
        stats["salary_count"] > 0
        and stats["recurring_count"] >= 3
        and stats["transaction_count"] >= 12
    )


def _select_period(transactions: list[dict], period: str) -> tuple[str, str, str, str]:
    months: dict[str, dict] = {}
    for txn in transactions:
        ts = txn.get("timestamp", "")
        if len(ts) < 7:
            continue
        month = ts[:7]
        stats = months.setdefault(month, {
            "transaction_count": 0,
            "salary_count": 0,
            "recurring_count": 0,
        })
        stats["transaction_count"] += 1
        if txn.get("type") == "salary":
            stats["salary_count"] += 1
        if txn.get("recurring") == "true":
            stats["recurring_count"] += 1

    selected = None
    if period and period != "latest_complete":
        selected = period[:7]
        selection_rule = "requested month"
    else:
        complete = [month for month, stats in months.items() if _is_complete_month(stats)]
        selected = max(complete) if complete else max(months, default="")
        selection_rule = "latest complete month with salary and recurring activity"

    if not selected:
        return "", "", "", selection_rule

    year, month = [int(part) for part in selected.split("-")]
    last_day = calendar.monthrange(year, month)[1]
    return selected, f"{selected}-01", f"{selected}-{last_day:02d}", selection_rule


def _is_reviewable(category: str, category_txns: list[dict]) -> bool:
    if category in REVIEWABLE_BASE:
        return True
    if category == "transport":
        names = " ".join(_counterpart(txn).lower() for txn in category_txns)
        return any(word in names for word in ["taxi", "uber", "bolt"])
    return False


def _suggested_redirect(category: str, monthly_amount: float, reviewable: bool) -> int:
    if not reviewable:
        return 0

    ratios = {
        "subscriptions": 0.35,
        "dining_out": 0.25,
        "shopping": 0.25,
        "entertainment": 0.30,
        "health_beauty": 0.20,
        "transport": 0.20,
    }
    raw = monthly_amount * ratios.get(category, 0.20)
    rounded = int(round(raw / 5) * 5)
    return max(5, min(_money(monthly_amount), rounded))


def _ranked_merchants(category_txns: list[dict], limit: int = 5) -> list[str]:
    totals: dict[str, float] = defaultdict(float)
    for txn in category_txns:
        name = _counterpart(txn)
        if name:
            totals[name] += abs(_amount(txn))
    return [
        name
        for name, _ in sorted(totals.items(), key=lambda item: item[1], reverse=True)[:limit]
    ]


def build_spending_summary(account_id: str = "acc_001", period: str = "latest_complete") -> dict:
    profile = db.get_profile()
    transactions = db.get_transactions(account_id=account_id)
    selected_month, from_date, to_date, selection_rule = _select_period(transactions, period)
    period_txns = [
        txn for txn in transactions
        if selected_month and txn.get("timestamp", "").startswith(selected_month)
    ]

    monthly_income = sum(_amount(txn) for txn in period_txns if _amount(txn) > 0)
    monthly_expenses = sum(abs(_amount(txn)) for txn in period_txns if _amount(txn) < 0)
    loan_repayments = sum(abs(_amount(txn)) for txn in period_txns if txn.get("category") == "loan_repayment")
    goal_contributions = sum(abs(_amount(txn)) for txn in period_txns if txn.get("category") == "savings_goals")

    by_category: dict[str, list[dict]] = defaultdict(list)
    for txn in period_txns:
        if _amount(txn) < 0:
            by_category[txn.get("category") or "other"].append(txn)

    categories = []
    for category, txns in sorted(by_category.items()):
        monthly_amount = sum(abs(_amount(txn)) for txn in txns)
        recurring_count = sum(1 for txn in txns if txn.get("recurring") == "true")
        reviewable = _is_reviewable(category, txns)
        label, icon = CATEGORY_META.get(category, (category.replace("_", " ").title(), "wallet"))
        merchants = _ranked_merchants(txns)
        categories.append({
            "key": category,
            "label": label,
            "monthly_amount": _money(monthly_amount),
            "transaction_count": len(txns),
            "recurring_count": recurring_count,
            "top_merchants": merchants,
            "suggested_redirect_monthly": _suggested_redirect(category, monthly_amount, reviewable),
            "reviewable": reviewable,
            "icon": icon,
        })

    reviewable_spending = sum(c["monthly_amount"] for c in categories if c["reviewable"])

    largest_flexible_transactions = sorted(
        [
            {
                "date": txn.get("timestamp", "")[:10],
                "category": txn.get("category") or "other",
                "merchant": _counterpart(txn),
                "amount": _money(abs(_amount(txn))),
                "recurring": txn.get("recurring") == "true",
            }
            for txn in period_txns
            if _amount(txn) < 0 and _is_reviewable(txn.get("category") or "other", [txn])
        ],
        key=lambda item: item["amount"],
        reverse=True,
    )[:6]

    recent_examples = [
        {
            "date": txn.get("timestamp", "")[:10],
            "category": txn.get("category") or "other",
            "merchant": _counterpart(txn),
            "amount": _money(abs(_amount(txn))),
        }
        for txn in sorted(period_txns, key=lambda txn: txn.get("timestamp", ""), reverse=True)
        if _amount(txn) < 0 and txn.get("category") not in {"rent", "loan_repayment", "savings_goals"}
    ][:6]

    categories = sorted(
        categories,
        key=lambda c: (
            0 if c["key"] == "subscriptions" else 1,
            -c["suggested_redirect_monthly"],
            -c["monthly_amount"],
        ),
    )

    return {
        "source": "luca_csv",
        "account_id": account_id,
        "customer": {
            "first_name": profile.get("first_name", "Sofia"),
            "last_name": profile.get("last_name", ""),
        },
        "period": {
            "label": _month_label(selected_month) if selected_month else "No period",
            "from": from_date,
            "to": to_date,
            "selection_rule": selection_rule,
        },
        "totals": {
            "monthly_income": _money(monthly_income),
            "monthly_expenses": _money(monthly_expenses),
            "loan_repayments": _money(loan_repayments),
            "goal_contributions": _money(goal_contributions),
            "reviewable_spending": _money(reviewable_spending),
        },
        "categories": categories,
        "largest_flexible_transactions": largest_flexible_transactions,
        "recent_examples": recent_examples,
    }
