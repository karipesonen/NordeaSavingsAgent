const EXECUTION_MODE = 'demo_memory_only';
const DEFAULT_CURRENCY = 'EUR';

const ACTION_TYPES = new Set([
  'savings_transfer_draft',
  'investment_draft',
  'expense_review_habit',
  'subscription_cancellation_request',
  'shared_goal_draft',
  'goal_contribution_request'
]);

const OPERATIONS = new Set([
  'create_draft',
  'edit_draft',
  'request_approval',
  'approve',
  'decline',
  'cancel',
  'pause',
  'resume'
]);

const ACTIVE_DRAFT_STATUSES = new Set(['draft', 'pending_approval', 'edited']);
const ACTIVE_HABIT_STATUSES = new Set(['approved_in_demo_memory', 'paused', 'resumed']);

function normalizeActionType(value) {
  const actionType = String(value || 'savings_transfer_draft');
  return ACTION_TYPES.has(actionType) ? actionType : 'savings_transfer_draft';
}

function normalizeOperation(value) {
  const operation = String(value || 'create_draft');
  return OPERATIONS.has(operation) ? operation : 'create_draft';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeActionState(userMemory = {}) {
  const state = userMemory.action_state || userMemory.actionState || {};
  return {
    active_drafts: safeArray(state.active_drafts).map(clone),
    active_habits: safeArray(state.active_habits).map(clone),
    action_log: safeArray(state.action_log).map(clone)
  };
}

function allActions(state) {
  return [...state.active_drafts, ...state.active_habits];
}

function findExistingAction({ state, actionId, existingAction }) {
  if (existingAction?.action_id) return clone(existingAction);
  if (!actionId) return null;
  return allActions(state).find((action) => action.action_id === actionId) || null;
}

function slug(value) {
  return String(value || 'action').toLowerCase().replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'action';
}

function nextActionId(userId, actionType, state) {
  const prefix = `act_${slug(userId || 'demo_user')}_${slug(actionType)}`;
  const count = allActions(state).filter((action) => String(action.action_id || '').startsWith(prefix)).length + state.action_log.filter((event) => String(event.action_id || '').startsWith(prefix)).length + 1;
  return `${prefix}_${String(count).padStart(3, '0')}`;
}

function money(amount, currency = DEFAULT_CURRENCY) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return `${currency} ${Math.round(n)}`;
}

function cadenceUnit(cadence) {
  const normalized = String(cadence || 'monthly').toLowerCase();
  if (normalized === 'monthly') return 'month';
  if (normalized === 'weekly') return 'week';
  if (normalized === 'yearly' || normalized === 'annually') return 'year';
  return normalized;
}

function approvalRequiredFor(actionType) {
  return [
    'savings_transfer_draft',
    'investment_draft',
    'subscription_cancellation_request',
    'shared_goal_draft',
    'goal_contribution_request'
  ].includes(actionType);
}

function summaryFor(action) {
  const amount = money(action.amount, action.currency);
  const cadence = action.cadence || 'monthly';
  const unit = cadenceUnit(cadence);
  const goal = action.goal_name || action.goal_id || 'the selected goal';
  const category = action.category || 'the selected category';

  if (action.status === 'blocked') {
    if (action.action_type === 'investment_draft') {
      return 'Investment draft blocked until the education and safety checks are met. Not executed.';
    }
    return 'Action blocked by safety rules. Not executed.';
  }

  if (action.action_type === 'savings_transfer_draft') {
    if (action.status === 'approved_in_demo_memory') {
      return `Approved in demo memory: ${amount || 'the selected amount'}/${unit} savings draft for ${goal}. Not executed.`;
    }
    if (action.status === 'paused') return `Savings habit paused in demo memory for ${goal}. Not executed.`;
    if (action.status === 'resumed') return `Savings habit resumed in demo memory for ${goal}. Not executed.`;
    return `Draft ${amount || 'the selected amount'}/${unit} to ${goal}. Not executed.`;
  }

  if (action.action_type === 'investment_draft') {
    return `Draft ${amount || 'the selected amount'}/${unit} investment habit for later review. Not executed and no product selected.`;
  }

  if (action.action_type === 'expense_review_habit') {
    if (action.status === 'approved_in_demo_memory') {
      return `Approved in demo memory: review ${String(category).toLowerCase()} ${cadence}. No cancellation happened.`;
    }
    return `Draft a ${cadence} review habit for ${String(category).toLowerCase()}. No cancellation happened.`;
  }

  if (action.action_type === 'subscription_cancellation_request') {
    return `Draft a manual cancellation review request for ${category}. No cancellation happened.`;
  }

  if (action.action_type === 'shared_goal_draft') {
    const count = Number(action.allowed_people_count || 0);
    return `Draft shared-goal invitation for ${goal}${count ? ` with ${count} selected people` : ''}. Nothing shared.`;
  }

  if (action.action_type === 'goal_contribution_request') {
    return `Draft contribution request for ${goal}. Nothing sent or shared.`;
  }

  return 'Draft action saved in demo memory. Not executed.';
}

