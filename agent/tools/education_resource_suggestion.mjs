import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESOURCE_DB_PATH = path.join(__dirname, '..', 'resources', 'education_resources.json');
const INVESTMENT_PATH_DOMAINS = new Set(['Funds', 'Stocks', 'Home & Real Estate', 'Retirement & Long-Term', 'Sustainable Investing']);

let cachedDb = null;

function loadResourceDb() {
  if (!cachedDb) cachedDb = JSON.parse(fs.readFileSync(RESOURCE_DB_PATH, 'utf8'));
  return cachedDb;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value || '').trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function normalizeFormat(format) {
  const raw = lower(format);
  if (raw.includes('podcast')) return 'podcast';
  if (raw.includes('video')) return 'video';
  if (raw.includes('quiz')) return 'quiz';
  if (raw.includes('short')) return 'short_card';
  if (raw.includes('article')) return 'article';
  return null;
}

function topicText(input) {
  return [
    input.educationLesson?.topic,
    input.education_lesson?.topic,
    input.educationLesson?.lesson_card?.title,
    input.education_lesson?.lesson_card?.title,
    input.educationLesson?.next_topic,
    input.education_lesson?.next_topic,
    input.latestUserMessage,
    input.latest_user_message
  ].filter(Boolean).join(' ');
}

function inferDomainCandidates(input) {
  const lesson = input.educationLesson || input.education_lesson || {};
  const progress = input.learningProgress || input.learning_progress || {};
  const text = lower(topicText(input));
  const domains = [];

  if (progress.domain) domains.push(progress.domain);
  if (/\bloans?\b|student loan|\bborrow|repay|interest|credit|debt/.test(text) || lesson.blocker === 'loan_question') domains.push('Borrowing & Loans');
  if (/funds?|index fund|etf|diversif/.test(text)) domains.push('Funds');
  if (/risk|volatil|gambl|market drop|lose money/.test(text)) domains.push('Risk Without Panic');
  if (/automatic|habit|monthly|dollar cost|dca|regular investing|small amount/.test(text)) domains.push('Money Habits');
  if (/goal|milestone|timeline|motivat|starter habit|too slow/.test(text)) domains.push('Goal Planning');
  if (/saving|savings|buffer|emergency|short[- ]term|needed soon|savings-first/.test(text)) domains.push('Starting Safely');
  if (progress.next_domain_suggestion) domains.push(progress.next_domain_suggestion);

  return [...new Set(domains.filter(Boolean))];
}

function alreadySuggestedIds(input) {
  const memory = input.userMemory || input.user_memory || {};
  const directHistory = safeArray(input.recommendationHistory || input.recommendation_history);
  const memoryHistory = safeArray(memory.recommendation_history);
  const events = safeArray(memory.memory_events).map((event) => event.value);
  return new Set([...directHistory, ...memoryHistory, ...events]
    .flatMap((entry) => Array.isArray(entry) ? entry : [entry])
    .map((entry) => entry?.resource_id || entry?.resourceId || entry?.id)
    .filter(Boolean));
}

function userIsInvestmentReady(input) {
  const progress = input.learningProgress || input.learning_progress || {};
  const memory = input.userMemory || input.user_memory || {};
  const text = lower(topicText(input));
  const stage = memory.investment_journey?.readiness_stage;
  return progress.stage === 'investment_paths'
    || progress.domain === 'Funds'
    || progress.internal_status === 'applied'
    || ['ready_to_plan', 'draft_created', 'approved_first_habit'].includes(stage)
    || /funds?|index fund|etf|invest/.test(text);
}

function formatMatches(resourceFormat, preferredFormat) {
  if (!preferredFormat) return resourceFormat === 'article' ? 12 : 0;
  if (preferredFormat === 'article') return resourceFormat === 'article' ? 25 : -4;
  if (preferredFormat === 'video') return ['video', 'podcast_video'].includes(resourceFormat) ? 25 : -3;
  if (preferredFormat === 'podcast') return resourceFormat === 'podcast_video' ? 25 : resourceFormat === 'video' ? 12 : -3;
  if (preferredFormat === 'short_card') return resourceFormat === 'article' ? 8 : 0;
  return 0;
}

function triggerScore(resource, text) {
  const triggers = safeArray(resource.trigger_keywords);
  return triggers.reduce((score, trigger) => {
    const normalized = lower(trigger);
    return normalized && text.includes(normalized) ? score + 8 : score;
  }, 0);
}

function qualityPenalty(resource) {
  let penalty = 0;
  if (lower(resource.metadata_status).includes('partial')) penalty -= 8;
  if (resource.transcript_status === 'missing_body') penalty -= 30;
  if (safeArray(resource.missing_data).length) penalty -= 4;
  return penalty;
}

