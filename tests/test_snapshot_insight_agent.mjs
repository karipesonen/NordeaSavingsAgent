import assert from 'node:assert/strict';
import { createSnapshotInsight } from '../agent/tools/snapshot_insight_agent.mjs';

const financialSnapshot = {
  monthly_income_estimate: 1600,
  available_this_month: 220,
  safe_to_save_estimate: 45,
  currency: 'EUR',
  confidence: 'medium'
};

const goalPlan = {
  agent: 'goal_savings_plan',
  goal_name: 'first investment buffer',
  target_amount: 500,
  requires_adjustment: false,
  recommended_option: { monthly_contribution: 45 },
  recommendation_card: { amount: 45 },
  trust_ledger_input: { confidence: 'medium' }
};

const expenseReview = {
  agent: 'expense_review',
  suggested_category: 'Subscriptions',
  trust_ledger_input: { confidence: 'medium' }
};

const educationLesson = {
  agent: 'education_risk_lesson',
  topic: 'What investment risk means'
};

const learningProgress = {
  agent: 'learning_progress',
  stage: 'money_confidence',
  domain: 'Risk Without Panic',
  visible_status: 'Applied once',
  next_domain_suggestion: 'Funds',
  user_facing_summary: 'You used the risk idea by keeping short-term money savings-first.'
};

const memory = {
  user: { first_name: 'Sofia', age: 25 },
  investment_journey: {
    has_nordea_investments: false,
    risk_comfort: 'low',
    first_investment_blockers: ['risk']
  },
  financial_understanding: {
    preferred_content_format: 'short_card'
  },
  goals: [
    {
      id: 'goal-1',
      name: 'first investment buffer',
      target_amount: 500,
      currency: 'EUR',
      monthly_contribution: 45,
      status: 'draft'
    }
  ],
  learning_progress: {
    stage: 'money_confidence',
    domains: {},
    topic_history: [],
    interested_domains: [],
    next_suggested_domain: 'Funds'
  },
  memory_events: [
    { field: 'user.age', value: 25, source: 'bank_context', confidence: 'high' },
    { field: 'investment_journey.risk_comfort', value: 'low', source: 'inferred_from_conversation', confidence: 'medium' }
  ]
};

const current = createSnapshotInsight({
  userId: 'U005',
  mode: 'current_snapshot',
  bankContext: { user_first_name: 'Sofia', age: 25, currency: 'EUR' },
  userMemory: memory,
  financialSnapshot,
  goalPlan,
  expenseReview,
  educationLesson,
  learningProgress
});

assert.equal(current.agent, 'snapshot_insight');
assert.equal(current.mode, 'current_snapshot');
assert.equal(current.snapshot_card.money_state.safe_to_save_estimate, 45);
assert.equal(current.snapshot_card.goal_state.active_goal, 'first investment buffer');
assert.equal(current.snapshot_card.habit_state.expense_review_habit, 'Inspect subscriptions monthly before changing anything.');
assert.equal(current.snapshot_card.learning_state.next_domain_suggestion, 'Funds');
assert.ok(current.insights.some((insight) => insight.type === 'learning'));

const next = createSnapshotInsight({
  userId: 'U005',
  mode: 'next_best_action',
  userMemory: memory,
  financialSnapshot,
  goalPlan,
  expenseReview,
  educationLesson,
  learningProgress
});

assert.equal(next.next_best_action.action_type, 'show_lesson');
assert.match(next.next_best_action.label, /Funds/);

const unrealisticGoal = createSnapshotInsight({
  userId: 'U003',
  mode: 'next_best_action',
  userMemory: memory,
  financialSnapshot,
  goalPlan: { ...goalPlan, goal_name: 'down payment', requires_adjustment: true },
  expenseReview,
  educationLesson,
  learningProgress
});

assert.equal(unrealisticGoal.next_best_action.action_type, 'propose_plan');
assert.match(unrealisticGoal.next_best_action.label, /milestone|shared contribution/i);

const review = createSnapshotInsight({
  userId: 'U005',
  mode: 'memory_review',
  userMemory: {
    ...memory,
    memory_events: [
      ...memory.memory_events,
      { field: 'financial_understanding.preferred_content_format', value: 'short_card', source: 'inferred_from_conversation', confidence: 'low' }
    ]
  },
  financialSnapshot
});

assert.equal(review.memory_review.confirmation_needed, true);
assert.equal(review.memory_updates.length, 0);
assert.ok(review.memory_review.uncertain_or_stale.some((item) => item.field === 'financial_understanding.preferred_content_format'));
assert.doesNotMatch(review.memory_review.suggested_question, /age|birthday|date of birth/i);

const bankKnownOnly = createSnapshotInsight({
  userId: 'U005',
  mode: 'memory_review',
  bankContext: { user_first_name: 'Sofia', age: 25 },
  userMemory: {
    user: { first_name: 'Sofia', age: 25 },
    investment_journey: { has_nordea_investments: false, first_investment_blockers: [] },
    memory_events: [
      { field: 'user.age', value: 25, source: 'bank_context', confidence: 'low' }
    ]
  },
  financialSnapshot
});

assert.equal(bankKnownOnly.memory_review.confirmation_needed, false);
assert.equal(bankKnownOnly.memory_review.suggested_question, null);

const recap = createSnapshotInsight({
  userId: 'U005',
  mode: 'monthly_recap',
  userMemory: memory,
  financialSnapshot,
  goalPlan,
  expenseReview,
  educationLesson,
  learningProgress
});

assert.equal(recap.mode, 'monthly_recap');
assert.ok(recap.safety_flags.includes('recap_uses_available_demo_data_only'));
assert.doesNotMatch(JSON.stringify(recap), /internal_status|unseen|seen|explored/);

console.log('Snapshot / Insights Agent tests passed.');
