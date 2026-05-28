const DEFAULT_CURRENCY = 'EUR';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatMoney(amount, currency = DEFAULT_CURRENCY) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return `${currency} ${Math.round(n)}`;
}

function formatMonths(months) {
  const n = Number(months);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 24) return `${Math.round(n)} months`;
  const years = Math.round((n / 12) * 10) / 10;
  return `${years} years`;
}

function hasFuturePerspectiveHistory(input = {}, memory = {}) {
  const history = [
    ...safeArray(input.recommendationHistory || input.recommendation_history),
    ...safeArray(memory.recommendation_history)
  ];
  return history.some((item) => item?.type === 'future_perspective');
}

function latestAction(input = {}) {
  return input.actionDraft
    || input.action_draft
    || input.actionApproval?.action
    || input.action_approval?.action
    || null;
}

function latestMonthlyAmount({ goalPlan = {}, action = {} }) {
  return Number(
    goalPlan.recommended_option?.monthly_contribution
    || goalPlan.recommendation_card?.amount
    || action?.amount
    || 0
  ) || null;
}

function normalizeTrigger(input = {}, goalPlan = {}, expenseReview = {}, educationLesson = {}, action = {}) {
  const latest = String(input.latestUserMessage || input.latest_user_message || '').toLowerCase();
  const risk = goalPlan.goal_realism?.motivation_risk;
  const explicitFuture = /future|worth it|what does this change|long[- ]?term|later/i.test(latest);
  const loan = /loan|borrow|repay|debt|student loan/i.test(latest)
    || /Borrowing|Loans/i.test(String(educationLesson.domain || educationLesson.topic || ''));
  const fasterChoice = /faster|slower|timeline|boost|milestone|adjust/i.test(latest);
  const expense = expenseReview?.agent === 'expense_review' && /expense|subscription|review|category|cut/i.test(latest);
  const actionApproval = action?.status === 'pending_approval' || action?.approval_required;

  if (input.isFirstConversation || input.is_first_conversation) return { available: false, reason: 'onboarding' };
  if (hasFuturePerspectiveHistory(input, input.userMemory || input.user_memory || {})) return { available: false, reason: 'already_used_recently' };
  if (loan) return { available: true, type: 'loan_tradeoff' };
  if (risk === 'high' || risk === 'medium') return { available: true, type: goalPlan.requires_adjustment ? 'milestone_tradeoff' : 'slow_goal_tradeoff' };
  if (fasterChoice) return { available: true, type: 'speed_vs_ease' };
  if (expense) return { available: true, type: 'expense_support' };
  if (actionApproval && Number(action.amount || 0) >= 50) return { available: true, type: 'action_approval' };
  if (explicitFuture) return { available: true, type: 'general_future' };
  return { available: false, reason: 'low_emotion_turn' };
}

function timeHorizonMonths(goalPlan = {}) {
  const months = Number(goalPlan.recommended_option?.timeline_months || 0);
  if (!Number.isFinite(months) || months <= 0) return 12;
  return Math.max(3, Math.min(12, months));
}

