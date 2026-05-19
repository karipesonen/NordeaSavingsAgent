const STAGE_MONEY_CONFIDENCE = 'money_confidence';
const STAGE_INVESTMENT_PATHS = 'investment_paths';

const STATUS_ORDER = ['unseen', 'seen', 'explored', 'applied'];
const STATUS_PROGRESS = {
  unseen: 0,
  seen: 25,
  explored: 50,
  applied: 75
};
const VISIBLE_STATUS = {
  seen: 'Started',
  explored: 'Getting clearer',
  applied: 'Applied once'
};

const STAGE_1_DOMAINS = {
  starting_safely: {
    name: 'Starting Safely',
    stage: STAGE_MONEY_CONFIDENCE,
    topics: ['emergency buffer', 'safe-to-save', 'money needed soon', 'savings before investing']
  },
  risk_without_panic: {
    name: 'Risk Without Panic',
    stage: STAGE_MONEY_CONFIDENCE,
    topics: ['risk', 'volatility', 'time horizon', 'not gambling']
  },
  money_habits: {
    name: 'Money Habits',
    stage: STAGE_MONEY_CONFIDENCE,
    topics: ['automated saving', 'recurring reviews', 'monthly investing basics']
  },
  goal_planning: {
    name: 'Goal Planning',
    stage: STAGE_MONEY_CONFIDENCE,
    topics: ['milestones', 'timelines', 'tradeoffs', 'shared contribution']
  },
  borrowing_loans: {
    name: 'Borrowing & Loans',
    stage: STAGE_MONEY_CONFIDENCE,
    topics: ['student loans', 'interest', 'repayment', 'borrowing vs saving', 'loan stress', 'credit basics']
  }
};

const STAGE_2_DOMAINS = {
  funds: {
    name: 'Funds',
    stage: STAGE_INVESTMENT_PATHS,
    topics: ['index funds', 'diversification', 'fees', 'monthly fund investing']
  },
  stocks: {
    name: 'Stocks',
    stage: STAGE_INVESTMENT_PATHS,
    topics: ['single-company risk', 'volatility', 'research basics']
  },
  home_real_estate: {
    name: 'Home & Real Estate',
    stage: STAGE_INVESTMENT_PATHS,
    topics: ['down payments', 'mortgages', 'housing as a goal']
  },
  retirement_long_term: {
    name: 'Retirement & Long-Term',
    stage: STAGE_INVESTMENT_PATHS,
    topics: ['pensions', 'compounding', 'long timelines']
  },
  sustainable_investing: {
    name: 'Sustainable Investing',
    stage: STAGE_INVESTMENT_PATHS,
    topics: ['values', 'ESG concepts', 'tradeoffs']
  }
};

const ALL_DOMAINS = { ...STAGE_1_DOMAINS, ...STAGE_2_DOMAINS };

function keyForDomainName(name) {
  return Object.entries(ALL_DOMAINS).find(([, domain]) => domain.name === name)?.[0] || null;
}

function normalizeTopic(topic) {
  return String(topic || 'Money confidence').trim();
}

function statusRank(status) {
  const index = STATUS_ORDER.indexOf(status);
  return index >= 0 ? index : 0;
}

function maxStatus(a, b) {
  return statusRank(a) >= statusRank(b) ? a : b;
}

function inferDomainKey({ topic, blocker, goalPlan, latestUserMessage }) {
  const topicText = String(topic || '').toLowerCase();
  const messageText = String(latestUserMessage || '').toLowerCase();
  const text = `${topicText} ${blocker || ''} ${messageText}`.toLowerCase();

  if (mentionsLoans(text)) return 'borrowing_loans';

  if (mentionsFunds(messageText)) return 'funds';
  if (mentionsStocks(messageText)) return 'stocks';
  if (mentionsHome(messageText)) return 'home_real_estate';
  if (mentionsRetirement(messageText)) return 'retirement_long_term';
  if (mentionsSustainable(messageText)) return 'sustainable_investing';

  if (topicText.includes('saving') || topicText.includes('savings') || topicText.includes('buffer') || topicText.includes('needed soon')) return 'starting_safely';
  if (topicText.includes('risk') || topicText.includes('gambl') || topicText.includes('volatil')) return 'risk_without_panic';
  if (topicText.includes('automatic') || topicText.includes('habit') || topicText.includes('monthly') || topicText.includes('small amount')) return 'money_habits';
  if (topicText.includes('goal') || topicText.includes('milestone') || topicText.includes('timeline')) return 'goal_planning';

  if (text.includes('risk') || text.includes('gambl') || text.includes('volatil')) return 'risk_without_panic';
  if (text.includes('automatic') || text.includes('habit') || text.includes('monthly') || text.includes('small amount')) return 'money_habits';
  if (text.includes('goal') || text.includes('milestone') || text.includes('timeline') || goalPlan?.requires_adjustment) return 'goal_planning';
  if (text.includes('saving') || text.includes('savings') || text.includes('buffer') || text.includes('needed soon')) return 'starting_safely';

  return 'starting_safely';
}

