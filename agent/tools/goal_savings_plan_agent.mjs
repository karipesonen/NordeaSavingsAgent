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

  const goalId = `${userId}-${goalName.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'goal'}`;
  const recommendationStatus = requiresAdjustment ? 'needs_adjustment' : 'draft_requires_approval';
  const noraSummary = requiresAdjustment
    ? `${goalName} is too large for the current monthly draft to solve on its own. Treat ${currency} ${recommendedOption.monthly_contribution}/month as a starter habit, then choose a timeline, milestone, or shared contribution lever.`
    : `${currency} ${recommendedOption.monthly_contribution}/month is a reasonable first draft for ${goalName}.`;

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
    levers,
    nora_summary: noraSummary,
    recommendation_card: {
      title: requiresAdjustment ? `Starter habit for ${goalName}` : `Start a monthly habit for ${goalName}`,
      summary: requiresAdjustment
        ? `${currency} ${recommendedOption.monthly_contribution}/month is a starter habit, not enough to complete the full goal alone.`
        : `Draft ${currency} ${recommendedOption.monthly_contribution}/month as a savings-first habit. Investment education comes before any investment action.`,
      amount: recommendedOption?.monthly_contribution || null,
      currency,
      cadence: 'monthly',
      status: recommendationStatus
    },
    trust_ledger_input: {
      data_used: ['savings goal', 'target amount if available', 'safe-to-save estimate', 'risk comfort', 'financial snapshot'],
      assumptions: [
        'The 2025 synthetic cashflow pattern is broadly representative.',
        targetAmount ? 'The target amount parsed from the goal name is correct.' : 'No target amount was available, so timeline is not estimated.'
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
      : ['approval_required_before_money_movement']
  };
}
