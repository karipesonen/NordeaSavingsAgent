const DEFAULT_CURRENCY = 'EUR';
const MODES = new Set(['current_snapshot', 'next_best_action', 'memory_review', 'monthly_recap']);
const BANK_KNOWN_FIELDS = new Set(['user.age', 'user.first_name', 'investment_journey.has_nordea_investments']);

function normalizeMode(value) {
  const mode = String(value || 'current_snapshot').trim();
  return MODES.has(mode) ? mode : 'current_snapshot';
}

function currencyFrom(input) {
  return input.currency
    || input.financialSnapshot?.currency
    || input.financial_snapshot?.currency
    || input.bankContext?.currency
    || input.bank_context?.currency
    || DEFAULT_CURRENCY;
}

function formatMoney(amount, currency = DEFAULT_CURRENCY) {
  if (amount === null || amount === undefined || amount === '') return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return `${currency} ${Math.round(n)}`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstGoal(memory = {}, goalPlan = {}) {
  return goalPlan.goal_name
    ? {
        name: goalPlan.goal_name,
        target_amount: goalPlan.target_amount,
        monthly_contribution: goalPlan.recommended_option?.monthly_contribution || goalPlan.recommendation_card?.amount || null,
        status: goalPlan.requires_adjustment ? 'needs_adjustment' : 'draft'
      }
    : safeArray(memory.goals)[0] || null;
}

function latestLearning(memory = {}, learningProgress = {}) {
  if (learningProgress?.agent === 'learning_progress') {
    return {
      stage: learningProgress.stage,
      domain: learningProgress.domain,
      visible_status: learningProgress.visible_status,
      next_domain_suggestion: learningProgress.next_domain_suggestion || null,
      summary: learningProgress.user_facing_summary || null
    };
  }
  const domains = Object.values(memory.learning_progress?.domains || {});
  const latest = domains.at(-1);
  return latest
    ? {
        stage: latest.stage,
        domain: latest.name,
        visible_status: latest.visible_status,
        next_domain_suggestion: memory.learning_progress?.next_suggested_domain || null,
        summary: null
      }
    : null;
}

function moneyState(snapshot = {}, currency = DEFAULT_CURRENCY) {
  return {
    monthly_income_estimate: Number(snapshot.monthly_income_estimate || 0) || null,
    available_this_month: Number(snapshot.available_this_month || 0) || null,
    safe_to_save_estimate: Number(snapshot.safe_to_save_estimate || 0) || null,
    currency,
    confidence: snapshot.confidence || 'low'
  };
}

function goalState(goal, goalPlan = {}, currency = DEFAULT_CURRENCY) {
  if (!goal) {
    return {
      active_goal: null,
      status: 'none_known',
      summary: 'No active goal has been captured yet.'
    };
  }

  const amount = formatMoney(goal.target_amount, goal.currency || currency);
  const monthly = formatMoney(goal.monthly_contribution, goal.currency || currency);
  const needsAdjustment = goalPlan.requires_adjustment || goal.status === 'needs_adjustment';
  return {
    active_goal: goal.name,
    target_amount: goal.target_amount || null,
    monthly_contribution: goal.monthly_contribution || null,
    status: needsAdjustment ? 'needs_adjustment' : (goal.status || 'draft'),
    summary: needsAdjustment
      ? `${goal.name} has a useful starter habit, but the full target needs a milestone, longer timeline, or shared contribution lever.`
      : `${goal.name} has a draft habit${monthly ? ` of ${monthly}/month` : ''}${amount ? ` toward ${amount}` : ''}.`
  };
}

function habitState(expenseReview = {}, goalPlan = {}, currency = DEFAULT_CURRENCY) {
  const savingsAmount = goalPlan.recommended_option?.monthly_contribution || goalPlan.recommendation_card?.amount || null;
  const category = expenseReview.suggested_category || null;
  return {
    savings_habit: savingsAmount ? `${formatMoney(savingsAmount, currency)}/month draft` : null,
    expense_review_habit: category ? `Inspect ${String(category).toLowerCase()} monthly before changing anything.` : null,
    summary: category && savingsAmount
      ? `The current habit stack is ${formatMoney(savingsAmount, currency)}/month plus one monthly ${String(category).toLowerCase()} review.`
      : savingsAmount
        ? `The current habit is a ${formatMoney(savingsAmount, currency)}/month savings draft.`
        : category
          ? `The current habit is a monthly ${String(category).toLowerCase()} review.`
          : 'No repeatable habit has been selected yet.'
  };
}

function learningState(memory = {}, learningProgress = {}) {
  const latest = latestLearning(memory, learningProgress);
  if (!latest) {
    return {
      current_domain: null,
      visible_status: null,
      next_domain_suggestion: null,
      summary: 'No learning moment has been captured yet.'
    };
  }
  return {
    current_domain: latest.domain,
    visible_status: latest.visible_status,
    next_domain_suggestion: latest.next_domain_suggestion,
    summary: latest.summary || `${latest.domain} is ${String(latest.visible_status || 'started').toLowerCase()}.`
  };
}

function hasLowConfidenceMemory(memory = {}) {
  return safeArray(memory.memory_events).some((event) => event.confidence === 'low' && !BANK_KNOWN_FIELDS.has(event.field));
}

function memoryState(memory = {}) {
  const events = safeArray(memory.memory_events);
  const uncertain = memoryReviewCandidates(memory);
  return {
    tracked_facts_count: events.length,
    low_confidence_count: events.filter((event) => event.confidence === 'low').length,
    needs_review: uncertain.length > 0,
    summary: uncertain.length
      ? 'Some remembered preferences or inferred facts should be checked before Nora relies on them.'
      : 'Nora has enough lightweight context for this demo without a dedicated long-term memory agent.'
  };
}

function memoryReviewCandidates(memory = {}) {
  const candidates = [];
  const events = safeArray(memory.memory_events);

  const inferredFields = new Map();
  for (const event of events) {
    if (BANK_KNOWN_FIELDS.has(event.field)) continue;
    if (event.source === 'inferred_from_conversation' || event.confidence === 'low') inferredFields.set(event.field, event);
  }

  for (const event of inferredFields.values()) {
    if (event.confidence === 'low' || event.field.includes('risk_comfort') || event.field.includes('likes_future_self_framing')) {
      candidates.push({
        field: event.field,
        remembered_value: event.value,
        reason: event.confidence === 'low' ? 'low confidence inference' : 'preference may change over time',
        confidence: event.confidence || 'medium'
      });
    }
  }

  const blockers = safeArray(memory.investment_journey?.first_investment_blockers);
  if (blockers.length > 1) {
    candidates.push({
      field: 'investment_journey.first_investment_blockers',
      remembered_value: blockers,
      reason: 'multiple blockers are remembered; Nora should ask which matters most now',
      confidence: 'medium'
    });
  }

  return candidates.slice(0, 3);
}

function stableFacts(memory = {}) {
  const facts = [];
  if (memory.user?.first_name) facts.push(`first name: ${memory.user.first_name}`);
  if (memory.user?.age) facts.push('age from bank context');
  if (memory.investment_journey?.has_nordea_investments === false) facts.push('no Nordea investments in bank context');
  const goals = safeArray(memory.goals);
  if (goals[0]?.name) facts.push(`active goal: ${goals[0].name}`);
  return facts;
}

function memoryQuestion(memory = {}, candidates = []) {
  if (!candidates.length) return null;
  const parts = [];
  const blockers = safeArray(memory.investment_journey?.first_investment_blockers);
  if (blockers[0]) parts.push(`your main investing blocker as ${blockers[0].replace(/_/g, ' ')}`);
  if (memory.investment_journey?.risk_comfort) parts.push(`your risk comfort as ${memory.investment_journey.risk_comfort}`);
  if (memory.financial_understanding?.preferred_content_format) parts.push(`your preferred learning format as ${memory.financial_understanding.preferred_content_format.replace(/_/g, ' ')}`);
  if (!parts.length) parts.push('a few inferred preferences');
  return `Quick check: I currently have ${parts.join(', ')}. Still true?`;
}

function buildInsights({ snapshot, goalPlan, expenseReview, learningProgress, memory, currency }) {
  const insights = [];
  const safeToSave = Number(snapshot.safe_to_save_estimate || 0);
  if (safeToSave > 0) {
    insights.push({
      type: 'cashflow',
      message: `${formatMoney(safeToSave, currency)}/month appears usable as a starter habit before any investment action.`,
      confidence: snapshot.confidence || 'medium'
    });
  }
  if (goalPlan?.agent === 'goal_savings_plan') {
    insights.push({
      type: 'goal',
      message: goalPlan.requires_adjustment
        ? `${goalPlan.goal_name} needs an adjusted milestone or contribution lever before Nora calls it realistic.`
        : `${goalPlan.goal_name} has a draftable monthly savings habit.`,
      confidence: goalPlan.trust_ledger_input?.confidence || 'medium'
    });
  }
  if (expenseReview?.agent === 'expense_review' && expenseReview.suggested_category) {
    insights.push({
      type: 'expense',
      message: `${expenseReview.suggested_category} is worth reviewing monthly, as inspection rather than automatic cutting.`,
      confidence: expenseReview.trust_ledger_input?.confidence || 'medium'
    });
  }
  if (learningProgress?.agent === 'learning_progress') {
    insights.push({
      type: 'learning',
      message: learningProgress.user_facing_summary || `${learningProgress.domain} is getting clearer.`,
      confidence: 'medium'
    });
  }
  if (hasLowConfidenceMemory(memory)) {
    insights.push({
      type: 'memory',
      message: 'Nora has at least one low-confidence inferred fact that should be checked before relying on it.',
      confidence: 'medium'
    });
  }
  return insights;
}

function chooseNextBestAction({ mode, goalPlan, expenseReview, educationLesson, learningProgress, memory }) {
  if (mode === 'memory_review') {
    const candidates = memoryReviewCandidates(memory);
    return candidates.length
      ? {
          action_type: 'memory_check',
          label: 'Check remembered context',
          reason: 'Some remembered facts are inferred or low-confidence.',
          requires_approval: false
        }
      : {
          action_type: 'stop',
          label: 'No memory check needed',
          reason: 'Bank-known and high-confidence facts are enough for this demo.',
          requires_approval: false
        };
  }

  if (goalPlan?.requires_adjustment) {
    return {
      action_type: 'propose_plan',
      label: 'Choose a smaller milestone or shared contribution lever',
      reason: 'The goal planner flagged the full target as needing adjustment.',
      requires_approval: false
    };
  }

  if (!expenseReview?.agent) {
    return {
      action_type: 'review_expense',
      label: 'Review one recurring category',
      reason: 'A savings habit is easier to keep when one recurring expense category is visible.',
      requires_approval: false
    };
  }

  if (!educationLesson?.agent) {
    return {
      action_type: 'show_lesson',
      label: 'Show one short risk lesson',
      reason: 'Nora should keep investing education before any investment draft.',
      requires_approval: false
    };
  }

  if (learningProgress?.next_domain_suggestion) {
    return {
      action_type: 'show_lesson',
      label: `Explain ${learningProgress.next_domain_suggestion} next`,
      reason: 'The first confidence step is complete and there is a natural next learning path.',
      requires_approval: false
    };
  }

  if (memoryReviewCandidates(memory).length) {
    return {
      action_type: 'memory_check',
      label: 'Check remembered preferences later',
      reason: 'Nora should confirm inferred preferences before long-term personalization.',
      requires_approval: false
    };
  }

  return {
    action_type: 'stop',
    label: 'Stop the first demo journey',
    reason: 'The user has a goal draft, one review habit, and one learning next step.',
    requires_approval: false
  };
}

function snapshotSummary({ mode, money, goal, habit, learning }) {
  if (mode === 'monthly_recap') {
    return `${money.safe_to_save_estimate ? `${formatMoney(money.safe_to_save_estimate, money.currency)}/month is the current safe-to-save signal` : 'The safe-to-save signal is unclear'}, ${goal.active_goal ? `${goal.active_goal} is the main goal` : 'no goal is active yet'}, and ${learning.current_domain ? `${learning.current_domain} has progress` : 'learning has not started yet'}.`;
  }
  if (mode === 'memory_review') return 'This is a lightweight memory check, not a full long-term memory system.';
  return `${goal.active_goal ? goal.summary : 'No active goal yet'} ${habit.summary} ${learning.summary}`;
}

function titleFor(mode) {
  if (mode === 'next_best_action') return 'Your next useful Nora move';
  if (mode === 'memory_review') return 'Memory check';
  if (mode === 'monthly_recap') return 'Your month in money';
  return 'Your money picture right now';
}

function safetyFlagsFor(mode) {
  const flags = ['snapshot_not_financial_advice', 'no_memory_update_without_confirmation'];
  if (mode === 'monthly_recap') flags.push('recap_uses_available_demo_data_only');
  return flags;
}

export function createSnapshotInsight(input = {}) {
  const mode = normalizeMode(input.mode);
  const userMemory = input.userMemory || input.user_memory || {};
  const snapshot = input.financialSnapshot || input.financial_snapshot || {};
  const bankContext = input.bankContext || input.bank_context || {};
  const goalPlan = input.goalPlan || input.goal_plan || {};
  const expenseReview = input.expenseReview || input.expense_review || {};
  const educationLesson = input.educationLesson || input.education_lesson || {};
  const learningProgress = input.learningProgress || input.learning_progress || {};
  const currency = currencyFrom({ ...input, bankContext });
  const goal = firstGoal(userMemory, goalPlan);
  const money = moneyState(snapshot, currency);
  const goalBlock = goalState(goal, goalPlan, currency);
  const habitBlock = habitState(expenseReview, goalPlan, currency);
  const learningBlock = learningState(userMemory, learningProgress);
  const memoryBlock = memoryState(userMemory);
  const candidates = memoryReviewCandidates(userMemory);

  return {
    agent: 'snapshot_insight',
    mode,
    snapshot_card: {
      title: titleFor(mode),
      summary: snapshotSummary({ mode, money, goal: goalBlock, habit: habitBlock, learning: learningBlock }),
      money_state: money,
      goal_state: goalBlock,
      habit_state: habitBlock,
      learning_state: learningBlock,
      memory_state: memoryBlock
    },
    insights: buildInsights({
      snapshot,
      goalPlan,
      expenseReview,
      learningProgress,
      memory: userMemory,
      currency
    }),
    next_best_action: chooseNextBestAction({
      mode,
      goalPlan,
      expenseReview,
      educationLesson,
      learningProgress,
      memory: userMemory
    }),
    memory_review: {
      confirmation_needed: candidates.length > 0,
      stable_facts: stableFacts({
        ...userMemory,
        user: {
          ...userMemory.user,
          first_name: userMemory.user?.first_name || bankContext.user_first_name,
          age: userMemory.user?.age || bankContext.age
        }
      }),
      uncertain_or_stale: candidates,
      suggested_question: memoryQuestion(userMemory, candidates)
    },
    trust_ledger_input: {
      data_used: ['user memory', 'financial snapshot', 'goal plan', 'expense review', 'education progress'],
      assumptions: [
        'Snapshot uses synthetic demo data and previously saved Nora memory.',
        'Memory review candidates are suggestions, not automatic changes.'
      ],
      confidence: snapshot.confidence || 'medium',
      boundaries: [
        'This is not regulated investment advice.',
        'This does not execute money movement or sharing.',
        'Uncertain memory must be confirmed before it is corrected.'
      ],
      approval_required: false
    },
    memory_updates: [],
    safety_flags: safetyFlagsFor(mode)
  };
}