function mentionsLoans(text) {
  return /\bloans?\b|student loan|\bborrow(?:ing)?\b|\brepay(?:ment)?\b|\binterest\b|\bcredit\b|\bdebt\b/i.test(text);
}

function mentionsFunds(text) {
  return /\bfunds?\b|index fund|etf|diversif/i.test(text);
}

function mentionsStocks(text) {
  return /\bstocks?\b|shares?|single company/i.test(text);
}

function mentionsHome(text) {
  return /home|house|housing|real estate|mortgage|down payment/i.test(text);
}

function mentionsRetirement(text) {
  return /retirement|pension|long[- ]term/i.test(text);
}

function mentionsSustainable(text) {
  return /sustain|esg|values|green investing/i.test(text);
}

function explicitInvestmentInterests(text) {
  const normalized = String(text || '').toLowerCase();
  const interests = [];
  if (mentionsFunds(normalized)) interests.push('Funds');
  if (mentionsStocks(normalized)) interests.push('Stocks');
  if (mentionsHome(normalized)) interests.push('Home & Real Estate');
  if (mentionsRetirement(normalized)) interests.push('Retirement & Long-Term');
  if (mentionsSustainable(normalized)) interests.push('Sustainable Investing');
  return [...new Set(interests)];
}

function existingDomainProgress(userMemory, domainKey) {
  return userMemory?.learning_progress?.domains?.[domainKey] || {};
}

function inferStatus({ progressEvent, latestUserMessage, goalPlan, educationLesson }) {
  const event = String(progressEvent || '').toLowerCase();
  const text = String(latestUserMessage || '').toLowerCase();
  const topic = String(educationLesson?.topic || '').toLowerCase();

  if (event.includes('applied')) return 'applied';
  if (event.includes('explored')) return 'explored';
  if (event.includes('seen')) return 'seen';

  if (text.includes('savings-first') || text.includes('keep short-term') || text.includes('applied')) return 'applied';
  if ((text.includes('mark') || text.includes('next step')) && goalPlan) return 'applied';
  if (text.includes('yes') || text.includes('makes sense') || text.includes('answer')) return 'explored';
  if (text.includes('show me') || text.includes('short version') || topic) return 'seen';
  return 'seen';
}

function nextDomainSuggestion({ status, domainKey, interestedDomains }) {
  if (interestedDomains.length) return interestedDomains[0];
  if (domainKey === 'borrowing_loans') return status === 'applied' ? 'Money Habits' : null;
  if (status !== 'applied') {
    if (domainKey === 'starting_safely') return 'Risk Without Panic';
    if (domainKey === 'risk_without_panic') return 'Money Habits';
    if (domainKey === 'money_habits') return 'Goal Planning';
    return null;
  }
  if (['starting_safely', 'risk_without_panic', 'money_habits', 'goal_planning'].includes(domainKey)) return 'Funds';
  return null;
}

function shouldUnlockInvestmentPaths({ domainKey, internalStatus, interestedDomains }) {
  if (interestedDomains.length) return true;
  return internalStatus === 'applied'
    && ['starting_safely', 'risk_without_panic', 'money_habits', 'goal_planning'].includes(domainKey);
}

