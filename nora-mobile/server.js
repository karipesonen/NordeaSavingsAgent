import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import {
  NORA_ORCHESTRATOR_SYSTEM,
  PLAN_BUILDER_SYSTEM,
  EXPENSE_REVIEW_SYSTEM,
  EDUCATION_RISK_SYSTEM,
  ACTION_APPROVAL_SYSTEM,
} from './agents/prompts.js';
import { ensureCardMentions } from './agents/cardMentions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const client = new OpenAI({
  apiKey: process.env.AALTO_API_KEY,
  baseURL: process.env.AALTO_BASE_URL || 'https://llm-gateway.k8s.aalto.fi/api/v1',
});

const MODEL = process.env.AALTO_MODEL || 'RedHatAI/gemma-4-31B-it-FP8-Dynamic';
const SCRIPTED_PROFILE_ID = 'scripted_emma';
const TEST_DATA_PATH = join(__dirname, '..', 'synthetic_data', 'generated', 'nordea_5users_2025.json');
const WEEKS_PER_MONTH = 4.33;
const LUCA_URL = process.env.LUCA_URL || 'http://localhost:8001';       // server.py — web research
const LUCA_API_URL = process.env.LUCA_API_URL || 'http://localhost:8000'; // api.py — banking, investment, daily recap

// ── Load curated education resources ──────────────────────────────────────────
const RESOURCES = JSON.parse(
  readFileSync(join(__dirname, 'public', 'data', 'education-resources.json'), 'utf-8')
).resources;
const RESOURCE_BY_ID = Object.fromEntries(RESOURCES.map(r => [r.id, r]));

// Compact catalog string to inject into the education agent's system prompt.
function buildCatalogBlock() {
  const lines = RESOURCES.map(r =>
    `- id: ${r.id} | format: ${r.format} | domain: ${r.domain} | title: "${r.title}" | triggers: [${r.triggerKeywords.slice(0, 6).join(', ')}]`
  );
  return `<catalog>\n${lines.join('\n')}\n</catalog>`;
}
const CATALOG_BLOCK = buildCatalogBlock();

// ── Demo customer profiles ───────────────────────────────────────────────────
function parseJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf-8').replace(/^\uFEFF/, ''));
}

