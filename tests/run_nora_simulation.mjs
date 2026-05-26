import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createGoalSavingsPlan } from '../agent/tools/goal_savings_plan_agent.mjs';
import { createEducationRiskLesson } from '../agent/tools/education_risk_lesson_agent.mjs';
import { createExpenseReview } from '../agent/tools/expense_review_agent.mjs';
import { createLearningProgress } from '../agent/tools/learning_progress_agent.mjs';
import { createSnapshotInsight } from '../agent/tools/snapshot_insight_agent.mjs';
import { createActionApproval } from '../agent/tools/action_approval_agent.mjs';
import { suggestEducationResource } from '../agent/tools/education_resource_suggestion.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    data: 'synthetic_data/generated/nordea_5users_2025.json',
    users: 'all',
    turns: 5,
    mode: 'offline',
    noraModel: process.env.NORA_MODEL || 'anthropic/claude-opus-4.7',
    userModel: process.env.SIM_USER_MODEL || 'openai/gpt-5-mini',
    outDir: 'tests/transcripts'
  };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--data') args.data = val, i++;
    else if (key === '--users') args.users = val, i++;
    else if (key === '--turns') args.turns = Number(val), i++;
    else if (key === '--mode') args.mode = val, i++;
    else if (key === '--nora-model') args.noraModel = val, i++;
    else if (key === '--user-model') args.userModel = val, i++;
    else if (key === '--out-dir') args.outDir = val, i++;
  }
  return args;
}

function resolveProjectPath(p) {
  return path.isAbsolute(p) ? p : path.join(projectRoot, p);
}

async function readText(p) {
  return fs.readFile(resolveProjectPath(p), 'utf8');
}

async function readJson(p) {
  return JSON.parse((await readText(p)).replace(/^\uFEFF/, ''));
}

function slug(s) {
  return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function selectUsers(allUsers, selector) {
  if (!selector || selector === 'all') return allUsers;
  const wanted = selector.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return allUsers.filter((u) => wanted.includes(u.userId.toLowerCase()) || wanted.includes(u.firstName.toLowerCase()) || wanted.includes(u.fullName.toLowerCase()));
}

function roundToNearestFive(n) {
  return Math.max(5, Math.round(n / 5) * 5);
}

function buildFinancialSnapshot(user) {
  const monthlyIncome = Number(user.monthlyIncome || 0);
  const monthlyNet = user.annualSummary ? Number(user.annualSummary.netSaved || 0) / 12 : monthlyIncome * 0.1;
  const safeToSave = roundToNearestFive(Math.max(10, Math.min(monthlyNet * 0.2, monthlyIncome * 0.08)));
  const recurring = [];
  for (const item of user.monthlyCategories || []) {
    if (['Housing', 'Subscriptions', 'Insurance', 'Transport'].includes(item.category)) {
      recurring.push({
        name: item.category,
        amount: roundToNearestFive(Number(item.total || 0) / 12),
        cadence: 'monthly'
      });
    }
  }
  return {
    monthly_income_estimate: monthlyIncome,
    available_this_month: roundToNearestFive(Math.max(0, monthlyNet)),
    safe_to_save_estimate: safeToSave,
    currency: 'EUR',
    recurring_expenses_detected: recurring,
    upcoming_risks: recurring.find((x) => x.name === 'Housing') ? [{ name: 'Housing costs', amount: recurring.find((x) => x.name === 'Housing').amount, due_in_days: 7 }] : [],
    confidence: 'medium'
  };
}

function initialMemory(user) {
  return {
    user: {
      first_name: user.firstName,
      age: user.age,
      personality_notes: [user.persona?.conversationStyle || 'natural and cautious'],
      tone_preference: 'warm_direct_playful'
    },
    financial_understanding: {
      self_rating: 'beginner',
      known_topics: [],
      confusing_topics: [],
      preferred_content_format: null
    },
    learning_progress: {
      stage: 'money_confidence',
      domains: {},
      topic_history: [],
      interested_domains: [],
      next_suggested_domain: null
    },
    investment_journey: {
      invested_before: null,
      has_nordea_investments: false,
      readiness_stage: 'unknown',
      risk_comfort: String(user.riskProfile || '').includes('low') ? 'low' : 'medium',
      first_investment_blockers: []
    },
    financial_snapshot_summary: {},
    goals: [],
    preferences: {
      likes_future_self_framing: null,
      wants_expense_tables: null,
      sharing_enabled: false,
      allowed_people_for_shared_goals: []
    },
    recommendation_history: [],
    action_state: {
      active_drafts: [],
      active_habits: [],
      action_log: []
    },
    memory_events: []
  };
}

function buildNoraContext(user, memory, snapshot, latestUserMessage, isFirstConversation, conversation) {
  return {
    session: {
      session_id: `sim-${user.userId}`,
      is_first_conversation: isFirstConversation,
      language: 'en',
      surface: 'simulation'
    },
    bank_context: {
      user_id: user.userId,
      user_first_name: user.firstName,
      age: user.age,
      known_customer_since: '2021-09-01',
      has_nordea_investments: false,
      monthly_income_estimate: user.monthlyIncome,
      currency: 'EUR',
      city: user.city,
      occupation: user.occupation,
      nordea_tier: user.nordeaTier,
      savings_goal: user.savingsGoal,
      risk_profile: user.riskProfile
    },
    user_memory: memory,
    financial_snapshot: snapshot,
    latest_user_message: latestUserMessage,
    conversation_so_far: conversation.map((t) => ({ role: t.role, text: t.text })),
    available_tools: [
      'read_user_memory',
      'update_user_memory',
      'get_financial_snapshot',
      'create_recurring_expense_table',
      'create_goal_plan',
      'goal_savings_plan_agent',
      'education_risk_lesson_agent',
      'expense_review_agent',
      'learning_progress_agent',
      'snapshot_insight_agent',
      'action_approval_agent',
      'draft_monthly_savings_action',
      'draft_monthly_investment_action',
      'write_trust_ledger',
      'request_user_approval',
      'suggest_education_resource'
    ]
  };
}

function extractVisible(noraOutput) {
  if (!noraOutput) return '';
  if (typeof noraOutput === 'string') return noraOutput;
  return noraOutput.visible_response || JSON.stringify(noraOutput, null, 2);
}

function extractVisibleWithCards(noraOutput) {
  const visible = extractVisible(noraOutput);
  const card = noraOutput?.action_confirmation_card;
  const resource = noraOutput?.resource_suggestion;
  const lines = [visible];
  if (card) {
    lines.push(
      `Action Confirmation: ${card.draft}`,
      `Status: ${card.status}`,
      `Options: ${Array.isArray(card.options) ? card.options.join(' | ') : ''}`
    );
  }
  if (resource?.status === 'available' && resource.resource) {
    lines.push(`Resource Suggestion: ${resource.resource.title} (${resource.resource.format})`);
  }
  return lines.filter(Boolean).join('\n\n');
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch {}
  }
  return { visible_response: text, parse_error: true };
}

