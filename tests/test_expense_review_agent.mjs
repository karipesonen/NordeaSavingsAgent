import assert from 'node:assert/strict';
import { createExpenseReview } from '../agent/tools/expense_review_agent.mjs';

const recurring = [
  { name: 'Housing', amount: 760, cadence: 'monthly' },
  { name: 'Subscriptions', amount: 45, cadence: 'monthly' },
  { name: 'Transport', amount: 80, cadence: 'monthly' },
  { name: 'Insurance', amount: 55, cadence: 'monthly' }
];

const selectedSubscriptions = createExpenseReview({
  userId: 'U005',
  recurringExpenses: recurring,
  latestUserMessage: 'Let us review subscriptions. No automatic changes.',
  financialSnapshot: { safe_to_save_estimate: 35, currency: 'EUR' }
});

assert.equal(selectedSubscriptions.agent, 'expense_review');
assert.equal(selectedSubscriptions.suggested_category, 'Subscriptions');
assert.ok(selectedSubscriptions.markdown_table.includes('| Subscriptions | EUR 45/month |'));
assert.ok(selectedSubscriptions.safety_flags.includes('no_automatic_cancellations'));
assert.ok(selectedSubscriptions.trust_ledger_input.boundaries.some((boundary) => boundary.includes('not an automatic cancellation')));
assert.equal(selectedSubscriptions.review_habit.cadence, 'monthly');

const defaultReview = createExpenseReview({
  userId: 'U002',
  recurringExpenses: recurring,
  financialSnapshot: { safe_to_save_estimate: 50, currency: 'EUR' }
});

assert.equal(defaultReview.suggested_category, 'Subscriptions');
assert.ok(defaultReview.suggested_review_options.includes('Subscriptions'));

const selectedInsurance = createExpenseReview({
  userId: 'U004',
  recurringExpenses: recurring,
  latestUserMessage: 'Review insurance or subscriptions, information only.'
});

assert.equal(selectedInsurance.suggested_category, 'Insurance');
assert.equal(selectedInsurance.possible_savings_opportunity.certainty, 'low');

const emptyReview = createExpenseReview({
  userId: 'U000',
  recurringExpenses: [],
  financialSnapshot: { safe_to_save_estimate: 20, currency: 'EUR' }
});

assert.equal(emptyReview.suggested_category, null);
assert.ok(emptyReview.markdown_table.includes('No clear recurring categories'));
assert.equal(emptyReview.trust_ledger_input.confidence, 'low');
assert.ok(emptyReview.safety_flags.includes('approval_required_before_cancellation'));

console.log('Expense Review Agent tests passed.');
