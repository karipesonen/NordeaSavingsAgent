import assert from 'node:assert/strict';
import { createEducationRiskLesson } from '../agent/tools/education_risk_lesson_agent.mjs';

const baseGoalPlan = {
  goal_name: 'Laptop (€1,200)',
  recommended_option: { monthly_contribution: 25 },
  requires_adjustment: false,
  overall_feasibility: 'workable'
};

const riskLesson = createEducationRiskLesson({
  userId: 'U005',
  currentBlocker: 'risk',
  riskComfort: 'low',
  preferredFormat: 'short_card',
  goalPlan: baseGoalPlan
});

assert.equal(riskLesson.agent, 'education_risk_lesson');
assert.equal(riskLesson.topic, 'What investment risk means');
assert.equal(riskLesson.format, 'short_card');
assert.ok(riskLesson.lesson_card.plain_answer.includes('EUR 25/month'));
assert.equal(riskLesson.check_questions.length, 1);
assert.ok(riskLesson.safety_flags.includes('not_investment_advice'));

const confusionLesson = createEducationRiskLesson({
  userId: 'U001',
  currentBlocker: 'confusion',
  goalPlan: baseGoalPlan,
  userMemory: { financial_understanding: { preferred_content_format: 'quiz' } }
});

assert.equal(confusionLesson.topic, 'Saving versus investing');
assert.equal(confusionLesson.format, 'quiz');
assert.ok(confusionLesson.next_topic.includes('risk'));

const largeGoalLesson = createEducationRiskLesson({
  userId: 'U003',
  currentBlocker: 'risk',
  riskComfort: 'medium',
  goalPlan: {
    goal_name: 'Down payment (€30,000)',
    recommended_option: { monthly_contribution: 50 },
    requires_adjustment: true,
    overall_feasibility: 'unrealistic'
  }
});

assert.equal(largeGoalLesson.topic, 'When savings should come before investing');
assert.ok(largeGoalLesson.lesson_card.key_points.some((point) => point.includes('starter habit')));
assert.ok(largeGoalLesson.next_topic.includes('milestones'));

console.log('Education/Risk Lesson Agent tests passed.');