function eur(n) {
  return `EUR ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;
}

function weeklyToMonthlyDisplay(value) {
  return Math.round(Number(value || 0) * WEEKS_PER_MONTH);
}

function roundToNearest(value, step = 10) {
  return Math.max(0, Math.round(Number(value || 0) / step) * step);
}

function textFromMessages(messages = []) {
  return messages.map(m => m?.content || '').join('\n').toLowerCase();
}

function inferGoalHorizon(messages = []) {
  const text = textFromMessages(messages);
  if (/\b(retirement|pension|long[- ]term|first home|apartment|down payment|mortgage|invest(?:ing|ment)?|funds?|etf|index)\b/i.test(text)) {
    return 'long_or_investing';
  }
  if (/\b(laptop|phone|trip|travel|holiday|festival|concert|emergency|buffer|car|toyota|yaris)\b/i.test(text)) {
    return 'short_or_purchase';
  }
  return 'unknown';
}

function buildInvestmentBridge(monthlyRoom, messages = []) {
  if (!Number.isFinite(monthlyRoom) || monthlyRoom < 80) return null;

  const text = textFromMessages(messages);
  const horizon = inferGoalHorizon(messages);
  const investingCuriosity = /\b(invest|fund|funds|etf|stock|stocks|portfolio|risk|market)\b/i.test(text);
  const futureFundsRatio = horizon === 'long_or_investing' || investingCuriosity ? 0.3 : 0.2;
  const futureFundsAmount = Math.min(
    roundToNearest(monthlyRoom * futureFundsRatio, 10),
    Math.max(0, monthlyRoom - 50)
  );

  if (futureFundsAmount < 20) return null;

  const savingsAmount = Math.max(0, monthlyRoom - futureFundsAmount);
  const mode = horizon === 'short_or_purchase'
    ? 'short_goal_savings_first_funds_later'
    : 'savings_first_with_funds_next';

  return {
    monthlyRoom,
    savingsAmount,
    futureFundsAmount,
    mode,
    noraLine: `A clean split could be about EUR ${savingsAmount} toward the goal and EUR ${futureFundsAmount} as a future fund habit once short-term money is protected.`,
  };
}

function enrichExpenseReviewData(data = {}, { messages = [] } = {}) {
  const weeklyRoom = Number(data.weeklyRoom || 0);
  const monthlyRoom = Number.isFinite(Number(data.monthlyRoom))
    ? Number(data.monthlyRoom)
    : weeklyToMonthlyDisplay(weeklyRoom);
  return {
    ...data,
    monthlyRoom,
    investmentBridge: data.investmentBridge || buildInvestmentBridge(monthlyRoom, messages),
    items: Array.isArray(data.items)
      ? data.items.map(item => ({
          ...item,
          monthlyAmount: Number.isFinite(Number(item.monthlyAmount))
            ? Number(item.monthlyAmount)
            : weeklyToMonthlyDisplay(item.weeklyAmount),
        }))
      : [],
  };
}

function getExpenseMonthlyRoom(cards = [], sessionState = {}) {
  const expenseCard = cards.find(card => card.type === 'expense_review' && card.data);
  const cardMonthlyRoom = Number(expenseCard?.data?.monthlyRoom);
  if (Number.isFinite(cardMonthlyRoom) && cardMonthlyRoom > 0) return cardMonthlyRoom;

  const stateMonthlyRoom = Number(sessionState?.lastExpenseReview?.monthlyRoom);
  if (Number.isFinite(stateMonthlyRoom) && stateMonthlyRoom > 0) return stateMonthlyRoom;

  return null;
}

function normalizeExpenseAmountMentions(message = '', cards = [], sessionState = {}) {
  const monthlyRoom = getExpenseMonthlyRoom(cards, sessionState);
  if (!Number.isFinite(monthlyRoom) || monthlyRoom <= 0) return message;

  const replaceNearMonthlyRoom = (match, amount) => {
    const shownAmount = Number(String(amount || '').replace(',', '.'));
    if (!Number.isFinite(shownAmount) || Math.abs(shownAmount - monthlyRoom) > 2) {
      return match;
    }
    return match.replace(String(amount), String(monthlyRoom));
  };

  return message
    .replace(
      /(?:€\s*(\d{1,5}(?:[.,]\d{1,2})?)|EUR\s*(\d{1,5}(?:[.,]\d{1,2})?)|(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:euros?|EUR|€))/gi,
      (match, euroAmount, eurAmount, wordAmount) => {
        const amount = euroAmount || eurAmount || wordAmount;
        const shownAmount = Number(String(amount || '').replace(',', '.'));
        if (!Number.isFinite(shownAmount) || Math.abs(shownAmount - monthlyRoom) > 2) {
          return match;
        }
        if (euroAmount) return `€${monthlyRoom}`;
        if (eurAmount) return `EUR ${monthlyRoom}`;
        if (/€\s*$/i.test(match)) return `${monthlyRoom}€`;
        if (/EUR\s*$/i.test(match)) return `${monthlyRoom} EUR`;
        return `${monthlyRoom} euros`;
      }
    )
    .replace(
      /\b(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:\/\s*month|per month|a month|monthly)\b/gi,
      replaceNearMonthlyRoom
    );
}

function addInvestmentBridgeMention(message = '', cards = []) {
  const bridge = cards.find(card => card.type === 'expense_review')?.data?.investmentBridge;
  if (!bridge?.futureFundsAmount || !bridge?.savingsAmount) return message;
  if (/\b(fund|funds|invest|investment)\b/i.test(message)) return message;

  const line = `One possible path: EUR ${bridge.savingsAmount} toward the goal, EUR ${bridge.futureFundsAmount} as a future fund habit once short-term money is protected.`;
  return `${message || ''}\n\n${line}`.trim();
}

function iconForCategory(category = '') {
  const c = category.toLowerCase();
  if (c.includes('food')) return 'utensils';
  if (c.includes('transport')) return 'car';
  if (c.includes('subscription')) return 'tv';
  if (c.includes('leisure') || c.includes('travel')) return 'shopping-bag';
  if (c.includes('health')) return 'heart-pulse';
  if (c.includes('education')) return 'graduation-cap';
  if (c.includes('housing')) return 'home';
  if (c.includes('child')) return 'baby';
  return 'wallet';
}

// Group expenses by (category, description), rank by total spend within each
// category, and keep the top N. Surfaces the merchant-level facts Nora can use
// to say "Subscriptions are mostly Spotify and Netflix" without seeing raw
// transactions. Runs once per profile at load, never per chat turn.
function topMerchantsByCategory(expenses, monthCount, categories, maxPerCategory = 3) {
  const targetCategories = new Set(categories);
  const groups = {};

  for (const tx of expenses) {
    const category = tx.category || 'Other';
    if (!targetCategories.has(category)) continue;
    const description = String(tx.description || '').trim();
    if (!description) continue;
    if (!groups[category]) groups[category] = {};
    if (!groups[category][description]) groups[category][description] = { total: 0, count: 0 };
    groups[category][description].total += Math.abs(Number(tx.amount || 0));
    groups[category][description].count += 1;
  }

  const result = {};
  for (const [category, byDescription] of Object.entries(groups)) {
    const ranked = Object.entries(byDescription)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, maxPerCategory)
      .map(([name, { total, count }]) => ({
        name,
        monthly: Math.round(total / monthCount),
        count,
      }));
    if (ranked.length) result[category] = ranked;
  }
  return result;
}

function summarizeTransactions(user) {
  const transactions = Array.isArray(user.transactions) ? user.transactions : [];
  const expenses = transactions.filter(t => t.type === 'Expense' || Number(t.amount) < 0);
  const income = transactions.filter(t => t.type === 'Income' || Number(t.amount) > 0);
  const months = new Set(transactions.map(t => String(t.date || '').slice(0, 7)).filter(Boolean));
  const monthCount = Math.max(1, months.size || 12);
  const categoryTotals = {};

  for (const tx of expenses) {
    const category = tx.category || 'Other';
    categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(Number(tx.amount || 0));
  }

  const annualExpenses = Object.values(categoryTotals).reduce((sum, n) => sum + n, 0);
  const annualIncome = income.reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);
  const monthlyExpenses = annualExpenses / monthCount;
  const monthlyIncome = Number(user.monthlyIncome || 0) || (annualIncome / monthCount);
  const roughMonthlySurplus = monthlyIncome ? monthlyIncome - monthlyExpenses : 0;
  const subscriptionsAnnual = categoryTotals.Subscriptions || 0;

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, annual]) => ({
      name,
      annual: Math.round(annual),
      monthly: Math.round(annual / monthCount),
      weekly: Math.round(annual / monthCount / 4.33),
      icon: iconForCategory(name),
    }));

  const redirectCandidates = topCategories
    .filter(c => !['Housing', 'Childcare'].includes(c.name))
    .slice(0, 5)
    .map(c => ({
      name: c.name,
      sub: c.name === 'Subscriptions' ? 'Recurring services' : 'Flexible spending area',
      weeklyAmount: Math.max(5, Math.round(c.weekly * 0.15 / 5) * 5),
      icon: c.icon,
    }));

  // Always include Subscriptions if present — recurring services are where
  // merchant detail ("Spotify, Netflix, phone bill") feels most concrete, even
  // when total spend is small relative to other categories.
  const merchantCategories = Array.from(new Set([
    ...redirectCandidates.map(c => c.name),
    ...(categoryTotals.Subscriptions ? ['Subscriptions'] : []),
  ]));
  const topMerchants = topMerchantsByCategory(expenses, monthCount, merchantCategories);

  return {
    transactionCount: transactions.length,
    incomeTransactionCount: income.length,
    expenseTransactionCount: expenses.length,
    monthCount,
    monthlyIncome: Math.round(monthlyIncome),
    monthlyExpenses: Math.round(monthlyExpenses),
    roughMonthlySurplus: Math.round(roughMonthlySurplus),
    subscriptionsMonthly: Math.round(subscriptionsAnnual / monthCount),
    topCategories,
    redirectCandidates,
    topMerchants,
    weeklyRoomEstimate: redirectCandidates.reduce((sum, item) => sum + item.weeklyAmount, 0),
  };
}

function summarizeProfile(user) {
  const spending = summarizeTransactions(user);
  return {
    userId: user.userId,
    fullName: user.fullName,
    firstName: user.firstName,
    age: user.age,
    city: user.city,
    occupation: user.occupation,
    education: user.education,
    monthlyIncome: user.monthlyIncome,
    incomeSource: user.incomeSource,
    nordeaTier: user.nordeaTier,
    savingsGoal: user.savingsGoal,
    familyStatus: user.familyStatus,
    riskProfile: user.riskProfile,
    spending,
  };
}

let TEST_PROFILES = [];
try {
  const testData = parseJsonFile(TEST_DATA_PATH);
  TEST_PROFILES = (testData.users || []).map(summarizeProfile);
} catch (err) {
  console.warn(`Could not load demo profiles: ${err.message}`);
}

const SCRIPTED_PROFILE = {
  userId: SCRIPTED_PROFILE_ID,
  fullName: 'Emma',
  firstName: 'Emma',
  age: 28,
  city: 'Helsinki',
  occupation: 'Young professional',
  education: null,
  monthlyIncome: null,
  incomeSource: 'Salary',
  nordeaTier: 'Demo',
  savingsGoal: 'Open-ended first savings goal',
  familyStatus: 'Not specified',
  riskProfile: 'low',
  spending: null,
};

function getDemoProfile({ demoMode = 'scripted_emma', profileId } = {}) {
  if (demoMode !== 'test_profile') return SCRIPTED_PROFILE;
  return TEST_PROFILES.find(p => p.userId === profileId) || TEST_PROFILES[0] || SCRIPTED_PROFILE;
}

// ── Active context synthesis ─────────────────────────────────────────────────
// Reads memory + recent messages and produces a short <active_context> block
// that the orchestrator can use authoritatively — preventing the profile's
// savingsGoal from silently overriding what the user actually discussed.
function synthesizeActiveContext(messages, memory, profile) {
  const lines = ['<active_context>'];

  // --- Most recently captured goal from memory (written chronologically) ------
  // Memory entries are short factual strings written by the orchestrator itself.
  // The most recent one mentioning a savings goal, trip, or purchase is the
  // authoritative active topic.
  const GOAL_KEYWORDS = ['save', 'saving', 'trip', 'goal', 'apartment', 'buy',
                         'fund', 'laptop', 'car', 'travel', 'holiday', 'vacation'];
  const goalMemory = memory.filter(m =>
    GOAL_KEYWORDS.some(kw => m.toLowerCase().includes(kw))
  );

  if (goalMemory.length > 0) {
    const mostRecent = goalMemory[goalMemory.length - 1];
    lines.push(`Active goal from conversation memory: "${mostRecent}"`);
    lines.push(`This takes priority over the profile's default opening topic.`);
  } else {
    // No memory yet — scan recent user messages for a structured topic signal.
    // Extract rather than quote raw text, so the model gets a clear structured line.
    const recentUserMsgs = messages
      .filter(m => m.role === 'user')
      .slice(-8)
      .map(m => m.content);

    // Topic extractors: ordered by specificity. First match wins.
    const TOPIC_PATTERNS = [
      // Named destinations / trips
      { re: /\b(japan|tokyo|paris|london|barcelona|rome|new york|thailand|bali|iceland|portugal|spain|italy|greece|sweden|norway|denmark|amsterdam|berlin|vienna)\b/i,
        label: m => `trip to ${m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()}` },
      // Generic trip
      { re: /\b(trip|travel|holiday|vacation|flight)\b/i,
        label: () => 'a trip or travel goal' },
      // Housing
      { re: /\b(apartment|flat|house|home|deposit|mortgage)\b/i,
        label: () => 'buying a home or apartment' },
      // Emergency fund
      { re: /\b(emergency fund|safety net|buffer|rainy day)\b/i,
        label: () => 'building an emergency fund' },
      // Specific purchase
      { re: /\b(laptop|computer|phone|car|bike|bicycle|camera)\b/i,
        label: m => `buying a ${m[1].toLowerCase()}` },
      // Generic saving
      { re: /\b(save|saving|savings)\b/i,
        label: () => 'a savings goal (not yet specified)' },
    ];

    let detectedTopic = null;
    // Search messages from most recent backwards
    outer: for (const msg of [...recentUserMsgs].reverse()) {
      for (const { re, label } of TOPIC_PATTERNS) {
        const m = msg.match(re);
        if (m) { detectedTopic = label(m); break outer; }
      }
    }

    if (detectedTopic) {
      lines.push(`Detected active topic from conversation (not yet in memory): ${detectedTopic}.`);
      lines.push(`Treat this as the active goal. Do not fall back to the profile's default opening topic.`);
    } else {
      lines.push(`No specific goal detected in conversation yet. Fall back to profile's default opening topic if relevant.`);
    }
  }

  // --- Profile goal is explicitly a fallback -----------------------------------
  const isOpenEnded = !profile.savingsGoal ||
    profile.savingsGoal.toLowerCase().includes('open-ended') ||
    profile.savingsGoal.toLowerCase().includes('first savings');
  if (!isOpenEnded) {
    lines.push(`Profile default goal (fallback only — use if conversation above has no goal): ${profile.savingsGoal}`);
  }

  // --- Deferred signals -------------------------------------------------------
  const recentUserLower = messages
    .filter(m => m.role === 'user')
    .slice(-8)
    .map(m => m.content.toLowerCase());
  if (recentUserLower.some(m => m.includes('maybe later') || m.includes('not now') || m.includes('later'))) {
    lines.push(`The user deferred something earlier this session. Do not re-offer deferred actions unprompted.`);
  }

  // --- Disambiguation instruction ---------------------------------------------
  lines.push(`When the user says "build me a plan" without naming a goal: use the most recently captured goal above. Do not silently default to the profile goal.`);

  lines.push('</active_context>');
  return '\n\n' + lines.join('\n');
}