function buildCard({ triggerType, goalPlan, expenseReview, educationLesson, action, financialSnapshot, currency }) {
  const goalName = goalPlan.goal_name || action?.goal_name || 'this goal';
  const target = Number(goalPlan.target_amount || 0) || null;
  const monthly = latestMonthlyAmount({ goalPlan, action });
  const horizonMonths = timeHorizonMonths(goalPlan);
  const saved = monthly ? monthly * horizonMonths : null;
  const targetText = target ? formatMoney(target, currency) : null;
  const savedText = saved ? formatMoney(saved, currency) : null;
  const monthlyText = monthly ? formatMoney(monthly, currency) : null;
  const category = String(expenseReview?.suggested_category || 'one recurring category').toLowerCase();

  if (triggerType === 'loan_tradeoff') {
    return {
      time_horizon: '12 months',
      future_snapshot: 'A loan could move the purchase closer, but repayment would become part of normal monthly life.',
      tradeoff: 'Borrowing buys time now, but it reduces future monthly freedom.',
      decision_question: 'Would you rather keep future monthly freedom higher, or bring the purchase closer with repayment pressure?',
      options: ['Keep more monthly freedom', 'Bring the purchase closer']
    };
  }

  if (triggerType === 'milestone_tradeoff') {
    return {
      time_horizon: '12 months',
      future_snapshot: monthlyText
        ? `You have ${savedText} saved automatically toward ${goalName}, but ${targetText || 'the full goal'} is still a long-game target.`
        : `${goalName} is still a long-game target, so the useful future view is a milestone, not the full number.`,
      tradeoff: 'The habit is useful, but the full goal still needs a milestone, longer timeline, or shared contribution lever.',
      decision_question: 'Which feels most useful now: smaller milestone, shared contribution later, or keep this as a starter habit?',
      options: ['Smaller milestone', 'Shared contribution later', 'Starter habit only']
    };
  }

  if (triggerType === 'expense_support') {
    return {
      time_horizon: '3 months',
      future_snapshot: monthlyText
        ? `You have ${formatMoney(monthly * 3, currency)} saved if the habit survives normal months.`
        : 'The plan works better if one recurring category is visible before it quietly eats the habit.',
      tradeoff: `Reviewing ${category} protects the habit without making the goal depend on willpower.`,
      decision_question: 'Would future-you rather protect the habit with one monthly review, or keep the plan smaller?',
      options: ['Protect with review', 'Keep plan smaller']
    };
  }

  if (triggerType === 'action_approval') {
    return {
      time_horizon: '3 months',
      future_snapshot: monthlyText
        ? `You have ${formatMoney(monthly * 3, currency)} saved if this small habit runs for three normal months.`
        : 'The useful change is turning the idea into a repeatable habit.',
      tradeoff: 'Approving makes the habit concrete; editing keeps control if the amount feels tight.',
      decision_question: 'Want to approve the small habit, edit the amount, or leave it parked?',
      options: ['Approve', 'Edit amount', 'Leave parked']
    };
  }

  if (triggerType === 'speed_vs_ease' || triggerType === 'slow_goal_tradeoff' || triggerType === 'general_future') {
    const fullSolved = target && saved && saved >= target;
    return {
      time_horizon: `${horizonMonths} months`,
      future_snapshot: savedText
        ? `You have ${savedText} saved automatically toward ${goalName}${fullSolved ? '.' : ', but the goal is not fully funded yet.'}`
        : `You have a clearer path for ${goalName}, but the next step still needs a concrete amount.`,
      tradeoff: fullSolved
        ? 'The tradeoff is not speed anymore; it is whether the monthly habit feels easy enough to keep.'
        : 'Faster needs boosts or a higher amount; calmer needs more time.',
      decision_question: 'Which feels more like you: faster with boosts, or calmer with a longer timeline?',
      options: ['Faster with boosts', 'Calmer longer timeline']
    };
  }

  return null;
}

export function createFuturePerspectiveCard(input = {}) {
  const userMemory = input.userMemory || input.user_memory || {};
  const goalPlan = input.goalPlan || input.goal_plan || {};
  const expenseReview = input.expenseReview || input.expense_review || {};
  const educationLesson = input.educationLesson || input.education_lesson || {};
  const financialSnapshot = input.financialSnapshot || input.financial_snapshot || {};
  const action = latestAction(input);
  const currency = input.currency || goalPlan.currency || financialSnapshot.currency || DEFAULT_CURRENCY;
  const trigger = normalizeTrigger(input, goalPlan, expenseReview, educationLesson, action);

  if (!trigger.available) {
    return {
      agent: 'future_perspective_card',
      status: 'skipped',
      reason: trigger.reason,
      title: null,
      time_horizon: null,
      future_snapshot: null,
      tradeoff: null,
      decision_question: null,
      options: [],
      memory_updates: [],
      safety_flags: ['future_perspective_not_used']
    };
  }

  const card = buildCard({
    triggerType: trigger.type,
    goalPlan,
    expenseReview,
    educationLesson,
    action,
    financialSnapshot,
    currency
  });

  if (!card) {
    return {
      agent: 'future_perspective_card',
      status: 'skipped',
      reason: 'no_useful_tradeoff',
      title: null,
      time_horizon: null,
      future_snapshot: null,
      tradeoff: null,
      decision_question: null,
      options: [],
      memory_updates: [],
      safety_flags: ['future_perspective_not_used']
    };
  }

  return {
    agent: 'future_perspective_card',
    status: 'available',
    title: 'Future-you view',
    trigger: trigger.type,
    ...card,
    memory_updates: [
      {
        field: 'recommendation_history',
        value: {
          id: `future_perspective_${trigger.type}`,
          type: 'future_perspective',
          summary: `Future perspective shown for ${trigger.type.replace(/_/g, ' ')}.`,
          trigger: trigger.type,
          amount: null,
          status: 'suggested',
          created_at: input.now || new Date().toISOString()
        },
        source: 'inferred_from_conversation',
        confidence: 'medium'
      },
      {
        field: 'preferences.likes_future_self_framing',
        value: true,
        source: 'inferred_from_conversation',
        confidence: 'medium'
      }
    ],
    safety_flags: [
      'no_guaranteed_outcomes',
      'no_investment_return_prediction',
      'decision_lens_only'
    ]
  };
}