function userFacingSummary({ status, domainName, topic, goalPlan, nextSuggestion }) {
  if (status === 'applied') {
    if (String(topic).toLowerCase().includes('risk')) {
      return 'You used the risk idea by keeping this journey savings-first before any investment action.';
    }
    if (goalPlan?.requires_adjustment) {
      return 'You used this once by treating the first amount as a starter habit, not a magic fix.';
    }
    return `You used ${topic} once in a real money decision.`;
  }
  if (status === 'explored') return `${domainName} is getting clearer. No homework; Nora will remember the thread.`;
  if (nextSuggestion) return `${domainName} is started. Next useful idea later: ${nextSuggestion}.`;
  return `${domainName} is started. Tiny progress, zero school energy.`;
}

function topicId(topic) {
  return normalizeTopic(topic).toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'topic';
}

export function createLearningProgress(input = {}) {
  const educationLesson = input.educationLesson || input.education_lesson || {};
  const userMemory = input.userMemory || input.user_memory || {};
  const goalPlan = input.goalPlan || input.goal_plan || {};
  const topic = normalizeTopic(educationLesson.topic || input.topic);
  const latestUserMessage = input.latestUserMessage || input.latest_user_message || '';
  const domainKey = inferDomainKey({
    topic,
    blocker: educationLesson.blocker || input.investmentBlocker || input.investment_blocker,
    goalPlan,
    latestUserMessage
  });
  const domain = ALL_DOMAINS[domainKey];
  const previous = existingDomainProgress(userMemory, domainKey);
  const inferredStatus = inferStatus({
    progressEvent: input.progressEvent || input.progress_event,
    latestUserMessage,
    goalPlan,
    educationLesson
  });
  const internalStatus = maxStatus(previous.status || 'unseen', inferredStatus);
  const previousProgress = Number(previous.progress || 0);
  const targetProgress = Math.max(previousProgress, STATUS_PROGRESS[internalStatus]);
  const progressDelta = Math.max(0, targetProgress - previousProgress);
  const interestedDomains = explicitInvestmentInterests(latestUserMessage);
  const nextSuggestion = nextDomainSuggestion({ status: internalStatus, domainKey, interestedDomains });
  const topicMarker = `${domain.name}:${topic}:${internalStatus}`;

  return {
    agent: 'learning_progress',
    stage: domain.stage,
    domain: domain.name,
    domain_key: domainKey,
    topic,
    internal_status: internalStatus,
    visible_status: VISIBLE_STATUS[internalStatus] || 'Started',
    progress_delta: progressDelta,
    domain_progress: targetProgress,
    next_domain_suggestion: nextSuggestion,
    interested_domains: interestedDomains,
    user_facing_summary: userFacingSummary({
      status: internalStatus,
      domainName: domain.name,
      topic,
      goalPlan,
      nextSuggestion
    }),
    memory_updates: [
      {
        field: 'learning_progress.stage',
        value: domain.stage,
        source: 'inferred_from_conversation',
        confidence: 'medium'
      },
      {
        field: `learning_progress.domains.${domainKey}`,
        value: {
          name: domain.name,
          stage: domain.stage,
          status: internalStatus,
          visible_status: VISIBLE_STATUS[internalStatus] || 'Started',
          progress: targetProgress,
          last_topic: topic
        },
        source: 'inferred_from_conversation',
        confidence: 'medium'
      },
      {
        field: 'learning_progress.topic_history',
        value: [topicMarker],
        source: 'inferred_from_conversation',
        confidence: 'medium'
      },
      {
        field: 'learning_progress.next_suggested_domain',
        value: nextSuggestion,
        source: 'inferred_from_conversation',
        confidence: nextSuggestion ? 'medium' : 'low'
      }
    ].concat(interestedDomains.length ? [{
      field: 'learning_progress.interested_domains',
      value: interestedDomains,
      source: 'explicit_user',
      confidence: 'high'
    }] : []),
    safety_flags: ['education_progress_not_advice', 'do_not_show_raw_internal_status'],
    available_stage_1_domains: Object.values(STAGE_1_DOMAINS).map((item) => item.name),
    unlocked_stage_2_domains: shouldUnlockInvestmentPaths({ domainKey, internalStatus, interestedDomains })
      ? Object.values(STAGE_2_DOMAINS).map((item) => item.name)
      : []
  };
}

export function domainKeyForName(name) {
  return keyForDomainName(name);
}
