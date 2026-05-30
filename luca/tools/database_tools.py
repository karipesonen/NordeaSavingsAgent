
from datetime import date
from math import pow

from langchain_core.tools import tool
import db_tools as db

@tool
def get_profile() -> dict:
    """Return the customer's full profile: name, IBAN, balance, credit score, etc."""
    return db.get_profile()

@tool
def update_profile(email: str = None, phone: str = None,
                   address: str = None, city: str = None,
                   postal_code: str = None) -> dict:
    """Update editable profile fields: email, phone, address, city, postal_code.
    Only pass the fields that need to change."""
    fields = {k: v for k, v in locals().items() if v is not None}
    return db.update_profile(**fields)

@tool
def get_cards() -> list:
    """Return all debit and credit cards linked to the account."""
    return db.get_cards()

@tool
def update_card(card_id: str, status: str = None, daily_limit: str = None,
                monthly_limit: str = None, contactless_enabled: str = None) -> dict:
    """Update a card's settings. status: 'active'|'blocked'|'expired'.
    daily_limit/monthly_limit as string e.g. '500.00'. contactless_enabled: 'true'|'false'."""
    fields = {k: v for k, v in {
        "status": status, "daily_limit": daily_limit,
        "monthly_limit": monthly_limit, "contactless_enabled": contactless_enabled,
    }.items() if v is not None}
    return db.update_card(card_id, **fields)

@tool
def get_contacts() -> list:
    """Return all saved contacts (friends, family, payees)."""
    return db.get_contacts(owner_id="acc_001")

@tool
def get_contact(contact_id: str) -> dict:
    """Return a single contact by contact_id e.g. 'con_002'."""
    return db.get_contact(contact_id)

@tool
def add_contact(nickname: str, linked_iban: str,
                relationship: str = "other", trusted: bool = False) -> dict:
    """Add a new contact/payee. relationship: 'friend'|'family'|'landlord'|'other'."""
    return db.add_contact(owner_id="acc_001", nickname=nickname,
                          linked_iban=linked_iban, relationship=relationship,
                          trusted=trusted)

@tool
def update_contact(contact_id: str, nickname: str = None, relationship: str = None,
                   trusted: str = None, linked_iban: str = None) -> dict:
    """Edit an existing contact's nickname, relationship, trusted flag, or IBAN."""
    fields = {k: v for k, v in locals().items() if k != "contact_id" and v is not None}
    return db.update_contact(contact_id, **fields)

@tool
def delete_contact(contact_id: str) -> dict:
    """Permanently delete a contact by contact_id."""
    return db.delete_contact(contact_id)

@tool
def get_goals(status: str = None) -> list:
    """Return savings goals. Optionally filter by status: 'active'|'completed'."""
    return db.get_goals(owner_id="acc_001", status=status)

@tool
def get_goal(goal_id: str) -> dict:
    """Return a single savings goal by goal_id e.g. 'goal_001'."""
    return db.get_goal(goal_id)

@tool
def create_goal(name: str, description: str, category: str,
                amount_goal: float, rule_value: float = 0.0,
                rule_type: str = "fixed_amount", rule_period: str = "monthly",
                deadline: str = "", shared_with_contacts: str = "") -> dict:
    """Create a new savings goal. category: 'travel'|'electronics'|'emergency'|'event'|'investment'.
    rule_type: 'fixed_amount'|'percentage'. deadline: 'YYYY-MM-DD'."""
    return db.create_goal(owner_id="acc_001", name=name, description=description,
                          category=category, amount_goal=amount_goal,
                          rule_type=rule_type, rule_value=rule_value,
                          rule_period=rule_period, deadline=deadline,
                          shared_with_contacts=shared_with_contacts)

@tool
def update_goal(goal_id: str, name: str = None, description: str = None,
                amount_goal: str = None, deadline: str = None,
                status: str = None, rule_value: str = None) -> dict:
    """Update a goal's metadata. Set status='completed' to close it manually."""
    fields = {k: v for k, v in locals().items() if k != "goal_id" and v is not None}
    return db.update_goal(goal_id, **fields)

@tool
def contribute_to_goal(goal_id: str, amount: float) -> dict:
    """Move funds into a savings goal wallet and log the transaction automatically."""
    return db.contribute_to_goal(goal_id, amount)

@tool
def delete_goal(goal_id: str) -> dict:
    """Permanently delete a savings goal."""
    return db.delete_goal(goal_id)

@tool
def get_transactions(category: str = None, txn_type: str = None,
                     from_date: str = None, to_date: str = None,
                     recurring: bool = None, limit: int = None) -> list:
    """Retrieve transactions with optional filters.
    category: 'groceries'|'dining_out'|'rent'|'income'|etc.
    txn_type: 'salary'|'payment'|'transfer'|'goal_contribution'.
    from_date/to_date: 'YYYY-MM-DD'. limit: max rows to return."""
    return db.get_transactions(account_id="acc_001", category=category,
                               txn_type=txn_type, from_date=from_date,
                               to_date=to_date, recurring=recurring, limit=limit)

