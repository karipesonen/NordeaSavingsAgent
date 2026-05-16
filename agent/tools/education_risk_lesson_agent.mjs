const DEFAULT_FORMAT = 'short_card';

function firstBlocker(input) {
  const explicit = input.blocker || input.currentBlocker || input.current_blocker;
  if (explicit) return String(explicit);
  const blockers = input.userMemory?.investment_journey?.first_investment_blockers
    || input.user_memory?.investment_journey?.first_investment_blockers
    || [];
  return blockers[0] || 'risk';
}

function normalizeBlocker(blocker) {
  const text = String(blocker || '').toLowerCase();
  if (text.includes('confus') || text.includes('know')) return 'confusion';
  if (text.includes('small') || text.includes('amount') || text.includes('money')) return 'amount_feels_too_small';
  if (text.includes('around') || text.includes('procrast') || text.includes('later')) return 'not_getting_around_to_it';
  return 'risk';
}

function preferredFormat(input) {
  return input.preferredFormat
    || input.preferred_format
    || input.userMemory?.financial_understanding?.preferred_content_format
    || input.user_memory?.financial_understanding?.preferred_content_format
    || DEFAULT_FORMAT;
}

function goalContext(input) {
  const plan = input.goalPlan || input.goal_plan || {};
  return {
    goalName: plan.goal_name || input.goalName || input.goal_name || 'your goal',
    monthlyContribution: plan.recommended_option?.monthly_contribution || plan.recommendation_card?.amount || null,
    requiresAdjustment: Boolean(plan.requires_adjustment),
    feasibility: plan.overall_feasibility || null
  };
}

function lessonFor({ blocker, riskComfort, goal }) {
  if (goal.requiresAdjustment) {
    return {
      topic: 'When savings should come before investing',
      title: 'Big goals need two lanes',
      plain_answer: 'For a big near-ish goal, savings protects the plan and investing can wait until the timeline and safety buffer make sense.',
      key_points: [
        'A starter habit is still useful even when it cannot finish the whole goal alone.',
        'Money needed soon should usually stay safer and easier to access.',
        'Investing fits better when the money can be left alone for years.'
      ],
      check_question: 'If a goal is too large for the current monthly amount, what should Nora do first?',
      correct_answer: 'Treat the amount as a starter habit and adjust the goal plan.',
      next_topic: 'Splitting a large goal into milestones'
    };
  }

  if (blocker === 'confusion') {
    return {
      topic: 'Saving versus investing',
      title: 'Saving is storage, investing is growth-with-movement',
      plain_answer: 'Saving is for money you need predictable access to. Investing is for money you can leave alone while its value moves up and down.',
      key_points: [
        'Savings are usually calmer and easier to access.',
        'Investments can grow, but they can also fall in value.',
        'The first question is not product choice; it is when you need the money.'
      ],
      check_question: 'Which money usually belongs in savings first?',
      correct_answer: 'Money needed soon or needed as a safety buffer.',
      next_topic: 'What investment risk means'
    };
  }

  if (blocker === 'amount_feels_too_small') {
    return {
      topic: 'Why small first amounts can matter',
      title: 'Tiny counts when it becomes automatic',
      plain_answer: 'A small amount is not pointless if it builds the habit safely and keeps going without stress.',
      key_points: [
        'The first win is often consistency, not size.',
        'A small draft can be increased later when the user trusts the system.',
        'Small amounts reduce the fear of making a giant first mistake.'
      ],
      check_question: 'What is the main job of a tiny first contribution?',
      correct_answer: 'To build a repeatable habit safely.',
      next_topic: 'How monthly investing habits work'
    };
  }

  if (blocker === 'not_getting_around_to_it') {
    return {
      topic: 'Why automatic habits work',
      title: 'Automation beats good intentions',
      plain_answer: 'A small automatic habit can help because it removes the need to restart the decision every month.',
      key_points: [
        'The user stays in control because the draft still needs approval.',
        'Automation should start small enough to survive a normal month.',
        'A review habit keeps the plan from becoming invisible.'
      ],
      check_question: 'Why start with a small automatic draft instead of a perfect plan?',
      correct_answer: 'Because a repeatable habit is easier to keep than a vague intention.',
      next_topic: 'Choosing a safe monthly amount'
    };
  }

  return {
    topic: 'What investment risk means',
    title: riskComfort === 'low' ? 'Risk means movement, not chaos' : 'Risk is the price of possible growth',
    plain_answer: 'Investment risk means the value can move up and down, especially in the short term. It does not mean every investment is gambling.',
    key_points: [
      'Short timelines usually favor savings first.',
      'Longer timelines can make investing more reasonable.',
      'The amount should be money the user can leave alone.'
    ],
    check_question: 'What is the first practical question before investing goal money?',
    correct_answer: 'When do you need the money?',
    next_topic: 'Saving versus investing'
  };
}

export function createEducationRiskLesson(input = {}) {
  const blocker = normalizeBlocker(firstBlocker(input));
  const riskComfort = input.riskComfort || input.risk_comfort || 'medium';
  const format = preferredFormat(input);
  const goal = goalContext(input);
  const lesson = lessonFor({ blocker, riskComfort, goal });
  const monthly = goal.monthlyContribution ? ` The current draft habit is EUR ${goal.monthlyContribution}/month.` : '';

  return {
    agent: 'education_risk_lesson',
    topic: lesson.topic,
    format,
    estimated_duration_seconds: 45,
    blocker,
    lesson_card: {
      title: lesson.title,
      plain_answer: `${lesson.plain_answer}${monthly}`,
      key_points: lesson.key_points,
      future_self_prompt: 'Future-you does not need perfect confidence today. They need one idea clear enough that the next step feels safe.'
    },
    check_questions: [
      {
        type: 'single_check',
        question: lesson.check_question,
        correct_answer: lesson.correct_answer,
        explanation: 'This checks the core concept before Nora drafts any investment action.'
      }
    ],
    next_topic: lesson.next_topic,
    resource_stub: {
      title: lesson.topic,
      format,
      status: 'stub',
      note: 'Demo stub only; no live article or podcast retrieval yet.'
    },
    memory_updates: [
      {
        field: 'financial_understanding.known_topics',
        value: [lesson.topic],
        source: 'inferred_from_conversation',
        confidence: 'medium'
      },
      {
        field: 'financial_understanding.preferred_content_format',
        value: format,
        source: 'inferred_from_conversation',
        confidence: 'medium'
      }
    ],
    safety_flags: ['education_before_investment_action', 'not_investment_advice']
  };
}
