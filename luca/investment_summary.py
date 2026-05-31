from __future__ import annotations

import math

import yfinance as yf

import db_tools as db


TICKER_ALIASES = {
    "APPLE": "AAPL",
    "AAPL": "AAPL",
    "NVIDIA": "NVDA",
    "NVDA": "NVDA",
    "VWCE": "VWCE.DE",
    "VWCE.DE": "VWCE.DE",
    "BITCOIN": "BTC-USD",
    "BTC": "BTC-USD",
}

DEMO_AS_OF = "2026-06-01"


def _number(value, fallback=0.0) -> float:
    try:
        if value is None or value == "":
            return fallback
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _money(value) -> float:
    return round(_number(value), 2)


def _pct(value) -> float:
    if not math.isfinite(value):
        return 0.0
    return round(value, 1)


def _compact_market_cap(value) -> str | None:
    n = _number(value, None)
    if n is None:
        return None
    if n >= 1_000_000_000_000:
        return f"{n / 1_000_000_000_000:.2f}T"
    if n >= 1_000_000_000:
        return f"{n / 1_000_000_000:.2f}B"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    return str(round(n))


def _goal_names() -> dict[str, str]:
    return {goal.get("goal_id", ""): goal.get("name", "") for goal in db.get_goals("acc_001")}


def _current_price(position: dict) -> float:
    return _number(position.get("current_price")) or _number(position.get("avg_buy_price"))


def _position_summary(position: dict, goal_names: dict[str, str] | None = None) -> dict:
    quantity = _number(position.get("quantity"))
    avg_buy = _number(position.get("avg_buy_price"))
    current = _current_price(position)
    gain = (current - avg_buy) * quantity
    gain_pct = ((current - avg_buy) / avg_buy * 100) if avg_buy else 0
    goal_id = position.get("goal_id") or ""
    return {
        "ticker": position.get("ticker", ""),
        "name": position.get("name", ""),
        "assetType": position.get("asset_type", ""),
        "quantity": quantity,
        "avgBuyPrice": _money(avg_buy),
        "currentPrice": _money(current),
        "currency": position.get("currency", "EUR"),
        "marketValue": _money(quantity * current),
        "unrealizedGain": _money(gain),
        "unrealizedGainPct": _pct(gain_pct),
        "asOf": DEMO_AS_OF,
        "linkedGoalName": (goal_names or {}).get(goal_id) or None,
    }


def portfolio_summary(account_id: str = "acc_001") -> dict:
    positions = db.get_investments(account_id=account_id, status="active")
    names = _goal_names()
    summarized = [_position_summary(position, names) for position in positions]
    market_value = sum(p["marketValue"] for p in summarized)
    unrealized_gain = sum(p["unrealizedGain"] for p in summarized)
    best = max(summarized, key=lambda p: p["unrealizedGainPct"], default=None)
    linked_goal = next((p["linkedGoalName"] for p in summarized if p.get("linkedGoalName")), None)
    as_of = DEMO_AS_OF if summarized else ""

    nora_summary = "Your portfolio is up overall"
    if best:
        nora_summary += f", mostly because {best['name'] or best['ticker']} has grown strongly"
    nora_summary += ". I would treat this as a check-in moment, not a reason to chase the biggest winner."

    return {
        "title": "Portfolio summary",
        "marketValue": _money(market_value),
        "unrealizedGain": _money(unrealized_gain),
        "asOf": as_of,
        "linkedGoalName": linked_goal,
        "positions": summarized,
        "noraSummary": nora_summary,
    }


def resolve_ticker(raw: str) -> str:
    ticker = (raw or "").strip().upper()
    return TICKER_ALIASES.get(ticker, ticker)


def market_snapshot(ticker: str, account_id: str = "acc_001") -> dict:
    resolved = resolve_ticker(ticker)
    info = yf.Ticker(resolved).info
    positions = db.get_investments(account_id=account_id, status="active")
    holding = next((p for p in positions if p.get("ticker", "").upper() == resolved.upper()), None)

    price = info.get("currentPrice") or info.get("regularMarketPrice")
    if price is None:
        price = info.get("previousClose") or info.get("regularMarketPreviousClose")
    currency = info.get("currency") or ("USD" if resolved.endswith("-USD") else "")

    user_holding = None
    if holding:
        quantity = _number(holding.get("quantity"))
        avg_buy = _number(holding.get("avg_buy_price"))
        current = _number(price) or _current_price(holding)
        gain_pct = ((current - avg_buy) / avg_buy * 100) if avg_buy else 0
        user_holding = {
            "quantity": quantity,
            "estimatedValue": _money(quantity * current),
            "unrealizedGainPct": _pct(gain_pct),
        }

    name = info.get("shortName") or info.get("longName") or (holding or {}).get("name") or resolved
    high = info.get("fiftyTwoWeekHigh")
    low = info.get("fiftyTwoWeekLow")
    near_high = high and _number(price) >= _number(high) * 0.95

    if user_holding:
        if near_high:
            nora_summary = f"{name} is trading near its 52-week high. Since you already hold {user_holding['quantity']:g} shares, this is better framed as a check-in than an automatic buy-more signal."
        else:
            nora_summary = f"{name} is worth checking in context of your existing holding. Price alone is not a reason to buy more."
    else:
        nora_summary = f"{name} is a market lookup, not a buy signal. I would connect it to your time horizon before deciding anything."

    return {
        "ticker": resolved,
        "name": name,
        "price": _money(price),
        "currency": currency,
        "peRatio": _money(info.get("trailingPE")) if info.get("trailingPE") else None,
        "week52High": _money(high) if high else None,
        "week52Low": _money(low) if low else None,
        "marketCap": _compact_market_cap(info.get("marketCap")),
        "userHolding": user_holding,
        "noraSummary": nora_summary,
    }
