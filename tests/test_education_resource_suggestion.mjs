import assert from 'node:assert/strict';
import { suggestEducationResource } from '../agent/tools/education_resource_suggestion.mjs';

const riskLesson = {
  agent: 'education_risk_lesson',
  topic: 'What investment risk means',
  blocker: 'risk',
  lesson_card: { title: 'Risk means movement, not chaos' }
};

const appliedRisk = {
  agent: 'learning_progress',
  domain: 'Risk Without Panic',
  stage: 'money_confidence',
  internal_status: 'applied'
};

const riskArticle = suggestEducationResource({
  userId: 'U005',
  educationLesson: riskLesson,
  learningProgress: appliedRisk,
  userMemory: { financial_understanding: { preferred_content_format: null }, recommendation_history: [] }
});

assert.equal(riskArticle.agent, 'education_resource_suggestion');
assert.equal(riskArticle.status, 'available');
assert.equal(riskArticle.resource.domain, 'Risk Without Panic');
assert.equal(riskArticle.resource.format, 'article');
assert.ok(riskArticle.resource.title.match(/volatility/i));
assert.ok(riskArticle.memory_updates.some((update) => update.field === 'recommendation_history'));

const riskVideo = suggestEducationResource({
  userId: 'U005',
  educationLesson: riskLesson,
  learningProgress: appliedRisk,
  userMemory: { financial_understanding: { preferred_content_format: 'video' }, recommendation_history: [] }
});

assert.equal(riskVideo.resource.domain, 'Risk Without Panic');
assert.equal(riskVideo.resource.format, 'video');

const dca = suggestEducationResource({
  userId: 'U002',
  educationLesson: {
    agent: 'education_risk_lesson',
    topic: 'How monthly investing habits work',
    lesson_card: { title: 'Dollar cost averaging and regular investing' }
  },
  learningProgress: {
    agent: 'learning_progress',
    domain: 'Money Habits',
    stage: 'money_confidence',
    internal_status: 'applied'
  },
  latestUserMessage: 'Can you explain dollar cost averaging?',
  userMemory: { financial_understanding: { preferred_content_format: 'article' }, recommendation_history: [] }
});

assert.equal(dca.resource.domain, 'Money Habits');
assert.equal(dca.resource.id, 'money_habits_article_dca_investors_podcast_001');
assert.ok(dca.safety_flags.includes('dca_not_guaranteed_returns'));
assert.doesNotMatch(dca.nora_line, /guarantee|guaranteed|profit promise/i);

const funds = suggestEducationResource({
  userId: 'U001',
  educationLesson: {
    agent: 'education_risk_lesson',
    topic: 'Index funds and diversification',
    lesson_card: { title: 'Funds spread the risk' }
  },
  learningProgress: {
    agent: 'learning_progress',
    domain: 'Funds',
    stage: 'investment_paths',
    internal_status: 'explored'
  },
  latestUserMessage: 'Can you explain funds next?',
  userMemory: { financial_understanding: { preferred_content_format: null }, recommendation_history: [] }
});

assert.equal(funds.resource.domain, 'Funds');
assert.equal(funds.resource.format, 'article');
assert.ok(funds.resource.title.match(/index funds/i));

const studentLoanPodcast = suggestEducationResource({
  userId: 'U003',
  educationLesson: {
    agent: 'education_risk_lesson',
    topic: 'Student loans without panic',
    blocker: 'loan_question'
  },
  learningProgress: {
    agent: 'learning_progress',
    domain: 'Borrowing & Loans',
    stage: 'money_confidence',
    internal_status: 'applied'
  },
  latestUserMessage: 'I prefer podcasts about student loan repayment.',
  userMemory: { financial_understanding: { preferred_content_format: 'podcast' }, recommendation_history: [] }
});

assert.equal(studentLoanPodcast.resource.domain, 'Borrowing & Loans');
assert.equal(studentLoanPodcast.resource.format, 'podcast_video');
assert.ok(studentLoanPodcast.resource.title.match(/student loans/i));

const noRepeat = suggestEducationResource({
  userId: 'U005',
  educationLesson: riskLesson,
  learningProgress: appliedRisk,
  recommendationHistory: [
    { type: 'education_resource', resource_id: riskArticle.resource.id, status: 'suggested' }
  ],
  userMemory: { financial_understanding: { preferred_content_format: null }, recommendation_history: [] }
});

assert.notEqual(noRepeat.resource?.id, riskArticle.resource.id);

const earlyFundsBlocked = suggestEducationResource({
  userId: 'U004',
  educationLesson: {
    agent: 'education_risk_lesson',
    topic: 'What should I learn next?',
    lesson_card: { title: 'Next step' }
  },
  learningProgress: {
    agent: 'learning_progress',
    domain: 'Goal Planning',
    stage: 'money_confidence',
    internal_status: 'seen',
    next_domain_suggestion: 'Funds'
  },
  userMemory: { financial_understanding: { preferred_content_format: null }, recommendation_history: [] }
});

assert.equal(earlyFundsBlocked.status, 'skipped');

const startingSafely = suggestEducationResource({
  userId: 'U001',
  educationLesson: {
    agent: 'education_risk_lesson',
    topic: 'Savings goals and time horizons',
    lesson_card: { title: 'Money needed soon stays safer' }
  },
  learningProgress: {
    agent: 'learning_progress',
    domain: 'Starting Safely',
    stage: 'money_confidence',
    internal_status: 'applied'
  },
  userMemory: { financial_understanding: { preferred_content_format: null }, recommendation_history: [] }
});

assert.equal(startingSafely.resource.id, 'starting_safely_article_emergency_fund_cfpb_001');
assert.notEqual(startingSafely.resource.id, 'starting_safely_video_time_horizons_001');

console.log('Education Resource Suggestion tests passed.');