function buildCustomerContext(profile, demoMode = 'scripted_emma') {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    '<customer_context>',
    `Demo mode: ${demoMode}.`,
    `Today's date: ${today}. All goal deadlines and plans must use dates after this.`,
    `Customer: ${profile.firstName}${profile.age ? `, age ${profile.age}` : ''}${profile.city ? `, ${profile.city}` : ''}.`,
    profile.occupation ? `Occupation: ${profile.occupation}.` : null,
    profile.familyStatus ? `Family status: ${profile.familyStatus}.` : null,
    profile.monthlyIncome ? `Monthly income: ${eur(profile.monthlyIncome)}.` : null,
    profile.incomeSource ? `Income source: ${profile.incomeSource}.` : null,
    profile.savingsGoal ? `Default opening topic (use only before the customer has expressed any goal in conversation): ${profile.savingsGoal}.` : null,
    profile.riskProfile ? `Risk profile: ${profile.riskProfile}.` : null,
    'Age and basic profile facts are bank-known. Do not ask for them unless missing.',
  ].filter(Boolean);

  if (profile.spending) {
    const s = profile.spending;
    lines.push(`Transactions in demo data: ${s.transactionCount} total, ${s.expenseTransactionCount} expenses, ${s.incomeTransactionCount} income entries across ${s.monthCount} months.`);
    lines.push(`Estimated monthly expenses: ${eur(s.monthlyExpenses)}. Rough monthly surplus: ${eur(s.roughMonthlySurplus)}.`);
    lines.push(`Subscriptions: about ${eur(s.subscriptionsMonthly)} per month.`);
    lines.push(`Top yearly spending categories: ${s.topCategories.map(c => `${c.name} ${eur(c.annual)}/year`).join('; ')}.`);
    lines.push(`Expense review candidates: ${s.redirectCandidates.map(c => `${c.name} about EUR ${c.weeklyAmount}/week`).join('; ') || 'none obvious'}.`);
    if (s.topMerchants && Object.keys(s.topMerchants).length) {
      // Subscriptions first when present (recurring services give the most
      // recognizable merchant names), then the rest in whatever order the
      // extractor returned them.
      const orderedCategories = [
        ...(s.topMerchants.Subscriptions ? ['Subscriptions'] : []),
        ...Object.keys(s.topMerchants).filter(c => c !== 'Subscriptions'),
      ].slice(0, 4);
      const merchantParts = orderedCategories.map(
        cat => `${cat} — ${s.topMerchants[cat].map(m => m.name).join(', ')}`,
      );
      lines.push(`Top merchants in flexible categories (deterministic, drawn from real transaction descriptions): ${merchantParts.join('; ')}. Reference these by name when it adds specificity; do not invent merchant names not listed here.`);
    }
  } else {
    lines.push('No transaction summary is attached. Use the scripted demo assumptions if spending review is requested.');
  }

  lines.push('</customer_context>');
  return lines.join('\n');
}