async function callOpenRouter({ model, messages }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for --mode openrouter');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost/nordea-savings-hackathon',
      'X-Title': 'Nordea Savings Hackathon Nora Simulation'
    },
    body: JSON.stringify({ model, messages, temperature: 0.45 })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${body}`);
  }
  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}

function riskComfortFromUser(user) {
  const raw = String(user.riskProfile || '').toLowerCase();
  if (raw.includes('low')) return 'low';
  if (raw.includes('high')) return 'high';
  return 'medium';
}

function trustLedgerFromGoalPlan(goalPlan) {
  return {
    data_used: goalPlan.trust_ledger_input.data_used,
    assumptions: goalPlan.trust_ledger_input.assumptions,
    confidence: goalPlan.trust_ledger_input.confidence,
    what_i_am_not_claiming: goalPlan.trust_ledger_input.boundaries,
    approval_required: goalPlan.trust_ledger_input.approval_required
  };
}

function trustLedgerFromExpenseReview(expenseReview) {
  return {
    data_used: expenseReview.trust_ledger_input.data_used,
    assumptions: expenseReview.trust_ledger_input.assumptions,
    confidence: expenseReview.trust_ledger_input.confidence,
    what_i_am_not_claiming: expenseReview.trust_ledger_input.boundaries,
    approval_required: expenseReview.trust_ledger_input.approval_required
  };
}

function goalPlanOptionTable(goalPlan) {
  const hasTarget = Boolean(goalPlan.target_amount);
  if (hasTarget) {
    const rows = goalPlan.options.map((option) => (
      `| ${option.label} | ${goalPlan.currency} ${option.monthly_contribution}/month | ${option.timeline_label || '-'} | ${option.feasibility} |`
    )).join('\n');
    return `| Plan | Monthly amount | Estimated time | Feasibility |\n|---|---:|---:|---|\n${rows}`;
  }
  const rows = goalPlan.options.map((option) => (
    `| ${option.label} | ${goalPlan.currency} ${option.monthly_contribution}/month | ${option.tradeoff} |`
  )).join('\n');
  return `| Plan | Monthly amount | Use when |\n|---|---:|---|\n${rows}`;
}

function goalRealismNudge(goalPlan) {
  const realism = goalPlan.goal_realism;
  if (!realism?.nora_line) return '';
  if (realism.motivation_risk === 'high') return `\n\nRealism nudge: ${realism.nora_line}`;
  if (realism.motivation_risk === 'medium') return `\n\nMotivation note: ${realism.nora_line}`;
  return '';
}

function lessonVisibleText(educationLesson, gentleAmount) {
  const points = educationLesson.lesson_card.key_points.map((point) => `- ${point}`).join('\n');
  const check = educationLesson.check_questions[0];
  return `Quick money card: ${educationLesson.lesson_card.title}\n\n${educationLesson.lesson_card.plain_answer}\n\n${points}\n\nOne quick check: ${check.question}\n\nFor your next Nora step, I would keep the EUR ${gentleAmount}/month savings draft and treat "${educationLesson.topic}" as the confidence step before any investment draft. Want me to mark that as the next step?`;
}

function learningProgressVisibleText(learningProgress) {
  const next = learningProgress.next_domain_suggestion
    ? ` Progress without homework. I will keep ${learningProgress.next_domain_suggestion} as the next useful thing to explain when you are ready.`
    : ' Progress without homework. I will remember that this topic is less mysterious now.';
  return `Small win: ${learningProgress.user_facing_summary} (${learningProgress.visible_status}.)${next}`;
}

function snapshotInsightVisibleText(snapshotInsight) {
  const action = snapshotInsight.next_best_action;
  const actionText = action?.action_type === 'stop'
    ? `Natural stopping point: ${action.reason}`
    : `Next useful move: ${action.label}. ${action.reason}`;
  return `Money picture: ${snapshotInsight.snapshot_card.summary}\n\n${actionText}`;
}

function resourceSuggestionVisibleText(resourceSuggestion) {
  if (resourceSuggestion?.status !== 'available' || !resourceSuggestion.resource) return '';
  return `One useful next thing: ${resourceSuggestion.nora_line}\n\nWant links like this as articles, videos, or podcasts next time?`;
}

function latestAction(memory, actionType, statuses = []) {
  const state = memory.action_state || {};
  const actions = [
    ...(Array.isArray(state.active_drafts) ? state.active_drafts : []),
    ...(Array.isArray(state.active_habits) ? state.active_habits : [])
  ].filter((action) => action.action_type === actionType);
  const filtered = statuses.length ? actions.filter((action) => statuses.includes(action.status)) : actions;
  return filtered.at(-1) || null;
}

function actionApprovalMemoryUpdates(actionApproval) {
  return actionApproval?.memory_updates || [];
}

function actionTypeLabel(actionType) {
  return {
    savings_transfer_draft: 'Savings habit',
    investment_draft: 'Investment draft',
    expense_review_habit: 'Review habit',
    subscription_cancellation_request: 'Cancellation review',
    shared_goal_draft: 'Shared goal',
    goal_contribution_request: 'Contribution request'
  }[actionType] || 'Action draft';
}

function statusLabel(status) {
  return {
    pending_approval: 'Ready for approval',
    draft: 'Draft',
    edited: 'Edited',
    approved_in_demo_memory: 'Approved',
    declined: 'Not now',
    cancelled: 'Cancelled',
    paused: 'Paused',
    resumed: 'Resumed',
    blocked: 'Needs review'
  }[status] || 'Draft';
}

function cadenceLabel(cadence) {
  const normalized = String(cadence || 'monthly').toLowerCase();
  if (normalized === 'monthly') return 'month';
  if (normalized === 'weekly') return 'week';
  if (normalized === 'yearly' || normalized === 'annually') return 'year';
  return normalized;
}

function moneyLabel(action) {
  const amount = Number(action?.amount);
  if (!Number.isFinite(amount)) return null;
  return `${action.currency || 'EUR'} ${Math.round(amount)}`;
}

function actionConfirmationCard(actionApproval) {
  const action = actionApproval?.action;
  if (!action || action.status !== 'pending_approval') return null;
  const amount = moneyLabel(action);
  const cadence = cadenceLabel(action.cadence);
  const target = action.goal_name || action.category || 'selected goal';
  const draft = action.action_type === 'expense_review_habit'
    ? `Review ${String(target).toLowerCase()} ${action.cadence || 'monthly'}`
    : `${amount || 'Selected amount'}/${cadence} to ${target}`;
  const details = [
    action.goal_name ? `Goal: ${action.goal_name}` : null,
    action.category ? `Category: ${action.category}` : null,
    amount ? `Amount: ${amount}` : null,
    action.cadence ? `Cadence: ${action.cadence}` : null
  ].filter(Boolean);

  return {
    title: actionTypeLabel(action.action_type),
    draft,
    status: statusLabel(action.status),
    details,
    options: action.action_type === 'expense_review_habit'
      ? ['Approve', 'Choose category', 'Not now']
      : ['Approve', 'Edit amount', 'Not now'],
    action_id: action.action_id
  };
}

function offlineNoraTurn({ user, memory, snapshot, latestUserMessage, noraTurnIndex }) {
  const goal = user.savingsGoal || 'your first money goal';
  const text = String(latestUserMessage || '').toLowerCase();
  const goalPlan = createGoalSavingsPlan({
    userId: user.userId,
    goalName: goal,
    currency: snapshot.currency,
    riskComfort: riskComfortFromUser(user),
    financialSnapshot: snapshot,
    userMemory: memory
  });
  const starterAmount = goalPlan.recommended_option?.monthly_contribution || 25;
  const gentleAmount = goalPlan.options.find((option) => option.id === 'gentle')?.monthly_contribution || starterAmount;
  const blocker = text.includes('confus') ? 'confusion' : text.includes('risk') || text.includes('lose') ? 'risk' : text.includes('money') || text.includes('small') ? 'amount_feels_too_small' : 'not_getting_around_to_it';
  const educationLesson = createEducationRiskLesson({
    userId: user.userId,
    currentBlocker: memory.investment_journey?.first_investment_blockers?.[0] || blocker,
    riskComfort: riskComfortFromUser(user),
    preferredFormat: memory.financial_understanding?.preferred_content_format || 'short_card',
    goalPlan,
    userMemory: memory
  });
  const expenseReview = createExpenseReview({
    userId: user.userId,
    recurringExpenses: snapshot.recurring_expenses_detected,
    latestUserMessage,
    financialSnapshot: snapshot,
    goalPlan,
    userMemory: memory
  });
  const learningProgressSeen = createLearningProgress({
    userId: user.userId,
    educationLesson,
    latestUserMessage,
    progressEvent: 'lesson_seen',
    goalPlan,
    expenseReview,
    investmentBlocker: memory.investment_journey?.first_investment_blockers?.[0] || blocker,
    userMemory: memory
  });
  const learningProgressApplied = createLearningProgress({
    userId: user.userId,
    educationLesson,
    latestUserMessage,
    progressEvent: 'applied_to_savings_plan',
    goalPlan,
    expenseReview,
    investmentBlocker: memory.investment_journey?.first_investment_blockers?.[0] || blocker,
    userMemory: memory
  });
  const snapshotInsight = createSnapshotInsight({
    userId: user.userId,
    mode: 'next_best_action',
    bankContext: {
      user_first_name: user.firstName,
      age: user.age,
      currency: 'EUR'
    },
    userMemory: memory,
    financialSnapshot: snapshot,
    goalPlan,
    expenseReview,
    educationLesson,
    learningProgress: learningProgressApplied,
    recommendationHistory: memory.recommendation_history,
    conversationSoFar: []
  });
  const resourceSuggestion = suggestEducationResource({
    userId: user.userId,
    educationLesson,
    learningProgress: learningProgressApplied,
    userMemory: memory,
    latestUserMessage,
    recommendationHistory: memory.recommendation_history
  });
  const blockerWarmLine = blocker === 'confusion'
    ? 'Totally fair. Investing can look like a club where everyone else got the glossary at birth.'
    : blocker === 'risk'
      ? 'That is a good instinct, not a flaw. Risk should earn your trust before it gets any of your money.'
      : blocker === 'amount_feels_too_small'
        ? 'Small-budget starting points are still real starting points. The trick is making the amount repeatable.'
        : 'That is very human. Good money habits usually need a system more than a burst of motivation.';

  if (noraTurnIndex === 0) {
    return {
      visible_response: `Hi, I'm Nora! I help make money decisions smaller and clearer: saving goals, spending patterns, first investing steps, and all the questions that feel too basic to ask. You can ask me anything anytime.\n\nI can already see the basics from your Nordea context, so I will not make you fill out a personality quiz disguised as banking.\n\nI can also see you have not started investing with us yet. Very normal. Quick investing check: what is the main thing holding you back right now - risk, confusion, feeling like the amount is too small, or just not getting around to it yet?`,
      intent: 'first_conversation',
      nora_action: 'ask_question',
      tool_requests: [],
      recommendation_card: null,
      trust_ledger_entry: null,
      memory_updates: [
        { field: 'investment_journey.has_nordea_investments', value: false, source: 'bank_context', confidence: 'high' },
        { field: 'user.age', value: user.age, source: 'bank_context', confidence: 'high' }
      ],
      next_best_question: 'What is the main thing holding you back from investing?',
      education_hook: null,
      safety_flags: []
    };
  }

  if (noraTurnIndex === 1) {
    return {
      visible_response: `${blockerWarmLine}\n\nNo finance-person cosplay required. The first useful move is not picking an investment. It is finding a safe-to-repeat amount that does not make the rest of your month weird.\n\nBased on your current money picture, I would start by checking whether EUR ${snapshot.safe_to_save_estimate}/month could be safe without touching essentials. Want me to show the simple monthly table behind that number?`,
      intent: 'investment_readiness',
      nora_action: 'ask_question',
      tool_requests: [{ name: 'create_recurring_expense_table', reason: 'Show basis for safe monthly habit' }],
      recommendation_card: null,
      trust_ledger_entry: null,
      memory_updates: [
        { field: 'investment_journey.first_investment_blockers', value: [blocker], source: 'explicit_user', confidence: 'high' },
        { field: 'investment_journey.readiness_stage', value: 'curious', source: 'inferred_from_conversation', confidence: 'medium' }
      ],
      next_best_question: 'Want me to show the simple monthly table behind that number?',
      education_hook: { topic: 'What investing risk means', reason: 'User showed first-investment uncertainty', format_suggestion: 'short_card' },
      safety_flags: []
    };
  }

  if (noraTurnIndex === 2) {
    const adjustmentText = goalPlan.requires_adjustment
      ? `\n\nReal talk on the goal: ${goalPlan.nora_summary} I would not call that solved. I would call it a good starter habit, then pick a lever: smaller first milestone, longer timeline, one-off contributions, or shared contribution.`
      : goalRealismNudge(goalPlan);
    const actionApproval = createActionApproval({
      userId: user.userId,
      operation: 'create_draft',
      actionType: 'savings_transfer_draft',
      amount: starterAmount,
      currency: 'EUR',
      cadence: 'monthly',
      goalId: goalPlan.goal_id,
      goalName: goal,
      sourceAgent: 'goal_savings_plan',
      userMemory: memory
    });
    return {
      visible_response: `Let's put numbers on it!\n\nYour income and recurring expenses suggest a small monthly habit could fit, but I would keep the first draft intentionally modest: EUR ${starterAmount}/month toward ${goal}.${adjustmentText}\n\nI put the next step into a draft so the choice is clean. You can approve it, edit the amount, leave it parked, or use it as the starter habit while we set a first milestone.`,
      intent: 'savings_plan',
      nora_action: 'request_approval',
      tool_requests: [
        { name: 'goal_savings_plan_agent', reason: `Assess feasibility and create plan for ${goal}` },
        { name: 'action_approval_agent', reason: 'Create demo-only savings draft and approval state' },
        { name: 'write_trust_ledger', reason: 'Explain recommendation basis' },
        { name: 'action_approval_agent', reason: 'Request explicit approval without real execution' }
      ],
      goal_plan: goalPlan,
      action_confirmation_card: actionConfirmationCard(actionApproval),
      action_approval: actionApproval,
      recommendation_card: goalPlan.recommendation_card,
      trust_ledger_entry: trustLedgerFromGoalPlan(goalPlan),
      memory_updates: [
        { field: 'preferences.wants_expense_tables', value: true, source: 'inferred_from_conversation', confidence: 'medium' },
        ...goalPlan.memory_updates,
        ...actionApprovalMemoryUpdates(actionApproval)
      ],
      next_best_question: 'Approve the starter habit, adjust target/timeline, or keep it as a learning plan?',
      education_hook: { topic: 'Why savings-first usually comes before investing', reason: 'Nora proposed a first monthly habit', format_suggestion: 'short_card' },
      safety_flags: [...goalPlan.safety_flags, 'education_before_investment_action']
    };
  }

  if (noraTurnIndex === 3) {
    const editRequested = text.includes('edit amount') || text.includes('lower it') || text.includes('adjust');
    const notNow = text.includes('not now') || text.includes('learning plan first') || text.includes('draft only');
    const approved = !editRequested && !notNow && (text.includes('approve') || text.includes('yes') || text.includes('ok') || text.includes('sounds good'));
    const savingsDraft = latestAction(memory, 'savings_transfer_draft', ['pending_approval', 'edited', 'draft']);
    const actionApproval = approved && savingsDraft
      ? createActionApproval({
          userId: user.userId,
          operation: 'approve',
          actionType: 'savings_transfer_draft',
          actionId: savingsDraft.action_id,
          userMemory: memory
        })
      : null;
    const approvedText = goalPlan.requires_adjustment
      ? `Good. I will treat EUR ${starterAmount}/month as a starter habit, not as a full solution for ${goal}.\n\nThis goal still needs a realism check before it can be called solved. Useful choice now: keep the monthly amount low, or change the timeline/milestone so the goal has a sane path?`
      : `Good. Small, repeatable, and not secretly stressful. That is the bar. I marked the EUR ${starterAmount}/month savings draft as approved.\n\nBefore we connect anything to investing, one safety step comes first: understand what risk means in normal language. After that, should this goal plan optimize for a lower monthly amount or a faster timeline?`;
    return {
      visible_response: approved
        ? approvedText
        : `That is sensible. Keeping it as a learning plan first is not hesitation; it is good control.\n\nFor ${goal}, there are two honest routes: keep the monthly amount low, or reach the goal faster. Which would feel more realistic for you right now?`,
      intent: approved ? 'savings_plan' : 'education_bridge',
      nora_action: approved ? 'update_memory' : 'ask_question',
      tool_requests: approved
        ? [
            { name: 'action_approval_agent', reason: 'Approve savings draft in demo memory only' },
            { name: 'update_user_memory', reason: 'Persist decision and next education topic' }
          ]
        : [{ name: 'update_user_memory', reason: 'Persist decision and next education topic' }],
      action_approval: actionApproval,
      action_confirmation_card: null,
      recommendation_card: approved ? {
        title: goalPlan.requires_adjustment ? `Approved starter habit for ${goal}` : `Approved draft for ${goal}`,
        summary: goalPlan.requires_adjustment
          ? `EUR ${starterAmount}/month starter habit approved in demo memory. Full goal still needs adjustment.`
          : `EUR ${starterAmount}/month savings habit approved in demo memory. Investment remains education-only for now.`,
        amount: starterAmount,
        currency: 'EUR',
        cadence: 'monthly',
        status: 'approved_in_demo_memory'
      } : null,
      trust_ledger_entry: null,
      memory_updates: [
        { field: 'investment_journey.readiness_stage', value: approved ? 'approved_first_habit' : 'curious', source: 'explicit_user', confidence: 'high' },
        { field: 'financial_understanding.confusing_topics', value: ['investment risk'], source: 'inferred_from_conversation', confidence: 'medium' },
        ...actionApprovalMemoryUpdates(actionApproval)
      ],
      next_best_question: 'Lower monthly amount or faster timeline?',
      education_hook: { topic: 'What investment risk means', reason: 'Next step after savings habit draft', format_suggestion: 'short_card' },
      safety_flags: []
    };
  }

  if (noraTurnIndex === 4) {
    const adjustmentNote = goalPlan.requires_adjustment
      ? `\n\nRealism check: this goal needs adjustment. Even the faster safe options are too slow to call the full goal solved. Mathematically possible is not the same as motivating. The honest next step is to pick a lever: smaller first milestone, longer timeline, one-off contributions, or shared contribution.`
      : goalRealismNudge(goalPlan);
    return {
      visible_response: `Let's make the choices visible.\n\n${goalPlanOptionTable(goalPlan)}${adjustmentNote}\n\nMy bias is still to start with the plan you can actually keep. Should I keep Gentle as the draft, compare the other options, or adjust the goal?`,
      intent: 'goal_planning',
      nora_action: 'propose_plan',
      tool_requests: [{ name: 'goal_savings_plan_agent', reason: `Compare contribution plans and feasibility for ${goal}` }],
      goal_plan: goalPlan,
      recommendation_card: {
        ...goalPlan.recommendation_card,
        title: `Plan options for ${goal}`,
        summary: goalPlan.requires_adjustment
          ? `Gentle starts at EUR ${gentleAmount}/month, but the full goal needs adjustment before approval.`
          : `Recommended draft: EUR ${starterAmount}/month. No investment action yet.`
      },
      trust_ledger_entry: trustLedgerFromGoalPlan(goalPlan),
      memory_updates: goalPlan.memory_updates,
      next_best_question: 'Keep Gentle, compare options, or adjust the goal?',
      education_hook: null,
      safety_flags: goalPlan.safety_flags
    };
  }

  if (noraTurnIndex === 5) {
    const wantsGoalAdjustment = text.includes('adjust') || text.includes('milestone') || text.includes('too long');
    const options = expenseReview.suggested_review_options.slice(0, 3).map((option) => option.toLowerCase());
    const optionText = options.length ? `${options.join(', ')}, or skip expense review` : 'skip expense review';
    return {
      visible_response: wantsGoalAdjustment
        ? `Right. I will not pretend the full ${goal} is solved. I will store EUR ${gentleAmount}/month as the starter habit and mark the goal as needing a smaller first milestone or outside contribution.\n\nNext useful step: let's look for one recurring category that might protect this habit without turning your life into a punishment spreadsheet. Joy is not on trial. Want to review ${optionText} for now?`
        : `Gentle it is! I will keep EUR ${gentleAmount}/month as the draft plan.\n\nNext useful step: let's look for one recurring category that might make this easier without turning your life into a punishment spreadsheet. Joy is not on trial. Want to review ${optionText} for now?`,
      intent: 'expense_tracking',
      nora_action: 'ask_question',
      tool_requests: [{ name: 'expense_review_agent', reason: 'Find one safe recurring category to inspect before any cuts' }],
      recommendation_card: null,
      trust_ledger_entry: null,
      memory_updates: [
        { field: 'preferences.likes_future_self_framing', value: true, source: 'inferred_from_conversation', confidence: 'medium' },
        { field: 'investment_journey.readiness_stage', value: wantsGoalAdjustment ? 'safety_first' : 'ready_to_plan', source: 'inferred_from_conversation', confidence: 'medium' }
      ],
      next_best_question: `Review ${optionText}?`,
      education_hook: null,
      safety_flags: []
    };
  }

  if (noraTurnIndex === 6) {
    const actionApproval = createActionApproval({
      userId: user.userId,
      operation: 'create_draft',
      actionType: 'expense_review_habit',
      category: expenseReview.suggested_category || 'one category',
      cadence: 'monthly',
      sourceAgent: 'expense_review',
      userMemory: memory
    });
    return {
      visible_response: `Here is the clean table version:\n\n${expenseReview.markdown_table}\n\n${expenseReview.nora_summary}\n\nI put the review habit into a draft. This is a check-in, not a joy audit. Would you be willing to make it a once-a-month habit to protect the EUR ${gentleAmount} plan?`,
      intent: 'expense_tracking',
      nora_action: 'ask_question',
      tool_requests: [
        { name: 'expense_review_agent', reason: 'Show recurring categories and create one review habit' },
        { name: 'action_approval_agent', reason: 'Create demo-only expense review habit draft' }
      ],
      expense_review: expenseReview,
      action_confirmation_card: actionConfirmationCard(actionApproval),
      action_approval: actionApproval,
      recommendation_card: null,
      trust_ledger_entry: trustLedgerFromExpenseReview(expenseReview),
      memory_updates: [
        ...expenseReview.memory_updates,
        ...actionApprovalMemoryUpdates(actionApproval)
      ],
      next_best_question: `Inspect ${expenseReview.suggested_category || 'one category'} monthly?`,
      education_hook: null,
      safety_flags: expenseReview.safety_flags
    };
  }

  if (noraTurnIndex === 7) {
    const reviewHabitDraft = latestAction(memory, 'expense_review_habit', ['pending_approval', 'edited', 'draft']);
    const actionApproval = reviewHabitDraft
      ? createActionApproval({
          userId: user.userId,
          operation: 'approve',
          actionType: 'expense_review_habit',
          actionId: reviewHabitDraft.action_id,
          userMemory: memory
        })
      : null;
    const personaSummary = user.firstName === 'Pekka'
      ? 'you want clear reasoning and control before anything retirement-related'
      : user.firstName === 'Aino'
        ? 'you want family-safe planning and realistic milestones'
        : riskComfortFromUser(user) === 'low'
          ? 'you prefer low-risk, simple steps'
          : 'you like automation when the guardrails are clear';
    const planSummary = goalPlan.requires_adjustment
      ? `your starter habit is EUR ${gentleAmount}/month toward ${goal}, but the full goal still needs an adjusted milestone or contribution plan`
      : `your draft is EUR ${gentleAmount}/month toward ${goal}`;
    return {
      visible_response: `Good. I marked ${expenseReview.suggested_category ? expenseReview.suggested_category.toLowerCase() : 'that'} as a review habit, not a cut. Very different energy.\n\nMoney friend recap: ${personaSummary}; ${planSummary}; ${expenseReview.review_habit.action.toLowerCase()}; and investing should stay education-first until risk feels less mysterious.\n\nWant the quick money card on "${educationLesson.topic}" now, or should I stop the demo conversation here?`,
      intent: 'education_bridge',
      nora_action: 'ask_question',
      tool_requests: [
        { name: 'action_approval_agent', reason: 'Approve expense review habit in demo memory only' },
        { name: 'update_user_memory', reason: 'Persist selected review habit and plan summary' }
      ],
      action_approval: actionApproval,
      action_confirmation_card: null,
      recommendation_card: null,
      trust_ledger_entry: null,
      memory_updates: [
        { field: 'investment_journey.readiness_stage', value: 'ready_to_plan', source: 'inferred_from_conversation', confidence: 'medium' },
        { field: 'financial_understanding.confusing_topics', value: ['investment risk'], source: 'inferred_from_conversation', confidence: 'medium' },
        ...expenseReview.memory_updates,
        ...actionApprovalMemoryUpdates(actionApproval)
      ],
      next_best_question: 'Read the quick money card now, or stop here?',
      education_hook: { topic: educationLesson.topic, reason: 'User wants education before investment approval', format_suggestion: educationLesson.format },
      safety_flags: []
    };
  }

  if (noraTurnIndex === 8) {
    return {
      visible_response: lessonVisibleText(educationLesson, gentleAmount),
      intent: 'education_bridge',
      nora_action: 'ask_question',
      tool_requests: [
        { name: 'education_risk_lesson_agent', reason: 'Serve first blocker-specific beginner lesson' },
        { name: 'learning_progress_agent', reason: 'Mark the topic as started without school-like framing' }
      ],
      education_lesson: educationLesson,
      learning_progress: learningProgressSeen,
      recommendation_card: null,
      trust_ledger_entry: null,
      memory_updates: [
        ...educationLesson.memory_updates,
        ...learningProgressSeen.memory_updates
      ],
      next_best_question: `Mark "${educationLesson.topic}" as the next step?`,
      education_hook: { topic: educationLesson.next_topic, reason: 'Next lesson after this check', format_suggestion: educationLesson.format },
      safety_flags: educationLesson.safety_flags
    };
  }

  if (noraTurnIndex === 9) {
    const resourceText = resourceSuggestionVisibleText(resourceSuggestion);
    return {
      visible_response: `Marked! First journey complete: one draft savings habit, one monthly review habit, and one concept made less mysterious before any investment action.\n\n${learningProgressVisibleText(learningProgressApplied)}\n\n${resourceText ? `${resourceText}\n\n` : ''}${snapshotInsightVisibleText(snapshotInsight)}\n\nYou can still ask me anything, anytime. I am also happy to stop here instead of inventing a new money task just to look busy.`,
      intent: 'education_bridge',
      nora_action: 'update_memory',
      tool_requests: [
        { name: 'learning_progress_agent', reason: 'Record concept applied through a savings-first decision' },
        { name: 'suggest_education_resource', reason: 'Suggest one curated resource after education progress' },
        { name: 'snapshot_insight_agent', reason: 'Summarize the first Nora journey and choose one next useful move' },
        { name: 'update_user_memory', reason: 'Persist completed first journey' }
      ],
      learning_progress: learningProgressApplied,
      resource_suggestion: resourceSuggestion,
      snapshot_insight: snapshotInsight,
      recommendation_card: null,
      trust_ledger_entry: null,
      memory_updates: [
        { field: 'investment_journey.readiness_stage', value: 'ready_to_plan', source: 'inferred_from_conversation', confidence: 'high' },
        ...learningProgressApplied.memory_updates,
        ...resourceSuggestion.memory_updates
      ],
      next_best_question: null,
      education_hook: null,
      safety_flags: []
    };
  }

  return {
    visible_response: `We have reached the natural stopping point for this test conversation: one goal draft, one review habit, one education next step. For a longer demo, the next module should be the education system rather than more looping chat.`,
    intent: 'education_bridge',
    nora_action: 'answer',
    tool_requests: [],
    recommendation_card: null,
    trust_ledger_entry: null,
    memory_updates: [],
    next_best_question: null,
    education_hook: { topic: 'Education system handoff', reason: 'Conversation completed the first Nora journey', format_suggestion: 'short_card' },
    safety_flags: []
  };
}

