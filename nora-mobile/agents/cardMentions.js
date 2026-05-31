const CARD_MENTION_RULES = {
  goal_plan: {
    label: 'savings plan',
    article: 'a',
    terms: ['savings plan', 'goal plan', 'starter plan', 'plan', 'goal'],
  },
  expense_review: {
    label: 'spending review',
    article: 'a',
    terms: ['spending review', 'expense review', 'spending', 'expenses'],
  },
  risk_lesson: {
    label: 'learning card',
    article: 'a',
    terms: ['learning card', 'lesson', 'learning', 'risk card'],
  },
  resource_link: {
    label: 'resource',
    article: 'a',
    terms: ['resource', 'article', 'video', 'podcast', 'link', 'guide'],
  },
  action_approval: {
    label: 'confirmation card',
    article: 'a',
    terms: ['confirmation card', 'confirmation', 'approval', 'approve', 'confirm'],
  },
  trip_research: {
    label: 'cost breakdown',
    article: 'a',
    terms: ['cost breakdown', 'trip cost', 'price research', 'research', 'prices', 'cost'],
  },
  price_research: {
    label: 'price lookup',
    article: 'a',
    terms: ['price', 'prices', 'cost', 'costs', 'how much', 'lookup', 'research', 'current price'],
  },
  portfolio_summary: {
    label: 'portfolio summary',
    article: 'a',
    terms: ['portfolio summary', 'portfolio', 'investments', 'holdings'],
  },
  market_snapshot: {
    label: 'market snapshot',
    article: 'a',
    terms: ['market snapshot', 'stock price', 'current price', 'trading', 'price'],
  },
  banking_confirm: {
    label: 'confirmation',
    article: 'a',
    terms: ['confirm', 'set up', 'send', 'transfer', 'block', 'loan', 'goal'],
  },
};

function uniqueCardTypes(cards = []) {
  const seen = new Set();
  const types = [];
  for (const card of cards) {
    if (!card?.type || seen.has(card.type)) continue;
    seen.add(card.type);
    types.push(card.type);
  }
  return types;
}

function isMentioned(message, type) {
  const rule = CARD_MENTION_RULES[type];
  if (!rule) return true;
  const text = String(message || '').toLowerCase();
  return rule.terms.some(term => text.includes(term));
}

function labelPhrase(type) {
  const rule = CARD_MENTION_RULES[type];
  if (!rule) return null;
  return `${rule.article} ${rule.label}`;
}

function joinPhrases(phrases) {
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(', ')}, and ${phrases.at(-1)}`;
}

function buildMentionSentence(missingTypes) {
  const phrases = missingTypes.map(labelPhrase).filter(Boolean);
  if (!phrases.length) return '';

  if (missingTypes.length === 1 && missingTypes[0] === 'resource_link') {
    return 'I also added a resource you can save for later.';
  }

  if (phrases.length === 1) {
    return `I added ${phrases[0]} below.`;
  }

  if (phrases.length === 2) {
    return `I found two useful things: ${joinPhrases(phrases)}.`;
  }

  return `I added a few useful cards: ${joinPhrases(phrases.slice(0, 3))}.`;
}

export function ensureCardMentions(message, cards = []) {
  if (!cards.length) return message || '';

  const missingTypes = uniqueCardTypes(cards).filter(type => !isMentioned(message, type));
  if (!missingTypes.length) return message || '';

  const resourceMissing = missingTypes.includes('resource_link');
  const primaryMissingTypes = missingTypes.filter(type => type !== 'resource_link');
  const primaryMention = buildMentionSentence(primaryMissingTypes);
  const resourceMention = resourceMissing ? buildMentionSentence(['resource_link']) : '';
  const cleanMessage = String(message || '').trim();
  const parts = [primaryMention, cleanMessage, resourceMention].filter(Boolean);
  return parts.join(' ');
}

export const CARD_MENTION_LABELS = Object.fromEntries(
  Object.entries(CARD_MENTION_RULES).map(([type, rule]) => [type, rule.label])
);