function baseAction({ input, actionType, operation, state, now }) {
  const userId = input.userId || input.user_id || 'demo_user';
  const currency = input.currency || DEFAULT_CURRENCY;
  const allowedPeople = safeArray(input.allowedPeople || input.allowed_people);
  return {
    action_id: input.actionId || input.action_id || nextActionId(userId, actionType, state),
    action_type: actionType,
    status: operation === 'create_draft' ? 'pending_approval' : 'draft',
    summary: '',
    amount: Number.isFinite(Number(input.amount)) ? Number(input.amount) : null,
    currency,
    cadence: input.cadence || 'monthly',
    goal_id: input.goalId || input.goal_id || null,
    goal_name: input.goalName || input.goal_name || null,
    category: input.category || input.selectedCategory || input.selected_category || null,
    source_agent: input.sourceAgent || input.source_agent || 'nora',
    approval_required: approvalRequiredFor(actionType),
    execution_mode: EXECUTION_MODE,
    allowed_people_count: actionType === 'shared_goal_draft' ? allowedPeople.length : undefined,
    created_at: now,
    last_updated_at: now
  };
}

function compactAction(action) {
  return Object.fromEntries(Object.entries(action).filter(([, value]) => value !== undefined));
}

function educationReady(input, userMemory) {
  if (input.educationCompleted || input.education_completed) return true;
  if (input.prerequisites?.education_completed) return true;
  const knownTopics = safeArray(userMemory.financial_understanding?.known_topics);
  const readiness = userMemory.investment_journey?.readiness_stage;
  return readiness === 'ready_to_plan' && knownTopics.length > 0;
}

function applyOperation({ input, operation, actionType, existingAction, state, now }) {
  const created = compactAction(baseAction({ input, actionType, operation, state, now }));
  let fromStatus = existingAction?.status || null;
  let action = existingAction ? { ...existingAction, last_updated_at: now } : created;

  if (operation === 'create_draft') {
    action = created;
    fromStatus = null;
    if (actionType === 'investment_draft' && !educationReady(input, input.userMemory || input.user_memory || {})) {
      action.status = 'blocked';
      action.approval_required = true;
    } else {
      action.status = 'pending_approval';
    }
  } else if (!existingAction) {
    action = {
      ...created,
      status: 'blocked',
      summary: 'Action blocked because no existing draft or habit was found. Not executed.'
    };
  } else if (operation === 'edit_draft') {
    action = {
      ...action,
      amount: Number.isFinite(Number(input.amount)) ? Number(input.amount) : action.amount,
      cadence: input.cadence || action.cadence,
      goal_name: input.goalName || input.goal_name || action.goal_name,
      category: input.category || input.selectedCategory || input.selected_category || action.category,
      status: 'edited'
    };
  } else if (operation === 'request_approval') {
    action.status = 'pending_approval';
  } else if (operation === 'approve') {
    action.status = 'approved_in_demo_memory';
  } else if (operation === 'decline') {
    action.status = 'declined';
  } else if (operation === 'cancel') {
    action.status = 'cancelled';
  } else if (operation === 'pause') {
    action.status = 'paused';
  } else if (operation === 'resume') {
    action.status = 'resumed';
  }

  action.execution_mode = EXECUTION_MODE;
  action.approval_required = approvalRequiredFor(action.action_type);
  action.summary = summaryFor(action);
  return { action: compactAction(action), fromStatus };
}