function offlineUserReply({ user, latestNoraText, conversation = [] }) {
  const lower = latestNoraText.toLowerCase();
  if (lower.includes('holding you back') || lower.includes('blocker')) {
    if (user.firstName === 'Emma') return { user_reply: 'Mostly confusion, honestly. I feel like investing is for people who already know what they are doing, and my budget is pretty small.', internal_reason: 'Emma is a low-risk student with limited income.' };
    if (user.firstName === 'Mikael') return { user_reply: 'Probably just not getting around to it. I like the idea of automating something small if it actually makes sense.', internal_reason: 'Mikael is practical and open to automation.' };
    if (user.firstName === 'Aino') return { user_reply: 'Risk, mostly. With a kid and a down payment goal, I do not want to do something clever that becomes expensive.', internal_reason: 'Aino is family-oriented and goal-driven.' };
    if (user.firstName === 'Pekka') return { user_reply: 'I am not against investing, but I would need very clear reasoning. Retirement money is not something I want guessed by an AI.', internal_reason: 'Pekka is skeptical and control-oriented.' };
    return { user_reply: 'I think it is a mix of risk and not knowing where to start. I would prefer something simple.', internal_reason: 'Sofia is low-risk and practical.' };
  }
  if (lower.includes('show the simple monthly table') || lower.includes('calculate')) {
    return { user_reply: 'Yes, show me the table first. I want to see where the number comes from.', internal_reason: 'Persona wants transparency before approval.' };
  }
  if (lower.includes('action confirmation') && lower.includes('review habit')) {
    return { user_reply: 'Approve the monthly review habit. I only want it as a check-in, not an automatic cut.', internal_reason: 'Persona approves the review habit from the confirmation card.' };
  }
  if (lower.includes('first journey complete') || lower.includes('complete first nora journey') || lower.includes('natural stopping point')) {
    return { user_reply: 'That is enough for now. I would come back to the learning card next.', internal_reason: 'Persona accepts the end of the test journey.' };
  }
  if (lower.includes('starter habit') && lower.includes('adjust') && !lower.includes('45-second') && !lower.includes('risk card')) {
    if (user.firstName === 'Aino') return { user_reply: 'Keep the starter habit, but I want a realistic first milestone instead of pretending the full down payment is handled.', internal_reason: 'Aino accepts habit-building but needs realistic family-goal planning.' };
    if (user.firstName === 'Pekka') return { user_reply: 'Keep it as a draft only. I want the assumptions and timeline clear before I call it approved.', internal_reason: 'Pekka requires control and clear reasoning.' };
    return { user_reply: 'Keep it as a starter habit for now. I want to understand the timeline before approving anything bigger.', internal_reason: 'Persona accepts a reversible first step.' };
  }
  if (lower.includes('gentle') && (lower.includes('adjust the goal') || lower.includes('compare the other options'))) {
    if (user.firstName === 'Aino') return { user_reply: 'Adjust the goal into a smaller first milestone. The full down payment timeline is too long at that amount.', internal_reason: 'Aino responds to the feasibility warning.' };
    if (user.riskProfile === 'low' || user.firstName === 'Pekka') return { user_reply: 'Keep Gentle as the draft. I like that it stays easy to maintain.', internal_reason: 'Persona chooses lower commitment.' };
    return { user_reply: 'Compare the other options, but I only want the version that stays clearly safe.', internal_reason: 'Persona wants comparison without pressure.' };
  }
  if (lower.includes('gentle') && lower.includes('faster')) {
    if (user.riskProfile === 'low' || user.firstName === 'Pekka') return { user_reply: 'Keep Gentle as the draft. I like that it sounds easy to maintain.', internal_reason: 'Persona chooses lower commitment.' };
    return { user_reply: 'Compare it with Faster, but I suspect I would still choose the safer one.', internal_reason: 'Persona wants comparison without pressure.' };
  }
  if ((lower.includes('monthly amount') && lower.includes('faster')) || lower.includes('faster timeline')) {
    if (user.riskProfile === 'low' || user.firstName === 'Pekka') return { user_reply: 'Lower monthly amount. I would rather keep it realistic than rush it.', internal_reason: 'Persona prefers sustainable plan over speed.' };
    return { user_reply: 'A faster timeline is interesting, but only if it still stays clearly safe.', internal_reason: 'Persona is open to more momentum with guardrails.' };
  }
  if (lower.includes('approve') || lower.includes('lower it')) {
    if (user.riskProfile === 'low') return { user_reply: 'Let us keep it as a learning plan first. I like the amount, but I want to understand the risk part before approving anything.', internal_reason: 'Low-risk persona delays investment approval.' };
    if (user.firstName === 'Pekka') return { user_reply: 'Lower it and keep it as a draft. I would want human-advisor context before doing anything retirement-related.', internal_reason: 'Pekka wants control and advisor framing.' };
    return { user_reply: 'That sounds reasonable. Approve the savings draft, but keep the investing part educational for now.', internal_reason: 'Medium-risk persona approves reversible savings action.' };
  }
  if (lower.includes('mark that as the next step')) {
    return { user_reply: 'Yes, mark that as the next step. That feels like enough for now.', internal_reason: 'Persona accepts the journey endpoint.' };
  }
  if (lower.includes('quick money card') || lower.includes('45-second') || lower.includes('risk card')) {
    return { user_reply: 'Show me the risk card. Short version please.', internal_reason: 'Persona wants education before investing.' };
  }
  if (lower.includes('one category') || lower.includes('inspect once a month') || lower.includes('inspect monthly') || lower.includes('once-a-month review habit')) {
    return { user_reply: 'Subscriptions once a month sounds manageable. I would not want more than that.', internal_reason: 'Persona accepts a small review habit.' };
  }
  if (lower.includes('subscriptions') || lower.includes('transport') || lower.includes('expense review')) {
    if (user.firstName === 'Sofia') return { user_reply: 'Let us review subscriptions. I do not want to cut anything automatically, but I can inspect them.', internal_reason: 'Sofia is practical and wants control.' };
    if (user.firstName === 'Pekka') return { user_reply: 'Review insurance or subscriptions, but only as information. No automatic changes.', internal_reason: 'Pekka wants control over changes.' };
    return { user_reply: 'Subscriptions are probably the easiest place to start. Show me that.', internal_reason: 'Persona picks a low-friction review category.' };
  }
  const fallbackOptions = [
    `My main goal is ${user.savingsGoal}. I want a plan that feels realistic, not overly optimistic.`,
    'That makes sense. I want to understand the next step before committing to anything.',
    'Keep it simple and reversible. That is the version I would actually use.'
  ];
  const fallbackIndex = conversation.filter((turn) => turn.role === 'Simulated User').length % fallbackOptions.length;
  return { user_reply: fallbackOptions[fallbackIndex], internal_reason: 'Fallback varied to avoid transcript loops.' };
}

