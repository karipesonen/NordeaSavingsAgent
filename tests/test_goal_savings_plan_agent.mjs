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
assert.equal(emmaPlan.recommendation_card.status, 'starter_habit_only');
assert.equal(emmaPlan.goal_realism.goal_category, 'tech_purchase');
assert.equal(emmaPlan.goal_realism.timeline_realism, 'too_slow');
assert.equal(emmaPlan.goal_realism.motivation_risk, 'high');
assert.equal(emmaPlan.goal_realism.realism_label, 'Starter habit only');
assert.ok(emmaPlan.goal_realism.suggested_first_milestone);
assert.match(emmaPlan.goal_realism.nora_line, /too slow|starter habit/i);

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
assert.equal(ainoPlan.goal_realism.goal_category, 'home_down_payment');
assert.equal(ainoPlan.goal_realism.motivation_risk, 'high');
assert.match(ainoPlan.goal_realism.nora_line, /long-game|milestone/i);

const emergencyPlan = createGoalSavingsPlan({
  userId: 'U006',
  goalName: 'Emergency buffer (€3,000)',
  riskComfort: 'medium',
  currency: 'EUR',
  financialSnapshot: snapshot(50)
});

assert.equal(emergencyPlan.goal_realism.goal_category, 'emergency_buffer');
assert.equal(emergencyPlan.goal_realism.timeline_realism, 'too_slow');
assert.equal(emergencyPlan.goal_realism.realism_label, 'Needs a milestone');
assert.ok(emergencyPlan.goal_realism.suggested_first_milestone.amount > 0);

const realisticTravelPlan = createGoalSavingsPlan({
  userId: 'U007',
  goalName: 'Travel (€900)',
  riskComfort: 'medium',
  currency: 'EUR',
  financialSnapshot: snapshot(100)
});

assert.equal(realisticTravelPlan.goal_realism.goal_category, 'travel_event');
assert.equal(realisticTravelPlan.goal_realism.timeline_realism, 'realistic');
assert.equal(realisticTravelPlan.goal_realism.motivation_risk, 'low');

const slowTravelPlan = createGoalSavingsPlan({
  userId: 'U008',
  goalName: 'Travel (€4,000)',
  riskComfort: 'medium',
  currency: 'EUR',
  financialSnapshot: snapshot(100)
});

assert.equal(slowTravelPlan.goal_realism.goal_category, 'travel_event');
assert.equal(slowTravelPlan.goal_realism.timeline_realism, 'too_slow');
assert.equal(slowTravelPlan.goal_realism.motivation_risk, 'high');

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
assert.equal(noTargetPlan.goal_realism.goal_category, 'retirement_long_term');
assert.equal(noTargetPlan.goal_realism.timeline_realism, 'long_term_normal');
assert.equal(noTargetPlan.goal_realism.motivation_risk, 'low');
assert.ok(noTargetPlan.options.every((option) => option.timeline_months === null));

console.log('Goal/Savings Plan Agent tests passed.');
