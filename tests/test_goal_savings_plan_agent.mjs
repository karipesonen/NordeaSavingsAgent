import assert from 'node:assert/strict';
import { createGoalSavingsPlan, extractTargetAmount } from '../agent/tools/goal_savings_plan_agent.mjs';

function snapshot(safeToSave) {
  return {
    monthly_income_estimate: 3000,
    available_this_month: safeToSave * 4,
    safe_to_save_estimate: safeToSave,
    currency: 'EUR',
    recurring_expenses_detected: [],
    confidence: 'medium'
  };
}

assert.equal(extractTargetAmount('Laptop (€1,200)'), 1200);
assert.equal(extractTargetAmount('Down payment (EUR 30000)'), 30000);
assert.equal(extractTargetAmount('Emergency fund + travel'), null);

const emmaPlan = createGoalSavingsPlan({
  userId: 'U001',
  goalName: 'Laptop (€1,200)',
  riskComfort: 'low',
  currency: 'EUR',
  financialSnapshot: snapshot(30)
});

assert.equal(emmaPlan.agent, 'goal_savings_plan');
assert.equal(emmaPlan.target_amount, 1200);
assert.equal(emmaPlan.recommended_option.monthly_contribution, 25);
assert.equal(emmaPlan.recommended_option.timeline_months, 48);
assert.equal(emmaPlan.requires_adjustment, false);
assert.equal(emmaPlan.recommendation_card.status, 'draft_requires_approval');

const ainoPlan = createGoalSavingsPlan({
  userId: 'U003',
  goalName: 'Down payment (€30,000)',
  riskComfort: 'medium',
  currency: 'EUR',
  financialSnapshot: snapshot(285)
});

assert.equal(ainoPlan.target_amount, 30000);
assert.equal(ainoPlan.requires_adjustment, true);
assert.equal(ainoPlan.overall_feasibility, 'unrealistic');
assert.equal(ainoPlan.recommendation_card.status, 'needs_adjustment');
assert.ok(ainoPlan.levers.some((lever) => lever.includes('shared-goal')));
assert.ok(ainoPlan.nora_summary.includes('starter habit'));

const noTargetPlan = createGoalSavingsPlan({
  userId: 'U004',
  goalName: 'Retirement fund + cabin',
  riskComfort: 'high',
  currency: 'EUR',
  financialSnapshot: snapshot(335)
});

assert.equal(noTargetPlan.target_amount, null);
assert.equal(noTargetPlan.requires_adjustment, false);
assert.equal(noTargetPlan.trust_ledger_input.confidence, 'low');
assert.ok(noTargetPlan.options.every((option) => option.timeline_months === null));

console.log('Goal/Savings Plan Agent tests passed.');
