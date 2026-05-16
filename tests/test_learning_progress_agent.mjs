import assert from 'node:assert/strict';
import { createLearningProgress } from '../agent/tools/learning_progress_agent.mjs';

const riskLesson = {
  agent: 'education_risk_lesson',
  topic: 'What investment risk means',
  blocker: 'risk',
  lesson_card: { title: 'Risk means movement, not chaos' }
};

const seen = createLearningProgress({
  userId: 'U005',
  educationLesson: riskLesson,
  latestUserMessage: 'Show me the risk card. Short version please.'
});

assert.equal(seen.agent, 'learning_progress');
assert.equal(seen.stage, 'money_confidence');
assert.equal(seen.domain, 'Risk Without Panic');
assert.equal(seen.internal_status, 'seen');
assert.equal(seen.visible_status, 'Started');
assert.equal(seen.progress_delta, 25);
assert.equal(seen.next_domain_suggestion, 'Money Habits');
assert.deepEqual(seen.unlocked_stage_2_domains, []);

const explored = createLearningProgress({
  userId: 'U005',
  educationLesson: riskLesson,
  latestUserMessage: 'Yes, that makes sense.',
  userMemory: {
    learning_progress: {
      domains: {
        risk_without_panic: { status: 'seen', progress: 25 }
      }
    }
  }
});

assert.equal(explored.internal_status, 'explored');
assert.equal(explored.visible_status, 'Getting clearer');
assert.equal(explored.progress_delta, 25);
assert.deepEqual(explored.unlocked_stage_2_domains, []);

const applied = createLearningProgress({
  userId: 'U003',
  educationLesson: riskLesson,
  latestUserMessage: 'Yes, mark that as the next step.',
  progressEvent: 'applied_to_savings_plan',
  goalPlan: { goal_name: 'Down payment', requires_adjustment: true },
  userMemory: {
    learning_progress: {
      domains: {
        risk_without_panic: { status: 'explored', progress: 50 }
      }
    }
  }
});

assert.equal(applied.internal_status, 'applied');
assert.equal(applied.visible_status, 'Applied once');
assert.equal(applied.progress_delta, 25);
assert.equal(applied.next_domain_suggestion, 'Funds');
assert.ok(applied.unlocked_stage_2_domains.includes('Funds'));
assert.ok(applied.user_facing_summary.includes('used'));

const repeated = createLearningProgress({
  userId: 'U003',
  educationLesson: riskLesson,
  latestUserMessage: 'Yes, mark that as the next step.',
  progressEvent: 'applied_to_savings_plan',
  goalPlan: { goal_name: 'Down payment', requires_adjustment: true },
  userMemory: {
    learning_progress: {
      domains: {
        risk_without_panic: { status: 'applied', progress: 75 }
      }
    }
  }
});

assert.equal(repeated.internal_status, 'applied');
assert.equal(repeated.progress_delta, 0);
assert.equal(repeated.domain_progress, 75);

const fundsInterest = createLearningProgress({
  userId: 'U002',
  educationLesson: riskLesson,
  latestUserMessage: 'Can you explain funds next?'
});

assert.equal(fundsInterest.domain, 'Funds');
assert.equal(fundsInterest.stage, 'investment_paths');
assert.deepEqual(fundsInterest.interested_domains, ['Funds']);
assert.equal(fundsInterest.next_domain_suggestion, 'Funds');

const savingsBeforeInvesting = createLearningProgress({
  userId: 'U003',
  educationLesson: {
    agent: 'education_risk_lesson',
    topic: 'When savings should come before investing',
    blocker: 'risk'
  },
  latestUserMessage: 'Show me the risk card. Short version please.'
});

assert.equal(savingsBeforeInvesting.domain, 'Starting Safely');

console.log('Learning Progress Agent tests passed.');