function profileLabel(profile) {
  return `${profile.firstName} - ${profile.savingsGoal || 'Demo profile'}`;
}

function hardcodedFirstReply(profile) {
  return `Hey ${profile.firstName} — I'm Nora, your savings copilot. No forms, no jargon. What's on your mind today, or what are you trying to save toward?`;
}

function defaultSuggestedReplies(profile) {
  if (profile.userId !== SCRIPTED_PROFILE_ID && profile.savingsGoal) {
    return [profile.savingsGoal, 'Show my spending', 'Explain investing simply', "I'm just exploring"];
  }
  return ['First apartment', 'A trip somewhere', 'Build an emergency fund', "I'm just exploring"];
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

// ── Helpers ────────────────────────────────────────────────────────────────
function extractJson(raw) {
  if (!raw) return null;
  let s = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1) return null;
  try { return JSON.parse(s.slice(first, last + 1)); } catch { return null; }
}

async function llmJson({ system, messages, temperature = 0.5, maxTokens = 1024 }) {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'system', content: system }, ...messages],
  });
  return extractJson(response.choices[0]?.message?.content || '');
}

const SUBAGENTS = {
  goal_plan:       PLAN_BUILDER_SYSTEM,
  expense_review:  EXPENSE_REVIEW_SYSTEM,
  risk_lesson:     EDUCATION_RISK_SYSTEM,
  action_approval: ACTION_APPROVAL_SYSTEM,
};

