const DEFAULT_CURRENCY = 'EUR';

export function extractTargetAmount(goalName) {
  const text = String(goalName || '');
  const explicit = text.match(/(?:EUR|eur|€)\s*([0-9][0-9\s,.]*)/);
  const parenthesized = text.match(/\(([0-9][0-9\s,.]*)\)/);
  const match = explicit || parenthesized;
  if (!match) return null;
  const normalized = match[1].replace(/\s/g, '').replace(/,/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function roundToNearestFive(n) {
  if (!Number.isFinite(n)) return 5;
  return Math.max(5, Math.round(n / 5) * 5);
}

function monthsUntil(targetDate, now = new Date()) {
  if (!targetDate) return null;
  const date = new Date(targetDate);
  if (Number.isNaN(date.getTime())) return null;
  const months = (date.getFullYear() - now.getFullYear()) * 12 + date.getMonth() - now.getMonth();
  return Math.max(1, months);
}

function formatMonths(months) {
  if (!months) return null;
  if (months < 24) return `${months} months`;
  const years = months / 12;
  return `${Math.round(years * 10) / 10} years`;
}

function feasibilityForTimeline(months) {
  if (!months) return 'workable';
  if (months <= 18) return 'easy';
  if (months <= 48) return 'workable';
  if (months <= 96) return 'tight';
  return 'unrealistic';
}

function feasibilityForSafeShare(amount, safeToSave) {
  if (!safeToSave || safeToSave <= 0) return 'not_recommended';
  const share = amount / safeToSave;
  if (share <= 0.25) return 'easy';
  if (share <= 0.5) return 'workable';
  if (share <= 0.85) return 'tight';
  return 'tight';
}

function inferGoalCategory(goalName, targetAmount) {
  const text = String(goalName || '').toLowerCase();
  if (/laptop|phone|computer|tablet/.test(text)) return 'tech_purchase';
  if (/travel|trip|holiday|festival|event/.test(text)) return 'travel_event';
  if (/emergency|buffer|rainy day/.test(text)) return 'emergency_buffer';
  if (/down payment|home|house|apartment/.test(text)) return 'home_down_payment';
  if (/car|vehicle|bike/.test(text)) return 'car_transport';
  if (/moving|deposit|furniture|rent deposit/.test(text)) return 'moving_housing';
  if (/retirement|pension|cabin/.test(text)) return 'retirement_long_term';
  if (/education|studies|student/.test(text)) return 'education';
  if (!targetAmount) return 'general_goal';
  if (targetAmount < 500) return 'small_purchase';
  if (targetAmount <= 2000) return 'medium_purchase';
  if (targetAmount <= 10000) return 'large_purchase';
  return 'long_term_goal';
}

const HORIZON_BANDS = {
  small_purchase: { motivatingMax: 3, cautionMax: 6 },
  medium_purchase: { motivatingMax: 12, cautionMax: 24 },
  large_purchase: { motivatingMax: 36, cautionMax: 48 },
  tech_purchase: { motivatingMax: 12, cautionMax: 24 },
  travel_event: { motivatingMax: 18, cautionMax: 30 },
  emergency_buffer: { motivatingMax: 12, cautionMax: 24 },
  moving_housing: { motivatingMax: 18, cautionMax: 30 },
  car_transport: { motivatingMax: 36, cautionMax: 48 },
  home_down_payment: { motivatingMax: 84, cautionMax: 120 },
  retirement_long_term: { longTermNormal: true },
  education: { motivatingMax: 120, cautionMax: 120 },
  long_term_goal: { motivatingMax: 84, cautionMax: 120 },
  general_goal: { motivatingMax: 18, cautionMax: 30 }
};

function milestoneAmount({ category, targetAmount, recommendedAmount }) {
  if (!targetAmount) return null;
  if (category === 'emergency_buffer') return Math.min(targetAmount, Math.max(250, roundToNearestFive(recommendedAmount * 12)));
  if (category === 'home_down_payment' || category === 'long_term_goal') return Math.min(targetAmount, Math.max(1000, roundToNearestFive(recommendedAmount * 12)));
  if (targetAmount <= 500) return Math.min(targetAmount, roundToNearestFive(targetAmount / 2));
  return Math.min(targetAmount, Math.max(300, roundToNearestFive(recommendedAmount * 12)));
}

function categoryLabel(category) {
  return {
    tech_purchase: 'tech goal',
    travel_event: 'travel goal',
    emergency_buffer: 'buffer goal',
    home_down_payment: 'down payment',
    car_transport: 'transport goal',
    moving_housing: 'moving goal',
    retirement_long_term: 'long-term goal',
    education: 'education goal',
    small_purchase: 'small purchase',
    medium_purchase: 'medium purchase',
    large_purchase: 'large purchase',
    long_term_goal: 'long-term goal',
    general_goal: 'goal'
  }[category] || 'goal';
}

function createGoalRealism({ goalName, targetAmount, recommendedOption, fastestTimeline, currency, requiresAdjustment }) {
  const goalCategory = inferGoalCategory(goalName, targetAmount);
  const horizon = HORIZON_BANDS[goalCategory] || HORIZON_BANDS.general_goal;
  const timelineMonths = recommendedOption?.timeline_months || null;
  const monthly = recommendedOption?.monthly_contribution || null;
  const timelineLabel = recommendedOption?.timeline_label || formatMonths(timelineMonths);
  const suggestedMilestoneAmount = milestoneAmount({
    category: goalCategory,
    targetAmount,
    recommendedAmount: monthly || 0
  });

  if (!targetAmount || !timelineMonths) {
    return {
      goal_category: goalCategory,
      timeline_realism: horizon.longTermNormal ? 'long_term_normal' : 'unknown',
      motivation_risk: horizon.longTermNormal ? 'low' : 'medium',
      realism_label: horizon.longTermNormal ? 'Looks realistic' : 'Needs a target',
      reason: horizon.longTermNormal
        ? `${goalName} is naturally long term, so the useful first step is a repeatable habit and periodic review.`
        : `No target amount was available, so Nora can draft a safe habit but cannot judge the full timeline yet.`,
      suggested_first_milestone: null,
      suggested_levers: horizon.longTermNormal
        ? ['keep the first habit easy to maintain', 'review yearly', 'add target amount later if useful']
        : ['add a target amount', 'set a first milestone', 'review whether the monthly amount feels worth keeping'],
      nora_line: horizon.longTermNormal
        ? `${goalName} is a long-game goal, so the first win is a habit you can keep.`
        : `I can draft a safe monthly habit for ${goalName}, but I need a target amount before calling the timeline realistic.`
    };
  }

  const tooSlow = !horizon.longTermNormal && timelineMonths > horizon.cautionMax;
  const slow = !tooSlow && !horizon.longTermNormal && timelineMonths > horizon.motivatingMax;
  const timelineRealism = requiresAdjustment || tooSlow
    ? 'too_slow'
    : horizon.longTermNormal
      ? 'long_term_normal'
      : slow
        ? 'slow'
        : 'realistic';
  const motivationRisk = requiresAdjustment || tooSlow ? 'high' : slow ? 'medium' : 'low';
  const realismLabel = requiresAdjustment
    ? 'Needs adjustment'
    : tooSlow
      ? goalCategory === 'emergency_buffer' ? 'Needs a milestone' : 'Starter habit only'
      : slow
        ? 'Workable but slow'
        : 'Looks realistic';
  const suggestedFirstMilestone = suggestedMilestoneAmount
    ? {
        label: 'First milestone',
        amount: suggestedMilestoneAmount,
        reason: `Visible progress within about ${Math.max(1, Math.ceil(suggestedMilestoneAmount / monthly))} months.`
      }
    : null;
  const suggestedLevers = motivationRisk === 'high'
    ? [
        'set a smaller first milestone',
        'increase monthly amount if safe',
        'add one-off contributions',
        'ask whether the user is willing to wait'
      ]
    : motivationRisk === 'medium'
      ? ['set a visible milestone', 'review progress after three months', 'increase amount later if safe']
      : ['keep the habit repeatable', 'review when income or costs change'];
  const category = categoryLabel(goalCategory);
  const reason = requiresAdjustment
    ? `${goalName} takes ${timelineLabel} at ${currency} ${monthly}/month, so this is a starter habit for a ${category}, not the full plan.`
    : tooSlow
      ? `${currency} ${monthly}/month takes about ${timelineLabel} for ${goalName}, which is likely too slow to stay motivating.`
      : slow
        ? `${currency} ${monthly}/month reaches ${goalName} in about ${timelineLabel}; that can work, but it may need a visible milestone.`
        : `${currency} ${monthly}/month reaches ${goalName} in about ${timelineLabel}, which fits this kind of goal.`;
  const noraLine = requiresAdjustment
    ? `This is not a failed plan. It is a long-game ${category}. The first useful step is a milestone, not pretending ${currency} ${monthly}/month solves the whole goal.`
    : tooSlow
      ? `${currency} ${monthly}/month is safe, but ${timelineLabel} for ${goalName} is probably too slow to stay motivating. I would treat this as a starter habit and set a first milestone.`
      : slow
        ? `${currency} ${monthly}/month can work, but ${timelineLabel} is long enough that I would add a milestone so progress stays visible.`
        : `This looks realistic: ${currency} ${monthly}/month fits the money picture and the timeline stays visible.`;

  return {
    goal_category: goalCategory,
    timeline_realism: timelineRealism,
    motivation_risk: motivationRisk,
    realism_label: realismLabel,
    reason,
    suggested_first_milestone: suggestedFirstMilestone,
    suggested_levers: suggestedLevers,
    nora_line: noraLine
  };
}

function worseFeasibility(a, b) {
  const order = ['easy', 'workable', 'tight', 'unrealistic', 'not_recommended'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

function dedupeOptions(options) {
  const seen = new Set();
  return options.filter((option) => {
    if (seen.has(option.monthly_contribution)) return false;
    seen.add(option.monthly_contribution);
    return true;
  });
}

function optionFor({ id, label, amount, safeToSave, targetAmount, targetMonths, tradeoff }) {
  const timelineMonths = targetAmount ? Math.max(1, Math.ceil(targetAmount / amount)) : null;
  const targetDateFeasibility = targetMonths && targetAmount
    ? amount >= roundToNearestFive(targetAmount / targetMonths) ? 'workable' : 'unrealistic'
    : 'workable';
  const feasibility = targetAmount
    ? worseFeasibility(feasibilityForTimeline(timelineMonths), targetDateFeasibility)
    : feasibilityForSafeShare(amount, safeToSave);

  return {
    id,
    label,
    monthly_contribution: amount,
    timeline_months: timelineMonths,
    timeline_label: formatMonths(timelineMonths),
    feasibility,
    tradeoff
  };
}

function chooseRecommendedOption(options, hasTarget) {
  if (!options.length) return null;
  const acceptable = options.find((option) => ['easy', 'workable'].includes(option.feasibility));
  if (acceptable) return acceptable;
  return options[0];
}

export function createGoalSavingsPlan(input) {
  const goalName = input.goalName || input.goal_name || 'personal goal';
  const currency = input.currency || DEFAULT_CURRENCY;
  const snapshot = input.financialSnapshot || input.financial_snapshot || {};
  const safeToSave = roundToNearestFive(Number(snapshot.safe_to_save_estimate || snapshot.safeToSaveEstimate || 0));
  const targetAmount = Number(input.targetAmount || input.target_amount || extractTargetAmount(goalName)) || null;
  const targetMonths = monthsUntil(input.targetDate || input.target_date);
  const riskComfort = input.riskComfort || input.risk_comfort || 'medium';
  const lowRisk = String(riskComfort).includes('low');
  const userId = input.userId || input.user_id || 'demo-user';

  const starterCap = lowRisk ? 25 : 50;
  const gentleAmount = Math.min(safeToSave, starterCap);
  const balancedBase = lowRisk ? safeToSave * 0.3 : safeToSave * 0.45;
  const acceleratedBase = lowRisk ? safeToSave * 0.55 : safeToSave * 0.75;
  const balancedAmount = Math.min(safeToSave, Math.max(gentleAmount + 5, roundToNearestFive(balancedBase)));
  const acceleratedAmount = Math.min(safeToSave, Math.max(balancedAmount + 5, roundToNearestFive(acceleratedBase)));

  const options = dedupeOptions([
    optionFor({
      id: 'gentle',
      label: 'Gentle',
      amount: gentleAmount,
      safeToSave,
      targetAmount,
      targetMonths,
      tradeoff: 'Lowest friction; best when the user is still building confidence.'
    }),
    optionFor({
      id: 'balanced',
      label: 'Balanced',
      amount: balancedAmount,
      safeToSave,
      targetAmount,
      targetMonths,
      tradeoff: 'More visible progress while staying below the safe-to-save estimate.'
    }),
    optionFor({
      id: 'accelerated',
      label: 'Accelerated',
      amount: acceleratedAmount,
      safeToSave,
      targetAmount,
      targetMonths,
      tradeoff: 'Fastest sustainable draft; should be reviewed before approval.'
    })
  ]);

  const recommendedOption = chooseRecommendedOption(options, Boolean(targetAmount));
  const requiredMonthlyForTargetDate = targetAmount && targetMonths ? roundToNearestFive(targetAmount / targetMonths) : null;
  const fastestTimeline = options.reduce((best, option) => {
    if (!option.timeline_months) return best;
    return !best || option.timeline_months < best ? option.timeline_months : best;
  }, null);
  const requiresAdjustment = Boolean(targetAmount && fastestTimeline && fastestTimeline > 96);
  const overallFeasibility = requiresAdjustment
    ? 'unrealistic'
    : recommendedOption?.feasibility || 'not_recommended';
  const goalRealism = createGoalRealism({
    goalName,
    targetAmount,
    recommendedOption,
    fastestTimeline,
    currency,
    requiresAdjustment
  });

  const levers = [];
  if (requiresAdjustment) {
    levers.push('increase monthly contribution if cashflow allows');
    levers.push('extend the timeline');
    levers.push('split the goal into a smaller first milestone');
    levers.push('add one-off contributions such as bonuses or gifts');
    levers.push('consider shared-goal contributions from selected family members');
  }
  if (requiredMonthlyForTargetDate && requiredMonthlyForTargetDate > safeToSave) {
    levers.push(`target date would need about ${currency} ${requiredMonthlyForTargetDate}/month, above the current safe-to-save estimate`);
  }
  if (goalRealism.motivation_risk === 'high' && !requiresAdjustment) {
    levers.push(...goalRealism.suggested_levers);
  }
  const uniqueLevers = [...new Set(levers)];

  const goalId = `${userId}-${goalName.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'goal'}`;
  const recommendationStatus = requiresAdjustment
    ? 'needs_adjustment'
    : goalRealism.motivation_risk === 'high'
      ? 'starter_habit_only'
      : 'draft_requires_approval';
  const noraSummary = requiresAdjustment
    ? `${goalName} is too large for the current monthly draft to solve on its own. Treat ${currency} ${recommendedOption.monthly_contribution}/month as a starter habit, then choose a timeline, milestone, or shared contribution lever.`
    : goalRealism.motivation_risk === 'high'
      ? goalRealism.nora_line
      : `${currency} ${recommendedOption.monthly_contribution}/month is a reasonable first draft for ${goalName}.`;
  const recommendationSummary = requiresAdjustment || goalRealism.motivation_risk === 'high'
    ? goalRealism.nora_line
    : `Draft ${currency} ${recommendedOption.monthly_contribution}/month as a savings-first habit. Investment education comes before any investment action.`;

  return {
    agent: 'goal_savings_plan',
    goal_id: goalId,
    goal_name: goalName,
    target_amount: targetAmount,
    target_date: input.targetDate || input.target_date || null,
    currency,
    safe_to_save_estimate: safeToSave,
    recommended_option_id: recommendedOption?.id || null,
    recommended_option: recommendedOption,
    options,
    overall_feasibility: overallFeasibility,
    requires_adjustment: requiresAdjustment,
    goal_realism: goalRealism,
    levers: uniqueLevers,
    nora_summary: noraSummary,
    recommendation_card: {
      title: requiresAdjustment || goalRealism.motivation_risk === 'high' ? `Starter habit for ${goalName}` : `Start a monthly habit for ${goalName}`,
      summary: recommendationSummary,
      amount: recommendedOption?.monthly_contribution || null,
      currency,
      cadence: 'monthly',
      status: recommendationStatus
    },
    trust_ledger_input: {
      data_used: ['savings goal', 'target amount if available', 'safe-to-save estimate', 'risk comfort', 'financial snapshot'],
      assumptions: [
        'The 2025 synthetic cashflow pattern is broadly representative.',
        targetAmount ? 'The target amount parsed from the goal name is correct.' : 'No target amount was available, so timeline is not estimated.',
        `Goal realism category inferred as ${goalRealism.goal_category}.`
      ],
      confidence: targetAmount ? 'medium' : 'low',
      boundaries: [
        'This is not an investment return forecast.',
        'This does not execute a transfer.',
        'Large goals may need timeline changes, milestone splitting, or outside contributions.'
      ],
      approval_required: !requiresAdjustment
    },
    memory_updates: [
      {
        field: 'goals',
        value: [{
          id: goalId,
          name: goalName,
          target_amount: targetAmount,
          currency,
          monthly_contribution: recommendedOption?.monthly_contribution || null,
          status: 'draft',
          shared_goal: false
        }],
        source: 'inferred_from_conversation',
        confidence: targetAmount ? 'medium' : 'low'
      },
      {
        field: 'investment_journey.readiness_stage',
        value: requiresAdjustment ? 'safety_first' : 'draft_created',
        source: 'inferred_from_conversation',
        confidence: 'medium'
      }
    ],
    safety_flags: requiresAdjustment
      ? ['goal_requires_adjustment_before_approval', 'approval_required_before_money_movement']
      : goalRealism.motivation_risk === 'high'
        ? ['goal_motivation_risk_high', 'approval_required_before_money_movement']
      : ['approval_required_before_money_movement']
  };
}
