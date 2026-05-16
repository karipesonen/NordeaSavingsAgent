const DEFAULT_CURRENCY = 'EUR';

const CATEGORY_PRIORITY = ['Subscriptions', 'Insurance', 'Transport', 'Housing'];

function normalizeCategoryName(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('subscription') || text.includes('stream')) return 'Subscriptions';
  if (text.includes('insurance')) return 'Insurance';
  if (text.includes('transport') || text.includes('commute')) return 'Transport';
  if (text.includes('housing') || text.includes('rent') || text.includes('mortgage')) return 'Housing';
  return null;
}

function selectedCategoryFromInput(input) {
  const explicit = normalizeCategoryName(input.selectedCategory || input.selected_category);
  if (explicit) return explicit;
  const text = String(input.latestUserMessage || input.latest_user_message || '').toLowerCase();
  const mentions = [
    ['Subscriptions', Math.min(...['subscription', 'subscriptions', 'streaming'].map((word) => text.indexOf(word)).filter((index) => index >= 0))],
    ['Insurance', text.indexOf('insurance')],
    ['Transport', Math.min(...['transport', 'commute'].map((word) => text.indexOf(word)).filter((index) => index >= 0))],
    ['Housing', Math.min(...['housing', 'rent', 'mortgage'].map((word) => text.indexOf(word)).filter((index) => index >= 0))]
  ]
    .filter(([, index]) => Number.isFinite(index) && index >= 0)
    .sort((a, b) => a[1] - b[1]);
  return mentions[0]?.[0] || null;
}

function normalizeRecurringExpenses(items = [], currency = DEFAULT_CURRENCY) {
  return items
    .map((item) => {
      const name = item.name || item.category || 'Recurring expense';
      const amount = Number(item.amount || item.monthly_amount || 0);
      return {
        category: normalizeCategoryName(name) || name,
        amount: Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0,
        currency: item.currency || currency,
        cadence: item.cadence || 'monthly',
        reviewability: reviewabilityFor(normalizeCategoryName(name) || name)
      };
    })
    .filter((item) => item.amount > 0);
}

function reviewabilityFor(category) {
  if (category === 'Subscriptions') return 'high';
  if (category === 'Insurance') return 'medium';
  if (category === 'Transport') return 'medium';
  if (category === 'Housing') return 'low';
  return 'medium';
}

function chooseCategory(recurring, selectedCategory) {
  if (selectedCategory && recurring.some((item) => item.category === selectedCategory)) return selectedCategory;
  for (const category of CATEGORY_PRIORITY) {
    if (recurring.some((item) => item.category === category)) return category;
  }
  return recurring[0]?.category || null;
}

function tableRows(recurring) {
  if (!recurring.length) return '| No clear recurring categories | EUR 0/month | - | - |';
  return recurring
    .map((item) => `| ${item.category} | ${item.currency} ${item.amount}/month | ${item.cadence} | ${item.reviewability} |`)
    .join('\n');
}

function possibleOpportunityFor(category, amount, currency) {
  if (!category) {
    return {
      category: null,
      inspection_prompt: 'No clear recurring category was detected. Start by checking whether the monthly data is complete.',
      possible_monthly_range: [0, 0],
      certainty: 'low'
    };
  }

  const low = Math.max(0, Math.round(amount * 0.05));
  const high = Math.max(low, Math.round(amount * 0.15));
  return {
    category,
    inspection_prompt: `Review ${category.toLowerCase()} once this month and decide manually whether anything still earns its place.`,
    possible_monthly_range: [low, high],
    currency,
    certainty: category === 'Subscriptions' ? 'medium' : 'low',
    note: 'This is an inspection range, not guaranteed savings and not a cancellation recommendation.'
  };
}

export function createExpenseReview(input = {}) {
  const currency = input.currency || input.financialSnapshot?.currency || input.financial_snapshot?.currency || DEFAULT_CURRENCY;
  const recurring = normalizeRecurringExpenses(
    input.recurringExpenses || input.recurring_expenses || input.financialSnapshot?.recurring_expenses_detected || input.financial_snapshot?.recurring_expenses_detected || [],
    currency
  );
  const selectedCategory = selectedCategoryFromInput(input);
  const suggestedCategory = chooseCategory(recurring, selectedCategory);
  const selectedItem = recurring.find((item) => item.category === suggestedCategory) || null;
  const reviewHabit = suggestedCategory
    ? {
        category: suggestedCategory,
        cadence: 'monthly',
        action: `Inspect ${suggestedCategory.toLowerCase()} once a month before changing anything.`,
        user_control: 'Nora only surfaces the category; the user decides whether to keep, edit, or cancel anything.'
      }
    : {
        category: null,
        cadence: 'monthly',
        action: 'Check whether the transaction data contains enough recurring expense detail.',
        user_control: 'No action is recommended without clearer data.'
      };

  const opportunity = possibleOpportunityFor(suggestedCategory, selectedItem?.amount || 0, currency);

  return {
    agent: 'expense_review',
    currency,
    selected_category: selectedCategory,
    suggested_category: suggestedCategory,
    recurring_expenses: recurring,
    markdown_table: `| Category | Estimated amount | Pattern | Reviewability |\n|---|---:|---|---|\n${tableRows(recurring)}`,
    suggested_review_options: recurring
      .filter((item) => item.reviewability !== 'low')
      .map((item) => item.category),
    possible_savings_opportunity: opportunity,
    review_habit: reviewHabit,
    nora_summary: suggestedCategory
      ? `Review ${suggestedCategory.toLowerCase()} monthly as an inspection habit, not a cut. No automatic cancellation.`
      : 'No clear recurring category was detected, so Nora should not suggest cuts.',
    trust_ledger_input: {
      data_used: ['recurring expense categories', 'safe-to-save estimate', 'user-selected category if provided'],
      assumptions: [
        'The detected recurring categories are broad monthly estimates.',
        'A review habit may protect the savings plan, but it may find nothing to change.'
      ],
      confidence: recurring.length ? 'medium' : 'low',
      boundaries: [
        'This does not mean any category is bad.',
        'This is not an automatic cancellation recommendation.',
        'The user must approve any cancellation, transfer, or sharing action.'
      ],
      approval_required: false
    },
    memory_updates: [
      {
        field: 'preferences.wants_expense_tables',
        value: true,
        source: selectedCategory ? 'explicit_user' : 'inferred_from_conversation',
        confidence: selectedCategory ? 'high' : 'medium'
      },
      {
        field: 'preferences.expense_review_category',
        value: suggestedCategory,
        source: selectedCategory ? 'explicit_user' : 'inferred_from_conversation',
        confidence: suggestedCategory ? 'medium' : 'low'
      }
    ],
    safety_flags: ['no_automatic_cancellations', 'approval_required_before_cancellation', 'review_not_judgement']
  };
}
