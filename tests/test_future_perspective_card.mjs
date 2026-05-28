import assert from 'node:assert/strict';
import { createGoalSavingsPlan } from '../agent/tools/goal_savings_plan_agent.mjs';
import { createFuturePerspectiveCard } from '../agent/tools/future_perspective_card.mjs';

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

const laptopPlan = createGoalSavingsPlan({
  userId: 'U001',
  goalName: 'Laptop (€1,200)',
  riskComfort: 'low',
  currency: 'EUR',
  financialSnapshot: snapshot(30)
});

const laptopCard = createFuturePerspectiveCard({
  userId: 'U001',
  goalPlan: laptopPlan,
  financialSnapshot: snapshot(30)
});

assert.equal(laptopCard.agent, 'future_perspective_card');
assert.equal(laptopCard.status, 'available');
assert.equal(laptopCard.trigger, 'slow_goal_tradeoff');
assert.match(laptopCard.future_snapshot, /EUR 300|not fully funded/i);
assert.match(laptopCard.decision_question, /faster|calmer/i);
assert.deepEqual(laptopCard.options, ['Faster with boosts', 'Calmer longer timeline']);

const downPaymentPlan = createGoalSavingsPlan({
  userId: 'U003',
  goalName: 'Down payment (€30,000)',
  riskComfort: 'medium',
  currency: 'EUR',
  financialSnapshot: snapshot(285)
});

const downPaymentCard = createFuturePerspectiveCard({
  userId: 'U003',
  goalPlan: downPaymentPlan,
  financialSnapshot: snapshot(285)
});

assert.equal(downPaymentCard.status, 'available');
assert.equal(downPaymentCard.trigger, 'milestone_tradeoff');
assert.match(downPaymentCard.tradeoff, /milestone|shared contribution/i);
assert.ok(downPaymentCard.options.includes('Smaller milestone'));
assert.doesNotMatch(downPaymentCard.future_snapshot, /fully solved|guaranteed/i);

const loanCard = createFuturePerspectiveCard({
  latestUserMessage: 'Should I borrow or save for this?',
  educationLesson: {
    agent: 'education_risk_lesson',
    domain: 'Borrowing & Loans',
    topic: 'Borrowing vs saving'
  },
  financialSnapshot: snapshot(100)
});

assert.equal(loanCard.status, 'available');
assert.equal(loanCard.trigger, 'loan_tradeoff');
assert.match(loanCard.tradeoff, /monthly freedom/i);
assert.doesNotMatch(`${loanCard.future_snapshot} ${loanCard.tradeoff}`, /should take|approved|eligible|rate/i);

const lowEmotionCard = createFuturePerspectiveCard({
  latestUserMessage: 'Thanks',
  financialSnapshot: snapshot(100)
});

assert.equal(lowEmotionCard.status, 'skipped');
assert.equal(lowEmotionCard.reason, 'low_emotion_turn');

const repeatedCard = createFuturePerspectiveCard({
  goalPlan: laptopPlan,
  financialSnapshot: snapshot(30),
  recommendationHistory: [{ type: 'future_perspective', status: 'shown' }]
});

assert.equal(repeatedCard.status, 'skipped');
assert.equal(repeatedCard.reason, 'already_used_recently');

const noGuaranteeText = [
  laptopCard.future_snapshot,
  laptopCard.tradeoff,
  laptopCard.decision_question,
  downPaymentCard.future_snapshot,
  downPaymentCard.tradeoff,
  loanCard.future_snapshot,
  loanCard.tradeoff
].join(' ');

assert.doesNotMatch(noGuaranteeText, /guarantee|guaranteed|return prediction|will earn|profit/i);

console.log('Future Perspective Card tests passed.');