function upsertById(items, action) {
  const without = items.filter((item) => item.action_id !== action.action_id);
  return [...without, action];
}

function commitAction(state, action, logEvent) {
  const next = {
    active_drafts: state.active_drafts.filter((item) => item.action_id !== action.action_id),
    active_habits: state.active_habits.filter((item) => item.action_id !== action.action_id),
    action_log: [...state.action_log, logEvent]
  };

  if (ACTIVE_DRAFT_STATUSES.has(action.status)) {
    next.active_drafts = upsertById(next.active_drafts, action);
  } else if (ACTIVE_HABIT_STATUSES.has(action.status)) {
    next.active_habits = upsertById(next.active_habits, action);
  }

  return next;
}

function logEventFor({ action, operation, fromStatus, now, actor }) {
  return {
    event_id: `${action.action_id}_${operation}_${String(Date.parse(now) || 0)}`,
    action_id: action.action_id,
    action_type: action.action_type,
    operation,
    from_status: fromStatus,
    to_status: action.status,
    actor,
    summary: action.summary,
    execution_mode: EXECUTION_MODE,
    timestamp: now
  };
}

function sourceFor(operation) {
  return ['approve', 'decline', 'cancel', 'pause', 'resume', 'edit_draft'].includes(operation)
    ? 'explicit_user'
    : 'inferred_from_conversation';
}

function safetyFlagsFor(action) {
  const flags = ['demo_memory_only', 'not_executed', 'approval_required_before_real_execution'];
  if (action.action_type === 'savings_transfer_draft') flags.push('approval_required_before_money_movement');
  if (action.action_type === 'investment_draft') flags.push('education_required_before_investment_action', 'no_specific_product_selected');
  if (action.action_type === 'subscription_cancellation_request' || action.action_type === 'expense_review_habit') flags.push('no_automatic_cancellations');
  if (action.action_type === 'shared_goal_draft' || action.action_type === 'goal_contribution_request') flags.push('no_balance_transaction_or_portfolio_sharing');
  if (action.status === 'blocked') flags.push('blocked_by_safety_rule');
  return [...new Set(flags)];
}

export function createActionApproval(input = {}) {
  const userMemory = input.userMemory || input.user_memory || {};
  const state = normalizeActionState(userMemory);
  const operation = normalizeOperation(input.operation);
  const actionType = normalizeActionType(input.actionType || input.action_type);
  const now = input.now || new Date().toISOString();
  const existingAction = findExistingAction({
    state,
    actionId: input.actionId || input.action_id,
    existingAction: input.existingAction || input.existing_action
  });
  const { action, fromStatus } = applyOperation({ input: { ...input, userMemory }, operation, actionType, existingAction, state, now });
  const actor = sourceFor(operation) === 'explicit_user' ? 'user' : 'nora';
  const actionLogEvent = logEventFor({ action, operation, fromStatus, now, actor });
  const nextState = commitAction(state, action, actionLogEvent);

  return {
    agent: 'action_approval',
    operation,
    action_type: action.action_type,
    execution_mode: EXECUTION_MODE,
    action,
    approval_request: action.status === 'pending_approval'
      ? {
          approval_request_id: `${action.action_id}_approval`,
          status: 'pending',
          summary: action.summary,
          risk_note: 'Demo only. No real money movement, cancellation, investment, or sharing occurs.'
        }
      : null,
    action_log_event: actionLogEvent,
    memory_updates: [
      {
        field: 'action_state',
        value: nextState,
        source: sourceFor(operation),
        confidence: action.status === 'blocked' ? 'medium' : 'high'
      }
    ],
    safety_flags: safetyFlagsFor(action)
  };
}