function applyMemoryUpdates(memory, updates = []) {
  for (const update of updates) {
    memory.memory_events ||= [];
    memory.memory_events.push({ ...update, timestamp: new Date().toISOString() });
    const parts = String(update.field || '').split('.');
    if (!parts.length) continue;
    let target = memory;
    for (let i = 0; i < parts.length - 1; i++) {
      target[parts[i]] ||= {};
      target = target[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (Array.isArray(target[last]) && Array.isArray(update.value)) {
      target[last] = [...new Set([...target[last], ...update.value])];
    } else if (Array.isArray(target[last]) && update.value && typeof update.value === 'object') {
      const exists = target[last].some((item) => JSON.stringify(item) === JSON.stringify(update.value));
      if (!exists) target[last] = [...target[last], update.value];
    } else {
      target[last] = update.value;
    }
  }
}

async function runNora({ mode, noraPrompt, args, context, noraTurnIndex, user, memory, snapshot }) {
  if (mode === 'offline') return offlineNoraTurn({ user, memory, snapshot, latestUserMessage: context.latest_user_message, noraTurnIndex });
  const content = await callOpenRouter({
    model: args.noraModel,
    messages: [
      { role: 'system', content: noraPrompt },
      { role: 'user', content: `Return JSON only using Nora's Output Contract. Here is the current context:\n${JSON.stringify(context, null, 2)}` }
    ]
  });
  return parseJsonLoose(content);
}

async function runSimulatedUser({ mode, simulatedUserPrompt, args, user, conversation, latestNoraOutput }) {
  const latestNoraText = extractVisibleWithCards(latestNoraOutput);
  if (mode === 'offline') return offlineUserReply({ user, latestNoraText, conversation });
  const content = await callOpenRouter({
    model: args.userModel,
    messages: [
      { role: 'system', content: simulatedUserPrompt },
      { role: 'user', content: JSON.stringify({ persona: user, conversation_so_far: conversation, latest_nora_message: latestNoraText }, null, 2) }
    ]
  });
  const parsed = parseJsonLoose(content);
  return parsed.user_reply ? parsed : { user_reply: content.trim(), internal_reason: 'Raw model output fallback' };
}

function countMatches(text, pattern) {
  return (String(text || '').match(pattern) || []).length;
}

function evaluateConversation(conversation, finalMemory = {}) {
  const noraText = conversation.filter((t) => t.role === 'Nora').map((t) => t.text).join('\n');
  const structured = conversation.filter((t) => t.role === 'Nora').map((t) => t.structured).filter(Boolean);
  const confirmationCards = structured.map((s) => s.action_confirmation_card).filter(Boolean);
  const firstNoraText = conversation.find((t) => t.role === 'Nora')?.text || '';
  const noraTurns = conversation.filter((t) => t.role === 'Nora').map((t) => t.text.trim().replace(/\s+/g, ' '));
  const repeatedNoraTurns = noraTurns.filter((text, index) => index > 0 && text === noraTurns[index - 1]);
  const noraTurnCounts = new Map();
  for (const text of noraTurns) noraTurnCounts.set(text, (noraTurnCounts.get(text) || 0) + 1);
  const userTurns = conversation.filter((t) => t.role === 'Simulated User').map((t) => t.text.trim().replace(/\s+/g, ' '));
  const repeatedUserTurns = userTurns.filter((text, index) => index > 0 && text === userTurns[index - 1]);
  const userTurnCounts = new Map();
  for (const text of userTurns) userTurnCounts.set(text, (userTurnCounts.get(text) || 0) + 1);
  const snapshotOutputs = structured.map((s) => s.snapshot_insight).filter(Boolean);
  const actionOutputs = structured.map((s) => s.action_approval).filter(Boolean);
  const resourceOutputs = structured.map((s) => s.resource_suggestion).filter((s) => s?.status === 'available');
  const actionLog = finalMemory.action_state?.action_log || [];
  return {
    introducedNora: /i['’]?m nora|i am nora/i.test(noraText),
    firstNoraWarmIdentity: /money decisions smaller and clearer|saving goals, spending patterns, first investing steps|questions that feel too basic/i.test(firstNoraText),
    avoidedAgeQuestion: !/how old are you|what is your age|your birthday|date of birth/i.test(noraText),
    investmentHookEarly: /holding you back|investing|future-you/i.test(conversation.find((t) => t.role === 'Nora')?.text || ''),
    trustLedgerWhenRecommending: structured.some((s) => s.recommendation_card) ? structured.some((s) => s.trust_ledger_entry) : true,
    approvalGatePresent: structured.some((s) => s.trust_ledger_entry?.approval_required === true || s.safety_flags?.includes('approval_required_before_money_movement')),
    memoryUpdatesPresent: structured.some((s) => Array.isArray(s.memory_updates) && s.memory_updates.length > 0),
    goalPlanAgentUsed: noraTurns.length >= 3 ? structured.some((s) => s.goal_plan?.agent === 'goal_savings_plan') : true,
    expenseReviewAgentUsed: noraTurns.length >= 7 ? structured.some((s) => s.expense_review?.agent === 'expense_review') : true,
    expenseReviewNoAutoCancel: noraTurns.length >= 7 ? structured.some((s) => s.expense_review?.safety_flags?.includes('no_automatic_cancellations')) : true,
    educationAgentUsed: noraTurns.length >= 9 ? structured.some((s) => s.education_lesson?.agent === 'education_risk_lesson') : true,
    educationHasCheckQuestion: noraTurns.length >= 9 ? structured.some((s) => Array.isArray(s.education_lesson?.check_questions) && s.education_lesson.check_questions.length > 0) : true,
    learningProgressAgentUsed: noraTurns.length >= 10 ? structured.some((s) => s.learning_progress?.agent === 'learning_progress') : true,
    learningProgressNoRawStatusInVisible: !/\bseen\b|\bexplored\b|\bunseen\b|\bapplied\b|internal_status/.test(noraText),
    snapshotInsightAgentUsed: noraTurns.length >= 10 ? snapshotOutputs.some((s) => s.agent === 'snapshot_insight') : true,
    snapshotIncludesNextAction: noraTurns.length >= 10 ? snapshotOutputs.some((s) => s.next_best_action?.action_type) : true,
    snapshotMemoryReviewDoesNotAutoUpdate: snapshotOutputs.length ? snapshotOutputs.every((s) => Array.isArray(s.memory_updates) && s.memory_updates.length === 0) : true,
    resourceSuggestionShown: noraTurns.length >= 10 ? resourceOutputs.some((s) => s.agent === 'education_resource_suggestion') : true,
    resourceSuggestionNotEveryTurn: resourceOutputs.length <= 2,
    resourceSuggestionMatchesLearningDomain: resourceOutputs.length ? structured.some((s) => s.resource_suggestion?.status === 'available' && s.learning_progress?.domain === s.resource_suggestion.resource?.domain) : true,
    resourceSuggestionNoHomeworkTone: resourceOutputs.length ? resourceOutputs.every((s) => !/homework|study|course/i.test(s.nora_line || '')) : true,
    resourceSuggestionNoReturnPromise: resourceOutputs.length ? resourceOutputs.every((s) => !/guarantee|guaranteed|certain return|profit promise/i.test(`${s.nora_line || ''} ${s.resource?.summary || ''}`)) : true,
    actionApprovalAgentUsed: noraTurns.length >= 3 ? actionOutputs.some((s) => s.agent === 'action_approval') : true,
    actionConfirmationCardPresent: noraTurns.length >= 3 ? confirmationCards.some((card) => card.status === 'Ready for approval') : true,
    actionConfirmationCardProductWording: confirmationCards.length ? confirmationCards.every((card) => Array.isArray(card.options) && card.options.includes('Approve') && card.options.includes('Not now') && card.options.some((option) => /^Edit|^Choose/.test(option)) && !/demo|not executed|Action\/Approval Agent/i.test(JSON.stringify(card))) : true,
    actionExecutionModeDemoOnly: actionOutputs.length ? actionOutputs.every((s) => s.execution_mode === 'demo_memory_only' && s.action?.execution_mode === 'demo_memory_only') : true,
    actionLogPresent: noraTurns.length >= 3 ? actionLog.length > 0 : true,
    noRealMoneyMovementLanguage: !/transfer completed|investment purchased|subscription cancelled|shared with family/i.test(noraText),
    noInternalAgentNamesVisible: !/Action\/Approval Agent|Expense Review Agent|planning agent|Goal\/Savings Plan Agent|Learning Progress Agent|Snapshot \/ Insights Agent/i.test(noraText),
    limitedFutureYouCatchphrase: countMatches(noraText, /future-you/gi) <= 2,
    limitedTinyLanguage: countMatches(noraText, /\btiny\b/gi) <= 3,
    limitedBoringLanguage: countMatches(noraText, /\bboring\b/gi) <= 2,
    fundsSuggestedOnlyAfterEducation: /Funds/.test(noraText) ? structured.findIndex((s) => s.learning_progress?.next_domain_suggestion === 'Funds') >= 8 : true,
    unrealisticGoalFlagged: /down payment/i.test(noraText) ? /needs adjustment|too slow|not enough|unrealistic/i.test(noraText) : true,
    slowLaptopGoalFlagged: /laptop/i.test(noraText) ? /probably too slow|starter habit|first milestone|willing to wait/i.test(noraText) : true,
    oneQuestionStyle: !/\?[^\n]*\?[^\n]*\?/m.test(noraText),
    noRepeatedNoraResponses: repeatedNoraTurns.length === 0 && [...noraTurnCounts.values()].every((count) => count <= 1),
    noRepeatedUserResponses: repeatedUserTurns.length === 0 && [...userTurnCounts.values()].every((count) => count <= 1)
  };
}

function renderActionConfirmationCard(card) {
  const lines = [
    '**Action Confirmation**',
    '',
    `Type: ${card.title}`,
    `Draft: ${card.draft}`,
    `Status: ${card.status}`
  ];
  if (Array.isArray(card.details) && card.details.length) {
    lines.push('');
    for (const detail of card.details) lines.push(`- ${detail}`);
  }
  if (Array.isArray(card.options) && card.options.length) {
    lines.push('');
    lines.push(`Options: ${card.options.join(' | ')}`);
  }
  return lines;
}

function renderResourceSuggestionCard(resourceSuggestion) {
  const resource = resourceSuggestion?.resource;
  if (resourceSuggestion?.status !== 'available' || !resource) return [];
  const lines = [
    '**Resource Suggestion**',
    '',
    `Title: ${resource.title}`,
    `Format: ${resource.format}`,
    `Domain: ${resource.domain}`,
    `Source: ${resource.source}`,
    `URL: ${resource.url}`
  ];
  if (resource.estimated_time_minutes) lines.push(`Estimated time: ${resource.estimated_time_minutes} min`);
  return lines;
}

function renderMarkdown({ user, mode, modelInfo, snapshot, conversation, evaluation }) {
  const lines = [];
  lines.push(`# Nora Simulation: ${user.fullName} (${user.userId})`);
  lines.push('');
  lines.push(`- Mode: ${mode}`);
  lines.push(`- Nora model: ${modelInfo.noraModel}`);
  lines.push(`- Simulated user model: ${modelInfo.userModel}`);
  lines.push(`- Age: ${user.age}`);
  lines.push(`- Occupation: ${user.occupation}`);
  lines.push(`- Nordea tier: ${user.nordeaTier}`);
  lines.push(`- Savings goal: ${user.savingsGoal}`);
  lines.push(`- Risk profile: ${user.riskProfile}`);
  lines.push(`- Safe-to-save estimate: EUR ${snapshot.safe_to_save_estimate}/month`);
  lines.push('');
  lines.push('## Evaluation');
  lines.push('');
  for (const [key, value] of Object.entries(evaluation)) lines.push(`- ${key}: ${value ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push('## Conversation');
  lines.push('');
  let noraCount = 0;
  let userCount = 0;
  for (const turn of conversation) {
    if (turn.role === 'Nora') {
      noraCount++;
      lines.push(`### Turn ${noraCount} - Nora`);
      lines.push('');
      lines.push(turn.text);
      if (turn.structured?.recommendation_card) {
        lines.push('');
        lines.push('**Recommendation Card**');
        lines.push('```json');
        lines.push(JSON.stringify(turn.structured.recommendation_card, null, 2));
        lines.push('```');
      }
      if (turn.structured?.goal_plan) {
        lines.push('');
        lines.push('**Goal/Savings Plan Agent**');
        lines.push('```json');
        lines.push(JSON.stringify(turn.structured.goal_plan, null, 2));
        lines.push('```');
      }
      if (turn.structured?.education_lesson) {
        lines.push('');
        lines.push('**Education/Risk Lesson Agent**');
        lines.push('```json');
        lines.push(JSON.stringify(turn.structured.education_lesson, null, 2));
        lines.push('```');
      }
      if (turn.structured?.expense_review) {
        lines.push('');
        lines.push('**Expense Review Agent**');
        lines.push('```json');
        lines.push(JSON.stringify(turn.structured.expense_review, null, 2));
        lines.push('```');
      }
      if (turn.structured?.learning_progress) {
        lines.push('');
        lines.push('**Learning Progress Agent**');
        lines.push('```json');
        lines.push(JSON.stringify(turn.structured.learning_progress, null, 2));
        lines.push('```');
      }
      if (turn.structured?.snapshot_insight) {
        lines.push('');
        lines.push('**Snapshot / Insights Agent**');
        lines.push('```json');
        lines.push(JSON.stringify(turn.structured.snapshot_insight, null, 2));
        lines.push('```');
      }
      if (turn.structured?.resource_suggestion?.status === 'available') {
        lines.push('');
        lines.push(...renderResourceSuggestionCard(turn.structured.resource_suggestion));
        lines.push('');
        lines.push('**Education Resource Suggestion Tool**');
        lines.push('```json');
        lines.push(JSON.stringify(turn.structured.resource_suggestion, null, 2));
        lines.push('```');
      }
      if (turn.structured?.action_confirmation_card) {
        lines.push('');
        lines.push(...renderActionConfirmationCard(turn.structured.action_confirmation_card));
      }
      if (turn.structured?.action_approval) {
        lines.push('');
        lines.push('**Action / Approval Agent**');
        lines.push('```json');
        lines.push(JSON.stringify(turn.structured.action_approval, null, 2));
        lines.push('```');
      }
      if (turn.structured?.trust_ledger_entry) {
        lines.push('');
        lines.push('**Trust Ledger**');
        lines.push('```json');
        lines.push(JSON.stringify(turn.structured.trust_ledger_entry, null, 2));
        lines.push('```');
      }
      if (turn.structured?.memory_updates?.length) {
        lines.push('');
        lines.push('**Memory Updates**');
        lines.push('```json');
        lines.push(JSON.stringify(turn.structured.memory_updates, null, 2));
        lines.push('```');
      }
      lines.push('');
    } else {
      userCount++;
      lines.push(`### Turn ${userCount} - Simulated User`);
      lines.push('');
      lines.push(turn.text);
      if (turn.internal_reason) {
        lines.push('');
        lines.push(`_Internal reason: ${turn.internal_reason}_`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function renderRunIndex(manifest) {
  const lines = [];
  lines.push(`# Nora Simulation Run`);
  lines.push('');
  lines.push(`- Created: ${manifest.createdAt}`);
  lines.push(`- Mode: ${manifest.mode}`);
  lines.push(`- Data: ${manifest.data}`);
  lines.push(`- Transcript folder: ${manifest.runDir}`);
  lines.push('');
  lines.push('## Users');
  lines.push('');
  for (const user of manifest.users) {
    const failed = Object.entries(user.evaluation).filter(([, ok]) => !ok).map(([key]) => key);
    lines.push(`- ${user.fullName} (${user.userId}): ${failed.length ? `FAIL ${failed.join(', ')}` : 'PASS'}`);
    lines.push(`  - Markdown: ${user.markdownTranscript}`);
    lines.push(`  - Structured data: ${user.jsonTranscript}`);
  }
  lines.push('');
  return lines.join('\n');
}
async function runConversation({ user, args, noraPrompt, simulatedUserPrompt, runDir, structuredDir }) {
  const snapshot = buildFinancialSnapshot(user);
  const memory = initialMemory(user);
  const conversation = [];
  let latestUserMessage = '';

  for (let i = 0; i < args.turns; i++) {
    const context = buildNoraContext(user, memory, snapshot, latestUserMessage, i === 0, conversation);
    const noraOutput = await runNora({ mode: args.mode, noraPrompt, args, context, noraTurnIndex: i, user, memory, snapshot });
    applyMemoryUpdates(memory, noraOutput.memory_updates);
    conversation.push({ role: 'Nora', text: extractVisible(noraOutput), structured: noraOutput });

    if (i === args.turns - 1) break;
    const simulated = await runSimulatedUser({ mode: args.mode, simulatedUserPrompt, args, user, conversation, latestNoraOutput: noraOutput });
    latestUserMessage = simulated.user_reply;
    conversation.push({ role: 'Simulated User', text: simulated.user_reply, internal_reason: simulated.internal_reason });
  }

  const evaluation = evaluateConversation(conversation, memory);
  const base = `${user.userId}_${slug(user.firstName)}`;
  const jsonPath = path.join(structuredDir, `${base}.json`);
  const mdPath = path.join(runDir, `${base}.md`);
  const payload = { user, snapshot, finalMemory: memory, conversation, evaluation, mode: args.mode };
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.writeFile(mdPath, renderMarkdown({ user, mode: args.mode, modelInfo: args, snapshot, conversation, evaluation }), 'utf8');
  return { user, evaluation, mdPath, jsonPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!['offline', 'openrouter'].includes(args.mode)) throw new Error('--mode must be offline or openrouter');
  if (args.mode === 'openrouter' && !process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required for --mode openrouter');

  const dataPath = resolveProjectPath(args.data);
  try { await fs.access(dataPath); }
  catch { throw new Error(`Data file not found: ${dataPath}\nRun: npm run import:data`); }

  const data = await readJson(args.data);
  const users = selectUsers(data.users || [], args.users);
  if (!users.length) throw new Error(`No users matched --users ${args.users}`);

  const noraPrompt = await readText('agent/system_prompt.md');
  const simulatedUserPrompt = await readText('tests/simulated_user_prompt.md');
  const runDir = resolveProjectPath(path.join(args.outDir, nowStamp()));
  const structuredDir = path.join(runDir, 'structured');
  await fs.mkdir(structuredDir, { recursive: true });

  const results = [];
  for (const user of users) {
    results.push(await runConversation({ user, args, noraPrompt, simulatedUserPrompt, runDir, structuredDir }));
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    mode: args.mode,
    data: path.relative(projectRoot, dataPath),
    runDir,
    users: results.map((result) => ({
      userId: result.user.userId,
      firstName: result.user.firstName,
      fullName: result.user.fullName,
      markdownTranscript: result.mdPath,
      jsonTranscript: result.jsonPath,
      evaluation: result.evaluation
    }))
  };
  await fs.writeFile(path.join(structuredDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  await fs.writeFile(path.join(runDir, 'index.md'), renderRunIndex(manifest), 'utf8');
  await fs.writeFile(resolveProjectPath(path.join(args.outDir, 'latest_run.txt')), runDir, 'utf8');

  console.log(`\nNora simulation complete (${args.mode}).`);
  console.log(`Transcripts: ${runDir}`);
  console.log(`Run index: ${path.join(runDir, 'index.md')}`);
  console.log(`Latest pointer: ${resolveProjectPath(path.join(args.outDir, 'latest_run.txt'))}`);
  for (const result of results) {
    const failed = Object.entries(result.evaluation).filter(([, ok]) => !ok).map(([k]) => k);
    console.log(`- ${result.user.firstName} (${result.user.userId}): ${failed.length ? `FAIL ${failed.join(', ')}` : 'PASS'} -> ${result.mdPath}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});






