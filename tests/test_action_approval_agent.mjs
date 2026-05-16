import assert from 'node:assert/strict';
import { createActionApproval } from '../agent/tools/action_approval_agent.mjs';

const now = '2026-05-15T00:00:00.000Z';

function stateFrom(result) {
  return result.memory_updates.find((update) => update.field === 'action_state').value;
}

const savingsDraft = createActionApproval({
  userId: 'U005',
  operation: 'create_draft',
  actionType: 'savings_transfer_draft',
  amount: 25,
  currency: 'EUR',
  cadence: 'monthly',
  goalName: 'iPhone + travel fund',
  sourceAgent: 'goal_savings_plan',
  now
});

assert.equal(savingsDraft.agent, 'action_approval');
assert.equal(savingsDraft.execution_mode, 'demo_memory_only');
assert.equal(savingsDraft.action.status, 'pending_approval');
assert.equal(savingsDraft.action.approval_required, true);
assert.equal(stateFrom(savingsDraft).active_drafts.length, 1);
assert.equal(stateFrom(savingsDraft).action_log.length, 1);
assert.match(savingsDraft.action.summary, /Draft EUR 25\/month/);
assert.match(savingsDraft.action.summary, /Not executed/);

const savingsApproved = createActionApproval({
  userId: 'U005',
  operation: 'approve',
  actionType: 'savings_transfer_draft',
  actionId: savingsDraft.action.action_id,
  userMemory: { action_state: stateFrom(savingsDraft) },
  now
});

assert.equal(savingsApproved.action.status, 'approved_in_demo_memory');
assert.equal(stateFrom(savingsApproved).active_drafts.length, 0);
assert.equal(stateFrom(savingsApproved).active_habits.length, 1);
assert.equal(stateFrom(savingsApproved).action_log.length, 2);
assert.match(savingsApproved.action.summary, /Approved in demo memory/);
assert.match(savingsApproved.action.summary, /Not executed/);

const editDraft = createActionApproval({
  userId: 'U005',
  operation: 'edit_draft',
  actionType: 'savings_transfer_draft',
  actionId: savingsDraft.action.action_id,
  amount: 15,
  userMemory: { action_state: stateFrom(savingsDraft) },
  now
});

assert.equal(editDraft.action.status, 'edited');
assert.equal(editDraft.action.amount, 15);
assert.equal(stateFrom(editDraft).action_log.length, 2);

const paused = createActionApproval({
  userId: 'U005',
  operation: 'pause',
  actionType: 'savings_transfer_draft',
  actionId: savingsApproved.action.action_id,
  userMemory: { action_state: stateFrom(savingsApproved) },
  now
});

assert.equal(paused.action.status, 'paused');
assert.equal(stateFrom(paused).active_habits.length, 1);

const resumed = createActionApproval({
  userId: 'U005',
  operation: 'resume',
  actionType: 'savings_transfer_draft',
  actionId: paused.action.action_id,
  userMemory: { action_state: stateFrom(paused) },
  now
});

assert.equal(resumed.action.status, 'resumed');
assert.equal(stateFrom(resumed).active_habits.length, 1);

const blockedInvestment = createActionApproval({
  userId: 'U005',
  operation: 'create_draft',
  actionType: 'investment_draft',
  amount: 25,
  currency: 'EUR',
  userMemory: { financial_understanding: { known_topics: [] } },
  now
});

assert.equal(blockedInvestment.action.status, 'blocked');
assert.ok(blockedInvestment.safety_flags.includes('blocked_by_safety_rule'));
assert.equal(stateFrom(blockedInvestment).active_drafts.length, 0);

const reviewHabit = createActionApproval({
  userId: 'U005',
  operation: 'create_draft',
  actionType: 'expense_review_habit',
  category: 'Subscriptions',
  sourceAgent: 'expense_review',
  now
});

const reviewApproved = createActionApproval({
  userId: 'U005',
  operation: 'approve',
  actionType: 'expense_review_habit',
  actionId: reviewHabit.action.action_id,
  userMemory: { action_state: stateFrom(reviewHabit) },
  now
});

assert.equal(reviewApproved.action.status, 'approved_in_demo_memory');
assert.doesNotMatch(reviewApproved.action.summary, /subscription cancelled|cancelled subscription|transfer completed|investment purchased|shared with family/i);
assert.match(reviewApproved.action.summary, /No cancellation happened/);

const cancellationRequest = createActionApproval({
  userId: 'U005',
  operation: 'create_draft',
  actionType: 'subscription_cancellation_request',
  category: 'Streaming',
  now
});

assert.equal(cancellationRequest.action.status, 'pending_approval');
assert.ok(cancellationRequest.safety_flags.includes('no_automatic_cancellations'));
assert.doesNotMatch(cancellationRequest.action.summary, /subscription cancelled|cancelled subscription/i);
assert.match(cancellationRequest.action.summary, /No cancellation happened/);

const sharedGoal = createActionApproval({
  userId: 'U003',
  operation: 'create_draft',
  actionType: 'shared_goal_draft',
  goalName: 'Down payment',
  allowedPeople: ['mother', 'partner'],
  balance: 1200,
  transactions: [{ amount: -10 }],
  portfolio: { value: 500 },
  now
});

assert.equal(sharedGoal.action.approval_required, true);
assert.equal(sharedGoal.action.allowed_people_count, 2);
assert.doesNotMatch(JSON.stringify(sharedGoal.action), /balance|transactions|portfolio|mother|partner/i);
assert.match(sharedGoal.action.summary, /Nothing shared/);

for (const result of [savingsDraft, savingsApproved, editDraft, paused, resumed, blockedInvestment, reviewApproved, cancellationRequest, sharedGoal]) {
  assert.equal(result.execution_mode, 'demo_memory_only');
  assert.equal(result.action.execution_mode, 'demo_memory_only');
  assert.ok(result.action_log_event);
}

console.log('Action / Approval Agent tests passed.');