async function runSubAgent(name, conversation, memory, customerContext = '') {
  const system = SUBAGENTS[name];
  if (!system) return null;
  const memoryBlock = memory.length
    ? `\n\n<memory>\n${memory.map(m => `- ${m}`).join('\n')}\n</memory>`
    : '';

  // Education agent gets the catalog appended so it can pick a resource by id.
  const fullSystem = name === 'risk_lesson'
    ? `${system}\n\n${customerContext}${memoryBlock}\n\n${CATALOG_BLOCK}`
    : `${system}\n\n${customerContext}${memoryBlock}`;

  const data = await llmJson({
    system: fullSystem,
    messages: conversation,
    temperature: 0.4,
  });

  // Education agent can return one of three kinds: lesson, resource (catalog pick),
  // or generated_resource (drafted on the spot). Reshape the latter two so the
  // frontend always sees a consistent "resource" envelope.
  if (name === 'risk_lesson' && data) {
    if (data.kind === 'resource') {
      const r = RESOURCE_BY_ID[data.resourceId];
      if (!r) {
        return { kind: 'lesson', headline: 'A quick note',
          body: data.noraNote || 'Nora wanted to point you at something but the link didn\'t resolve.',
          noraNote: 'Try asking again — or just keep chatting.' };
      }
      return { kind: 'resource', resource: r, noraNote: data.noraNote || '' };
    }
    if (data.kind === 'generated_resource') {
      // Synthesize a resource record so the UI can render it like a catalog item
      // (but flagged generated:true so it gets the "Drafted by Nora" treatment).
      const generated = {
        id: `generated_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: data.title || 'Drafted by Nora',
        format: 'explainer',
        domain: data.domain || 'Custom',
        source: 'Drafted by Nora',
        summary: data.summary || '',
        body: data.body || '',
        keyTakeaways: Array.isArray(data.keyTakeaways) ? data.keyTakeaways : [],
        suggestedReading: Array.isArray(data.suggestedReading) ? data.suggestedReading : [],
        estimatedMinutes: data.estimatedMinutes || 3,
        whyNora: data.whyNora || '',
        generated: true,
        createdAt: Date.now(),
      };
      return { kind: 'resource', resource: generated, noraNote: data.noraNote || '' };
    }
  }
  return data;
}

// ── Trip research (calls Luca microservice) ──────────────────────────────────
const TRIP_EXTRACT_SYSTEM = `Extract trip details from the conversation. Return ONLY valid JSON, no markdown:
{
  "destination": "country or city",
  "duration_days": 10,
  "travelers": 1,
  "month": "",
  "origin": "Helsinki"
}
Rules:
- destination: the most specific place mentioned. Required.
- duration_days: default 10 if not stated.
- travelers: default 1 if not stated.
- month: preferred travel month, empty string if not stated.
- origin: departure city, default "Helsinki".`;

async function extractTripParams(conversation) {
  return await llmJson({
    system: TRIP_EXTRACT_SYSTEM,
    messages: conversation,
    temperature: 0.1,
    maxTokens: 150,
  }) || { destination: '' };
}

async function runTripResearch(conversation) {
  const params = await extractTripParams(conversation);
  if (!params.destination) {
    return { destination: 'unknown', error: 'Could not determine the destination from the conversation.' };
  }

  try {
    const res = await fetch(`${LUCA_URL}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: params.destination,
        duration_days: params.duration_days || 10,
        travelers: params.travelers || 1,
        month: params.month || '',
        origin: params.origin || 'Helsinki',
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { destination: params.destination, error: `Research service returned ${res.status}: ${errText.slice(0, 200)}` };
    }
    return await res.json();
  } catch (err) {
    return { destination: params.destination, error: `Could not reach research service: ${err.message}` };
  }
}

// ── Price research (calls Luca microservice) ─────────────────────────────────
const PRICE_EXTRACT_SYSTEM = `Extract the item/product details from the conversation. Return ONLY valid JSON, no markdown:
{
  "item": "specific product or property description",
  "category": "product",
  "region": "Finland"
}
Rules:
- item: be as specific as possible — include brand, model, size if mentioned. Required.
- category: one of "product", "real_estate", "car". Default "product".
- region: default "Finland" unless a different country or city is mentioned.`;

async function extractPriceParams(conversation) {
  return await llmJson({
    system: PRICE_EXTRACT_SYSTEM,
    messages: conversation,
    temperature: 0.1,
    maxTokens: 150,
  }) || { item: '' };
}

async function runPriceResearch(conversation) {
  const params = await extractPriceParams(conversation);
  if (!params.item) {
    return { item: 'unknown', error: 'Could not determine what to research from the conversation.' };
  }

  try {
    const res = await fetch(`${LUCA_URL}/price-research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: params.item,
        category: params.category || 'product',
        region: params.region || 'Finland',
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { item: params.item, error: `Research service returned ${res.status}: ${errText.slice(0, 200)}` };
    }
    return await res.json();
  } catch (err) {
    return { item: params.item, error: `Could not reach research service: ${err.message}` };
  }
}

// ── Luca API proxy helpers (banking, investment, daily recap) ─────────────────

async function callLucaApi(path, body = {}, method = 'POST') {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(`${LUCA_API_URL}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Luca API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function runBanking(messages, threadId) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return { message: '', cards: [] };
  try {
    const data = await callLucaApi('/chat', { message: lastUser.content, thread_id: threadId });
    if (data.pending_confirmation) {
      return {
        message: '',
        cards: [{ type: 'banking_confirm', data: { message: data.pending_confirmation.message, threadId } }],
      };
    }
    return { message: data.message || '', cards: [] };
  } catch (err) {
    return { message: `Banking service unavailable: ${err.message}`, cards: [] };
  }
}

async function runInvestment(messages, threadId) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return { message: '' };
  try {
    const data = await callLucaApi('/chat', { message: lastUser.content, thread_id: threadId });
    return { message: data.message || '' };
  } catch (err) {
    return { message: `Investment service unavailable: ${err.message}` };
  }
}

// ── Main chat endpoint ──────────────────────────────────────────────────────
// POST /api/nora/chat
// Body: { messages: [{role, content}], memory: [string] }
// Returns: {
//   message: "Nora's text reply",
//   cards: [{ type: 'goal_plan'|'expense_review'|'risk_lesson'|'action_approval', data: {...} }],
//   suggestedReplies: [string],
//   memoryUpdates: [string],
//   invokedAgents: [string]   // for the agent tags in the UI
// }
app.post('/api/nora/chat', async (req, res) => {
  const { messages = [], memory = [], sessionState = {}, demoMode = 'scripted_emma', profileId } = req.body;
  if (!messages.length) return res.status(400).json({ error: 'messages required' });

  try {
    const profile = getDemoProfile({ demoMode, profileId });
    const customerContext = buildCustomerContext(profile, demoMode);
    const memoryBlock = memory.length
      ? `\n\n<memory>\n${memory.map(m => `- ${m}`).join('\n')}\n</memory>`
      : '\n\n<memory>(none yet)</memory>';

    // Explicit state for the orchestrator: what cards have already been shown
    // and whether the user has confirmed the plan. Prevents re-invocation loops.
    const stateLines = [];
    if (sessionState.invokedSoFar?.length) {
      stateLines.push(`Sub-agents already invoked this session: ${sessionState.invokedSoFar.join(', ')}.`);
      stateLines.push(`Do NOT invoke an agent again unless ${profile.firstName} explicitly asks for an update or makes a substantively new request.`);
    } else {
      stateLines.push('No sub-agents have been invoked yet.');
    }
    if (sessionState.confirmed) {
      stateLines.push(`${profile.firstName} has already CONFIRMED the plan. Do NOT invoke "action_approval" again. Celebrate, check in, or answer follow-ups.`);
    }
    if (sessionState.lastExpenseReview?.monthlyRoom) {
      stateLines.push(`Last displayed spending review room to redirect: EUR ${sessionState.lastExpenseReview.monthlyRoom}/month. If referencing that amount, use exactly this number.`);
    }
    if (sessionState.educationCount || sessionState.resourceCount) {
      stateLines.push(`Education shown this session: ${Number(sessionState.educationCount || 0)} learning cards and ${Number(sessionState.resourceCount || 0)} resources.`);
      stateLines.push('Use education/resource cards only when they fit the current topic; otherwise use a short optional learning nudge.');
    }
    const stateBlock = `\n\n<session_state>\n${stateLines.join('\n')}\n</session_state>`;

    const activeContextBlock = synthesizeActiveContext(messages, memory, profile);

    const orchestration = await llmJson({
      system: NORA_ORCHESTRATOR_SYSTEM + '\n\n' + customerContext + memoryBlock + stateBlock + activeContextBlock,
      messages,
      temperature: 0.7,
      maxTokens: 512,
    });

    if (!orchestration) {
      return res.json({
        message: "Sorry — I lost my train of thought for a second. Could you say that again?",
        cards: [], suggestedReplies: [], memoryUpdates: [], invokedAgents: [],
      });
    }

    const invoke = Array.isArray(orchestration.invoke) ? orchestration.invoke.slice(0, 2) : [];

    // Step 2 — run requested sub-agents in parallel
    const cards = [];
    const threadId = sessionState.threadId || 'default';
    let lucaTextOverride = null; // banking/investment replace orchestrator message with their own

    if (invoke.length) {
      const results = await Promise.all(
        invoke.map(async name => {
          // trip_research + price_research call Luca's research microservice
          if (name === 'trip_research') {
            const data = await runTripResearch(messages);
            return { type: 'trip_research', data: data || { error: 'Research unavailable' } };
          }
          if (name === 'price_research') {
            const data = await runPriceResearch(messages);
            return { type: 'price_research', data: data || { error: 'Research unavailable' } };
          }
          // banking + investment call Luca's full agent API
          if (name === 'banking') {
            const result = await runBanking(messages, threadId);
            if (result.message) lucaTextOverride = result.message;
            if (result.cards?.length) return result.cards[0]; // banking_confirm card
            return null;
          }
          if (name === 'investment') {
            const result = await runInvestment(messages, threadId);
            if (result.message) lucaTextOverride = result.message;
            return null;
          }
          const data = await runSubAgent(name, messages, memory, customerContext);
          if (!data) return null;
          // The education sub-agent can return EITHER kind="lesson" or kind="resource".
          // Reshape kind="resource" into a distinct card type so the frontend can
          // render a resource preview chip instead of the lesson card.
          if (name === 'risk_lesson' && data.kind === 'resource') {
            return { type: 'resource_link', data };
          }
          if (name === 'expense_review') {
            return { type: name, data: enrichExpenseReviewData(data, { messages }) };
          }
          return { type: name, data };
        })
      );
      for (const r of results) if (r) cards.push(r);
    }

    // Banking/investment return their own text; use it if the orchestrator only wrote a generic intro
    const rawMessage = lucaTextOverride || orchestration.message || '';
    const mentionedMessage = addInvestmentBridgeMention(ensureCardMentions(rawMessage, cards), cards);

    res.json({
      message: normalizeExpenseAmountMentions(mentionedMessage, cards, sessionState),
      cards,
      suggestedReplies: orchestration.suggested_replies || [],
      memoryUpdates: orchestration.memory_updates || [],
      invokedAgents: invoke,
    });
  } catch (err) {
    console.error('Nora chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── First reply ─────────────────────────────────────────────────────────────
app.post('/api/nora/first-reply', async (req, res) => {
  const { demoMode = 'scripted_emma', profileId, firstReplyMode = 'hardcoded' } = req.body || {};
  const profile = getDemoProfile({ demoMode, profileId });

  if (firstReplyMode !== 'agent_generated') {
    return res.json({
      message: hardcodedFirstReply(profile),
      suggestedReplies: defaultSuggestedReplies(profile),
      profile,
    });
  }

  try {
    const customerContext = buildCustomerContext(profile, demoMode);
    const data = await llmJson({
      system: `${NORA_ORCHESTRATOR_SYSTEM}

${customerContext}

You are writing the very first Nora chat message after sign-in.
Rules:
- Mention Nora by name.
- Use ${profile.firstName}'s first name.
- Do not invoke cards or sub-agents.
- Ask at most one question.
- Do not ask for age, income, city, or other bank-known basics.
- Return ONLY valid JSON:
{
  "message": "Opening Nora message.",
  "suggested_replies": ["0-4 short chips"]
}`,
      messages: [{ role: 'user', content: 'Start the session.' }],
      temperature: 0.65,
      maxTokens: 280,
    });

    res.json({
      message: data?.message || hardcodedFirstReply(profile),
      suggestedReplies: Array.isArray(data?.suggested_replies) ? data.suggested_replies : defaultSuggestedReplies(profile),
      profile,
    });
  } catch (err) {
    console.error('Nora first reply error:', err.message);
    res.json({
      message: hardcodedFirstReply(profile),
      suggestedReplies: defaultSuggestedReplies(profile),
      profile,
      fallback: true,
    });
  }
});

// ── Curated resource library ────────────────────────────────────────────────
// The static JSON is also served via /data/education-resources.json by
// express.static, but this endpoint guarantees a stable contract.
app.get('/api/resources', (req, res) => {
  res.json({ resources: RESOURCES });
});

// ── Demo profiles ──────────────────────────────────────────────────────────
app.get('/api/demo-profiles', (req, res) => {
  res.json({
    defaultProfileId: TEST_PROFILES.find(p => p.firstName === 'Emma')?.userId || TEST_PROFILES[0]?.userId || null,
    profiles: TEST_PROFILES.map(p => ({
      userId: p.userId,
      firstName: p.firstName,
      fullName: p.fullName,
      label: profileLabel(p),
      age: p.age,
      city: p.city,
      savingsGoal: p.savingsGoal,
      riskProfile: p.riskProfile,
    })),
  });
});

app.get('/api/demo-profiles/:userId', (req, res) => {
  const profile = TEST_PROFILES.find(p => p.userId === req.params.userId);
  if (!profile) return res.status(404).json({ error: 'profile not found' });
  res.json({ profile });
});

// ── Banking confirmation (proxy to Luca API) ────────────────────────────────
app.post('/api/nora/confirm', async (req, res) => {
  const { threadId, answer } = req.body;
  if (!threadId || !answer) return res.status(400).json({ error: 'threadId and answer required' });
  try {
    const data = await callLucaApi('/confirm', { thread_id: threadId, answer });
    // If the graph pauses again (chained write actions), return another confirm card
    if (data.pending_confirmation) {
      return res.json({
        message: '',
        cards: [{ type: 'banking_confirm', data: { message: data.pending_confirmation.message, threadId } }],
        suggestedReplies: [],
        memoryUpdates: [],
        invokedAgents: ['banking'],
      });
    }
    res.json({
      message: data.message || '',
      cards: [],
      suggestedReplies: [],
      memoryUpdates: [],
      invokedAgents: ['banking'],
    });
  } catch (err) {
    console.error('[/api/nora/confirm]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Daily recap (proxy to Luca API) ──────────────────────────────────────────
app.get('/api/nora/daily-recap', async (_req, res) => {
  try {
    const data = await callLucaApi('/daily-recap', null, 'GET');
    res.json(data);
  } catch (err) {
    const missing = String(err.message || '').includes('Luca API 404');
    res.status(missing ? 404 : 503).json({
      error: missing ? 'No saved daily recap found' : 'Daily recap unavailable',
    });
  }
});

app.post('/api/nora/run-daily-recap', async (_req, res) => {
  try {
    const data = await callLucaApi('/run-daily-recap', {}, 'POST');
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Daily recap refresh unavailable' });
  }
});

// ── Health / introspection ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    gateway: process.env.AALTO_BASE_URL || 'https://llm-gateway.k8s.aalto.fi/api/v1',
    hasKey: !!process.env.AALTO_API_KEY,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Nora server → http://localhost:${PORT}`);
  console.log(`  Gateway: ${process.env.AALTO_BASE_URL || 'https://llm-gateway.k8s.aalto.fi/api/v1'}`);
  console.log(`  Model:   ${MODEL}`);
  if (!process.env.AALTO_API_KEY) {
    console.warn('⚠  AALTO_API_KEY not set — Aalto VPN + key required.');
  }
});