function scoreResource(resource, input, domains, preferredFormat, suggestedIds) {
  if (suggestedIds.has(resource.id)) return -10000;
  if (INVESTMENT_PATH_DOMAINS.has(resource.domain) && !userIsInvestmentReady(input)) return -1000;

  const text = lower(topicText(input));
  const domainIndex = domains.indexOf(resource.domain);
  let score = domainIndex === 0 ? 140 : domainIndex > 0 ? 70 - domainIndex * 5 : 0;
  if (lower(resource.topic) && text.includes(lower(resource.topic))) score += 12;
  if (lower(resource.title) && text.includes(lower(resource.title))) score += 10;
  score += triggerScore(resource, text);
  score += formatMatches(resource.format, preferredFormat);
  score += qualityPenalty(resource);
  if (resource.source === 'Nordea') score += 4;
  if (resource.metadata_status === 'verified') score += 4;
  if (Number.isFinite(Number(resource.estimated_time_minutes)) && Number(resource.estimated_time_minutes) <= 8) score += 2;
  return score;
}

function resourceSummary(resource) {
  return {
    id: resource.id,
    title: resource.title,
    format: resource.format,
    domain: resource.domain,
    topic: resource.topic,
    source: resource.source,
    url: resource.url,
    estimated_time_minutes: resource.estimated_time_minutes ?? null,
    summary: resource.summary
  };
}

function resourceTypeLabel(format) {
  if (format === 'podcast_video') return 'podcast/video';
  if (format === 'video') return 'video';
  return 'article';
}

function buildNoraLine(resource) {
  const time = Number(resource.estimated_time_minutes);
  const timeText = Number.isFinite(time) ? ` (${time} min)` : '';
  const label = resourceTypeLabel(resource.format);
  const dcaNote = resource.id.includes('dca')
    ? ' Treat it as a consistency explainer, not a promise that timing gets magically solved.'
    : '';
  return `If you want one useful next thing, save this ${label} for later: "${resource.title}" from ${resource.source}${timeText}. ${resource.why_nora_recommends_it}${dcaNote}`;
}

function recommendationEntry({ userId, resource }) {
  return {
    id: `rec_${userId || 'user'}_${resource.id}`,
    type: 'education_resource',
    resource_id: resource.id,
    summary: resource.title,
    domain: resource.domain,
    format: resource.format,
    status: 'suggested',
    created_at: new Date().toISOString()
  };
}

export function suggestEducationResource(input = {}) {
  const lesson = input.educationLesson || input.education_lesson || {};
  const progress = input.learningProgress || input.learning_progress || {};
  const status = progress.internal_status || input.progress_status;
  const force = Boolean(input.forceSuggestion || input.force_suggestion);

  if (!force && !['explored', 'applied'].includes(status)) {
    return {
      agent: 'education_resource_suggestion',
      status: 'skipped',
      reason: 'Resource suggestions appear after the user has explored or applied the education moment.',
      resource: null,
      nora_line: null,
      memory_updates: [],
      safety_flags: ['resource_not_shown_every_turn']
    };
  }

  const domains = inferDomainCandidates(input);
  const preferredFormat = normalizeFormat(
    input.preferredFormat
    || input.preferred_format
    || input.userMemory?.financial_understanding?.preferred_content_format
    || input.user_memory?.financial_understanding?.preferred_content_format
  ) || 'article';
  const resources = safeArray(loadResourceDb().resources);
  const suggestedIds = alreadySuggestedIds(input);
  const ranked = resources
    .map((resource) => ({ resource, score: scoreResource(resource, { ...input, educationLesson: lesson, learningProgress: progress }, domains, preferredFormat, suggestedIds) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.resource.title.localeCompare(b.resource.title));

  if (!ranked.length) {
    return {
      agent: 'education_resource_suggestion',
      status: 'unavailable',
      reason: 'No unused resource matched the current education topic and readiness state.',
      resource: null,
      nora_line: null,
      memory_updates: [],
      safety_flags: ['resource_is_educational', 'no_resource_match']
    };
  }

  const selected = ranked[0].resource;
  return {
    agent: 'education_resource_suggestion',
    status: 'available',
    resource: resourceSummary(selected),
    nora_line: buildNoraLine(selected),
    memory_updates: [
      {
        field: 'recommendation_history',
        value: recommendationEntry({ userId: input.userId || input.user_id, resource: selected }),
        source: 'inferred_from_conversation',
        confidence: 'medium'
      }
    ],
    safety_flags: selected.id.includes('dca')
      ? ['resource_is_educational', 'not_product_advice', 'dca_not_guaranteed_returns']
      : ['resource_is_educational', 'not_product_advice']
  };
}

export default suggestEducationResource;