@tool
def get_transaction(transaction_id: str) -> dict:
    """Return a single transaction by its ID e.g. 'txn_042'."""
    return db.get_transaction(transaction_id)

@tool
def make_transaction(amount: float, counterpart_name: str,
                     counterpart_account_or_iban: str = "",
                     txn_type: str = "payment", category: str = "other",
                     note: str = "", recurring: bool = False,
                     status: str = "completed") -> dict:
    """Record a new transaction and update the balance.
    amount is signed: negative = expense (e.g. -45.00), positive = income (e.g. +3200.00).
    txn_type: 'payment'|'transfer'|'salary'|'refund'. status: 'completed'|'pending'."""
    return db.make_transaction(account_id="acc_001", amount=amount,
                               counterpart_name=counterpart_name,
                               counterpart_account_or_iban=counterpart_account_or_iban,
                               txn_type=txn_type, category=category,
                               note=note, recurring=recurring, status=status)

@tool
def update_transaction_status(transaction_id: str, status: str) -> dict:
    """Update a transaction status: 'completed'|'pending'|'cancelled'|'failed'."""
    return db.update_transaction_status(transaction_id, status)

@tool
def get_balance_summary(from_date: str = None, to_date: str = None) -> dict:
    """Return income/spending summary grouped by category for a given period.
    from_date/to_date: 'YYYY-MM-DD'. Omit both for all-time summary."""
    return db.get_balance_summary("acc_001", from_date=from_date, to_date=to_date)


@tool
def get_investments(status: str = None) -> list:
    """Return investment positions. Optionally filter by status: 'active'|'sold'."""
    return db.get_investments(account_id="acc_001", status=status)

@tool
def get_investment(investment_id: str) -> dict:
    """Return a single investment position by investment_id e.g. 'inv_001'."""
    return db.get_investment(investment_id)

@tool
def get_loans(status: str = None) -> list:
    """Return all loans for the account. Optionally filter by status: 'accepted' | 'requested'."""
    return db.get_loans(account_id="acc_001", status=status)
 
@tool
def get_loan(loan_id: str) -> dict:
    """Return a single loan by loan_id e.g. 'loan_001'."""
    return db.get_loan(loan_id)
 
@tool
def create_loan_request(
    total_amount: float,
    interest_rate: float,
    description: str,
    monthly_amount: float = None,
    date_starting: str = "",
    date_ending: str = "",
    currency: str = "EUR",
) -> dict:
    """Submit a new loan request. Status will be set to 'requested' until accepted.
    description examples: 'Mortgage', 'Car loan', 'Personal loan – renovation'.
    date_starting / date_ending format: 'YYYY-MM-DD'. Leave empty if not yet known.
    monthly_amount is optional when date_starting/date_ending are provided; it will be estimated."""
    if monthly_amount is None:
        monthly_amount = _estimate_monthly_loan_payment(
            total_amount=total_amount,
            annual_interest_rate=interest_rate,
            date_starting=date_starting,
            date_ending=date_ending,
        )
    return db.create_loan_request(
        account_id="acc_001",
        total_amount=total_amount,
        interest_rate=interest_rate,
        monthly_amount=monthly_amount,
        description=description,
        date_starting=date_starting,
        date_ending=date_ending,
        currency=currency,
    )


def _estimate_monthly_loan_payment(
    total_amount: float,
    annual_interest_rate: float,
    date_starting: str = "",
    date_ending: str = "",
) -> float:
    """Estimate a monthly payment from dates for demo loan requests."""
    try:
        principal = float(total_amount)
        annual_rate = float(annual_interest_rate or 0)
    except Exception as exc:
        raise ValueError("total_amount and interest_rate must be numeric") from exc

    if not date_ending:
        raise ValueError("monthly_amount is required unless date_ending is provided")

    try:
        start = date.fromisoformat(date_starting) if date_starting else date.today()
        end = date.fromisoformat(date_ending)
    except Exception as exc:
        raise ValueError("date_starting/date_ending must use YYYY-MM-DD") from exc

    months = max(1, (end.year - start.year) * 12 + (end.month - start.month))
    monthly_rate = annual_rate / 100 / 12
    if monthly_rate <= 0:
        return round(principal / months, 2)
    payment = principal * monthly_rate / (1 - pow(1 + monthly_rate, -months))
    return round(payment, 2)
 
WRITING_TOOLS = [
    update_profile,
    update_card,
    add_contact, update_contact, delete_contact,
    create_goal, update_goal, contribute_to_goal, delete_goal,
    make_transaction,
    create_loan_request
]

READING_TOOLS = [
    get_profile,
    get_cards,
    get_contacts, get_contact,
    get_goals, get_goal,
    get_transactions, get_transaction,
    get_balance_summary,
    get_loans, get_loan,
    get_investments, get_investment,
]


ALL_TOOLS = [
    get_profile, update_profile,
    get_cards, update_card,
    get_contacts, get_contact, add_contact, update_contact, delete_contact,
    get_goals, get_goal, create_goal, update_goal, contribute_to_goal, delete_goal,
    get_transactions, get_transaction, make_transaction,
    update_transaction_status, get_balance_summary,
    get_loans, get_loan, create_loan_request
]
