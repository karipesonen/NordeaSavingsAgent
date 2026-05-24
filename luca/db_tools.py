"""
bank_tools.py
─────────────
CRUD toolset for the personal finance agent.
Each function operates on the CSV files defined in DATA_DIR and returns
plain Python dicts / lists so they can be fed directly to an LLM tool-call
response.

Files managed:
  profile.csv       – single customer record
  cards.csv         – debit / credit cards
  contacts.csv      – saved contacts / payees
  goals.csv         – savings goals / wallets
  transactions.csv  – full transaction ledger
"""

import csv
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

# ── Config ────────────────────────────────────────────────────────────────────

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

PATHS = {
    "profile":      os.path.join(DATA_DIR, "./data/profile.csv"),
    "cards":        os.path.join(DATA_DIR, "./data/cards.csv"),
    "contacts":     os.path.join(DATA_DIR, "./data/contacts.csv"),
    "goals":        os.path.join(DATA_DIR, "./data/goals.csv"),
    "transactions": os.path.join(DATA_DIR, "./data/transactions.csv"),
}

# ── Internal helpers ───────────────────────────────────────────────────────────

def _read(name: str) -> list[dict]:
    with open(PATHS[name], newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _write(name: str, rows: list[dict]) -> None:
    if not rows:
        return
    with open(PATHS[name], "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _next_id(rows: list[dict], prefix: str) -> str:
    """Generate next sequential ID like txn_071, goal_006, etc."""
    existing = [
        int(r[list(r.keys())[0]].replace(prefix, ""))
        for r in rows
        if r[list(r.keys())[0]].startswith(prefix)
    ]
    next_n = max(existing, default=0) + 1
    return f"{prefix}{next_n:03d}"


# ══════════════════════════════════════════════════════════════════════════════
# PROFILE
# ══════════════════════════════════════════════════════════════════════════════

def get_profile() -> dict:
    """Return the customer profile."""
    rows = _read("profile")
    return rows[0] if rows else {}


def update_profile(**fields) -> dict:
    """
    Update one or more profile fields.
    Allowed fields: email, phone, address, city, postal_code.
    Returns the updated profile.

    Example:
        update_profile(email="new@email.fi", phone="+358409999999")
    """
    EDITABLE = {"email", "phone", "address", "city", "postal_code"}
    invalid = set(fields) - EDITABLE
    if invalid:
        raise ValueError(f"Field(s) not editable: {invalid}. Editable: {EDITABLE}")

    rows = _read("profile")
    for key, value in fields.items():
        rows[0][key] = value
    _write("profile", rows)
    return rows[0]


# ══════════════════════════════════════════════════════════════════════════════
# CARDS
# ══════════════════════════════════════════════════════════════════════════════

def get_cards(account_id: Optional[str] = None) -> list[dict]:
    """
    Return all cards, optionally filtered by account_id.

    Example:
        get_cards()
        get_cards(account_id="acc_001")
    """
    rows = _read("cards")
    if account_id:
        rows = [r for r in rows if r["account_id"] == account_id]
    return rows


def update_card(card_id: str, **fields) -> dict:
    """
    Update card settings.
    Allowed fields: status (active/blocked/expired), daily_limit,
                    monthly_limit, contactless_enabled.
    Returns the updated card row.

    Example:
        update_card("card_001", status="blocked")
        update_card("card_002", daily_limit="1000.00", contactless_enabled="false")
    """
    EDITABLE = {"status", "daily_limit", "monthly_limit", "contactless_enabled"}
    invalid = set(fields) - EDITABLE
    if invalid:
        raise ValueError(f"Field(s) not editable: {invalid}")

    rows = _read("cards")
    match = next((r for r in rows if r["card_id"] == card_id), None)
    if not match:
        raise KeyError(f"Card '{card_id}' not found.")

    for key, value in fields.items():
        match[key] = str(value)
    _write("cards", rows)
    return match


# ══════════════════════════════════════════════════════════════════════════════
# CONTACTS
# ══════════════════════════════════════════════════════════════════════════════

def get_contacts(owner_id: Optional[str] = None) -> list[dict]:
    """
    Return all contacts, optionally filtered by owner_id.

    Example:
        get_contacts()
        get_contacts(owner_id="acc_001")
    """
    rows = _read("contacts")
    if owner_id:
        rows = [r for r in rows if r["owner_id"] == owner_id]
    return rows


def get_contact(contact_id: str) -> dict:
    """
    Return a single contact by contact_id.

    Example:
        get_contact("con_002")
    """
    rows = _read("contacts")
    match = next((r for r in rows if r["contact_id"] == contact_id), None)
    if not match:
        raise KeyError(f"Contact '{contact_id}' not found.")
    return match


def add_contact(
    owner_id: str,
    nickname: str,
    linked_iban: str,
    relationship: str = "other",
    trusted: bool = False,
    linked_account_id: str = "",
) -> dict:
    """
    Add a new contact.
    Returns the newly created contact row.

    Example:
        add_contact(
            owner_id="acc_001",
            nickname="Sara",
            linked_iban="FI2133334444555501",
            relationship="friend",
            trusted=True,
        )
    """
    rows = _read("contacts")
    new_id = _next_id(rows, "con_")
    new_row = {
        "contact_id":        new_id,
        "owner_id":          owner_id,
        "linked_account_id": linked_account_id,
        "linked_iban":       linked_iban,
        "nickname":          nickname,
        "relationship":      relationship,
        "trusted":           str(trusted).lower(),
    }
    rows.append(new_row)
    _write("contacts", rows)
    return new_row


def update_contact(contact_id: str, **fields) -> dict:
    """
    Update contact details.
    Allowed fields: nickname, relationship, trusted, linked_iban.
    Returns the updated contact row.

    Example:
        update_contact("con_005", nickname="Julia B", trusted="true")
    """
    EDITABLE = {"nickname", "relationship", "trusted", "linked_iban"}
    invalid = set(fields) - EDITABLE
    if invalid:
        raise ValueError(f"Field(s) not editable: {invalid}")

    rows = _read("contacts")
    match = next((r for r in rows if r["contact_id"] == contact_id), None)
    if not match:
        raise KeyError(f"Contact '{contact_id}' not found.")

    for key, value in fields.items():
        match[key] = str(value)
    _write("contacts", rows)
    return match


def delete_contact(contact_id: str) -> dict:
    """
    Delete a contact by contact_id.
    Returns the deleted row.

    Example:
        delete_contact("con_003")
    """
    rows = _read("contacts")
    match = next((r for r in rows if r["contact_id"] == contact_id), None)
    if not match:
        raise KeyError(f"Contact '{contact_id}' not found.")

    _write("contacts", [r for r in rows if r["contact_id"] != contact_id])
    return match


# ══════════════════════════════════════════════════════════════════════════════
# GOALS
# ══════════════════════════════════════════════════════════════════════════════

def get_goals(owner_id: Optional[str] = None, status: Optional[str] = None) -> list[dict]:
    """
    Return goals, optionally filtered by owner_id and/or status.

    Example:
        get_goals()
        get_goals(owner_id="acc_001", status="active")
    """
    rows = _read("goals")
    if owner_id:
        rows = [r for r in rows if r["owner_id"] == owner_id]
    if status:
        rows = [r for r in rows if r["status"] == status]
    return rows


def get_goal(goal_id: str) -> dict:
    """
    Return a single goal by goal_id.

    Example:
        get_goal("goal_001")
    """
    rows = _read("goals")
    match = next((r for r in rows if r["goal_id"] == goal_id), None)
    if not match:
        raise KeyError(f"Goal '{goal_id}' not found.")
    return match


def create_goal(
    owner_id: str,
    name: str,
    description: str,
    category: str,
    amount_goal: float,
    currency: str = "EUR",
    rule_type: str = "fixed_amount",
    rule_value: float = 0.0,
    rule_period: str = "monthly",
    deadline: str = "",
    shared_with_contacts: str = "",
    wallet_iban: str = "",
) -> dict:
    """
    Create a new savings goal / wallet.
    Returns the newly created goal row.

    Example:
        create_goal(
            owner_id="acc_001",
            name="New Bike",
            description="Buy a cargo bike",
            category="transport",
            amount_goal=1200.00,
            rule_value=100.00,
            deadline="2026-06-01",
        )
    """
    rows = _read("goals")
    new_id = _next_id(rows, "goal_")
    new_row = {
        "goal_id":              new_id,
        "owner_id":             owner_id,
        "name":                 name,
        "description":          description,
        "category":             category,
        "amount_goal":          f"{amount_goal:.2f}",
        "accumulated":          "0.00",
        "currency":             currency,
        "rule_type":            rule_type,
        "rule_value":           f"{rule_value:.2f}",
        "rule_period":          rule_period,
        "shared_with_contacts": shared_with_contacts,
        "status":               "active",
        "created_date":         _now_iso()[:10],
        "deadline":             deadline,
        "wallet_iban":          wallet_iban,
    }
    rows.append(new_row)
    _write("goals", rows)
    return new_row


def update_goal(goal_id: str, **fields) -> dict:
    """
    Update goal metadata or status.
    Allowed fields: name, description, amount_goal, deadline,
                    shared_with_contacts, status, rule_type,
                    rule_value, rule_period.
    Returns the updated goal row.

    Example:
        update_goal("goal_002", deadline="2025-11-01", amount_goal="2600.00")
        update_goal("goal_004", status="completed")
    """
    EDITABLE = {
        "name", "description", "amount_goal", "deadline",
        "shared_with_contacts", "status", "rule_type", "rule_value", "rule_period",
    }
    invalid = set(fields) - EDITABLE
    if invalid:
        raise ValueError(f"Field(s) not editable: {invalid}")

    rows = _read("goals")
    match = next((r for r in rows if r["goal_id"] == goal_id), None)
    if not match:
        raise KeyError(f"Goal '{goal_id}' not found.")

    for key, value in fields.items():
        match[key] = str(value)
    _write("goals", rows)
    return match


def contribute_to_goal(goal_id: str, amount: float) -> dict:
    """
    Add funds to a goal's accumulated balance.
    Also appends a goal_contribution transaction automatically.
    Returns the updated goal row.

    Example:
        contribute_to_goal("goal_001", 200.00)
    """
    rows = _read("goals")
    match = next((r for r in rows if r["goal_id"] == goal_id), None)
    if not match:
        raise KeyError(f"Goal '{goal_id}' not found.")
    if match["status"] != "active":
        raise ValueError(f"Goal '{goal_id}' is not active (status: {match['status']}).")

    accumulated = float(match["accumulated"]) + amount
    match["accumulated"] = f"{accumulated:.2f}"

    # Auto-complete if target reached
    if accumulated >= float(match["amount_goal"]):
        match["status"] = "completed"

    _write("goals", rows)

    # Log the transaction
    make_transaction(
        account_id=match["owner_id"],
        counterpart_account_or_iban=match["wallet_iban"],
        counterpart_name="",
        amount=-abs(amount),
        currency=match["currency"],
        txn_type="goal_contribution",
        category="savings_goals",
        goal_id=goal_id,
        note=f"Contribution to '{match['name']}'",
        recurring=False,
    )
    return match


def delete_goal(goal_id: str) -> dict:
    """
    Delete a goal by goal_id.
    Returns the deleted row.

    Example:
        delete_goal("goal_005")
    """
    rows = _read("goals")
    match = next((r for r in rows if r["goal_id"] == goal_id), None)
    if not match:
        raise KeyError(f"Goal '{goal_id}' not found.")

    _write("goals", [r for r in rows if r["goal_id"] != goal_id])
    return match


# ══════════════════════════════════════════════════════════════════════════════
# TRANSACTIONS
# ══════════════════════════════════════════════════════════════════════════════

def get_transactions(
    account_id: Optional[str] = None,
    category: Optional[str] = None,
    txn_type: Optional[str] = None,
    goal_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    recurring: Optional[bool] = None,
    limit: Optional[int] = None,
) -> list[dict]:
    """
    Return transactions with optional filters.

    Params:
        account_id  – filter by account
        category    – e.g. "groceries", "dining_out", "savings_goals"
        txn_type    – e.g. "salary", "payment", "transfer", "goal_contribution"
        goal_id     – filter by linked goal
        from_date   – ISO date string "YYYY-MM-DD" (inclusive)
        to_date     – ISO date string "YYYY-MM-DD" (inclusive)
        recurring   – True/False
        limit       – return only the N most recent rows

    Example:
        get_transactions(category="dining_out", from_date="2025-04-01")
        get_transactions(recurring=True, limit=10)
    """
    rows = _read("transactions")

    if account_id:
        rows = [r for r in rows if r["account_id"] == account_id]
    if category:
        rows = [r for r in rows if r["category"] == category]
    if txn_type:
        rows = [r for r in rows if r["type"] == txn_type]
    if goal_id:
        rows = [r for r in rows if r["goal_id"] == goal_id]
    if recurring is not None:
        flag = "true" if recurring else "false"
        rows = [r for r in rows if r["recurring"] == flag]
    if from_date:
        rows = [r for r in rows if r["timestamp"][:10] >= from_date]
    if to_date:
        rows = [r for r in rows if r["timestamp"][:10] <= to_date]
    if limit:
        rows = rows[-limit:]

    return rows


def get_transaction(transaction_id: str) -> dict:
    """
    Return a single transaction by transaction_id.

    Example:
        get_transaction("txn_042")
    """
    rows = _read("transactions")
    match = next((r for r in rows if r["transaction_id"] == transaction_id), None)
    if not match:
        raise KeyError(f"Transaction '{transaction_id}' not found.")
    return match


def make_transaction(
    account_id: str,
    amount: float,
    counterpart_name: str,
    counterpart_account_or_iban: str = "",
    currency: str = "EUR",
    txn_type: str = "payment",
    category: str = "other",
    goal_id: str = "",
    card_id: str = "",
    note: str = "",
    recurring: bool = False,
    status: str = "completed",
) -> dict:
    """
    Append a new transaction and update the account balance.
    amount is signed: positive = money in, negative = money out.
    Returns the newly created transaction row.

    Example:
        make_transaction(
            account_id="acc_001",
            amount=-45.00,
            counterpart_name="Ravintola Kuu",
            category="dining_out",
            card_id="card_001",
            note="Dinner with Mikko",
        )
        make_transaction(
            account_id="acc_001",
            amount=3200.00,
            counterpart_name="Reaktor Oy",
            txn_type="salary",
            category="income",
            recurring=True,
            note="June salary",
        )
    """
    rows = _read("transactions")
    new_id = _next_id(rows, "txn_")

    new_row = {
        "transaction_id":             new_id,
        "account_id":                 account_id,
        "counterpart_account_or_iban": counterpart_account_or_iban,
        "counterpart_name":           counterpart_name,
        "amount":                     f"{amount:.2f}",
        "currency":                   currency,
        "type":                       txn_type,
        "category":                   category,
        "goal_id":                    goal_id,
        "card_id":                    card_id,
        "recurring":                  str(recurring).lower(),
        "note":                       note,
        "status":                     status,
        "timestamp":                  _now_iso(),
    }
    rows.append(new_row)
    _write("transactions", rows)

    # Keep balance in sync on the profile
    _update_balance(account_id, amount)

    return new_row


def update_transaction_status(transaction_id: str, status: str) -> dict:
    """
    Update the status of a transaction (e.g. pending → completed, or cancelled).
    Returns the updated transaction row.

    Example:
        update_transaction_status("txn_006", "completed")
        update_transaction_status("txn_006", "cancelled")
    """
    VALID = {"pending", "completed", "cancelled", "failed"}
    if status not in VALID:
        raise ValueError(f"Invalid status '{status}'. Choose from: {VALID}")

    rows = _read("transactions")
    match = next((r for r in rows if r["transaction_id"] == transaction_id), None)
    if not match:
        raise KeyError(f"Transaction '{transaction_id}' not found.")

    old_status = match["status"]
    match["status"] = status
    _write("transactions", rows)

    # If a pending tx is now completed, apply it to the balance
    if old_status == "pending" and status == "completed":
        _update_balance(match["account_id"], float(match["amount"]))

    return match


def get_balance_summary(account_id: str, from_date: Optional[str] = None, to_date: Optional[str] = None) -> dict:
    """
    Return a spending/income summary for a given period.

    Example:
        get_balance_summary("acc_001", from_date="2025-05-01", to_date="2025-05-31")
    """
    txns = get_transactions(account_id=account_id, from_date=from_date, to_date=to_date)
    total_in  = sum(float(t["amount"]) for t in txns if float(t["amount"]) > 0)
    total_out = sum(float(t["amount"]) for t in txns if float(t["amount"]) < 0)

    by_category: dict[str, float] = {}
    for t in txns:
        amt = float(t["amount"])
        cat = t["category"]
        by_category[cat] = by_category.get(cat, 0.0) + amt

    profile = get_profile()
    return {
        "account_id":   account_id,
        "from_date":    from_date or "all time",
        "to_date":      to_date   or "all time",
        "current_balance": float(profile.get("balance", 0)),
        "total_in":     round(total_in,  2),
        "total_out":    round(total_out, 2),
        "net":          round(total_in + total_out, 2),
        "by_category":  {k: round(v, 2) for k, v in sorted(by_category.items())},
        "n_transactions": len(txns),
    }


# ── Internal: balance sync ─────────────────────────────────────────────────────

def _update_balance(account_id: str, delta: float) -> None:
    """Add delta (signed) to the profile balance."""
    rows = _read("profile")
    for r in rows:
        if r["account_id"] == account_id:
            r["balance"] = f"{float(r['balance']) + delta:.2f}"
    _write("profile", rows)
# ══════════════════════════════════════════════════════════════════════════════
# LOANS
# ══════════════════════════════════════════════════════════════════════════════

PATHS["loans"] = os.path.join(DATA_DIR, "./data/loans.csv")

def get_loans(account_id: Optional[str] = None, status: Optional[str] = None) -> list[dict]:
    """
    Return all loans, optionally filtered by account_id and/or status.

    Example:
        get_loans()
        get_loans(account_id="acc_001", status="accepted")
        get_loans(status="requested")
    """
    rows = _read("loans")
    if account_id:
        rows = [r for r in rows if r["account_id"] == account_id]
    if status:
        rows = [r for r in rows if r["status"] == status]
    return rows


def get_loan(loan_id: str) -> dict:
    """
    Return a single loan by loan_id.

    Example:
        get_loan("loan_001")
    """
    rows = _read("loans")
    match = next((r for r in rows if r["loan_id"] == loan_id), None)
    if not match:
        raise KeyError(f"Loan '{loan_id}' not found.")
    return match


def create_loan_request(
    account_id: str,
    total_amount: float,
    interest_rate: float,
    monthly_amount: float,
    description: str,
    date_starting: str = "",
    date_ending: str = "",
    currency: str = "EUR",
) -> dict:
    """
    Submit a new loan request. Status is set to 'requested' until accepted.
    description examples: 'Mortgage', 'Car loan', 'Personal loan – renovation'.
    date_starting / date_ending format: 'YYYY-MM-DD'. Leave empty if not yet known.
    Returns the newly created loan row.

    Example:
        create_loan_request(
            account_id="acc_001",
            total_amount=8000.00,
            interest_rate=5.50,
            monthly_amount=150.00,
            description="Personal loan – new furniture",
            date_starting="2026-06-01",
            date_ending="2031-06-01",
        )
    """
    rows = _read("loans")
    new_id = _next_id(rows, "loan_")
    new_row = {
        "loan_id":          new_id,
        "account_id":       account_id,
        "status":           "requested",
        "total_amount":     f"{total_amount:.2f}",
        "interest_rate":    f"{interest_rate:.2f}",
        "monthly_amount":   f"{monthly_amount:.2f}",
        "date_starting":    date_starting,
        "date_ending":      date_ending,
        "description":      description,
        "currency":         currency,
        "accumulated_paid": "0.00",
    }
    rows.append(new_row)
    _write("loans", rows)
    return new_row

# ══════════════════════════════════════════════════════════════════════════════
# Quick smoke-test
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import json

    print("=== Profile ===")
    print(json.dumps(get_profile(), indent=2))

    print("\n=== Active Goals ===")
    for g in get_goals(status="active"):
        pct = round(float(g["accumulated"]) / float(g["amount_goal"]) * 100, 1)
        print(f"  {g['name']:25s}  {g['accumulated']:>8} / {g['amount_goal']} EUR  ({pct}%)")

    print("\n=== Last 5 transactions ===")
    for t in get_transactions(limit=5):
        print(f"  {t['timestamp'][:10]}  {t['counterpart_name'] or t['category']:25s}  {float(t['amount']):>10.2f} {t['currency']}")

    print("\n=== May 2025 summary ===")
    print(json.dumps(get_balance_summary("acc_001", "2025-05-01", "2025-05-31"), indent=2))