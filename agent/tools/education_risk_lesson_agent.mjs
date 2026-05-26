const DEFAULT_FORMAT = 'short_card';

function firstBlocker(input) {
  const explicit = input.blocker || input.currentBlocker || input.current_blocker;
  if (explicit) return String(explicit);
  const latestMessage = input.latestUserMessage || input.latest_user_message || input.userMessage || input.user_message;
  if (latestMessage) return String(latestMessage);
  const blockers = input.userMemory?.investment_journey?.first_investment_blockers
    || input.user_memory?.investment_journey?.first_investment_blockers
    || [];
  return blockers[0] || 'risk';
}

function mentionsLoans(text) {
  return /\bloans?\b|student loan|\bborrow(?:ing)?\b|\brepay(?:ment)?\b|\binterest\b|\bcredit\b|\bdebt\b/i.test(String(text || ''));
}

function normalizeBlocker(blocker) {
  const text = String(blocker || '').toLowerCase();
  if (mentionsLoans(text)) return 'loan_question';
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

function allUserText(input) {
  return [
    input.latestUserMessage,
    input.latest_user_message,
    input.userMessage,
    input.user_message,
    input.blocker,
    input.currentBlocker,
    input.current_blocker
  ].filter(Boolean).join(' ').toLowerCase();
}

function loanLessonFor(text) {
  if (/\bstudent loan\b|\bstudent\b/.test(text)) {
    return {
      topic: 'Student loans without panic',
      title: 'A student loan buys time, then asks for room later',
      plain_answer: 'A student loan can support education, but repayment becomes part of future monthly life. The useful question is not "is debt bad?" but "does this borrowing protect or shrink future flexibility?"',
      key_points: [
        'The loan amount is not the whole story; the future monthly repayment matters.',
        'Interest is the cost of using money before you have it.',
        'Education can increase future options, but the repayment plan still needs breathing room.'
      ],
      check_question: 'What should you compare before taking on student debt?',
      correct_answer: 'The future monthly repayment and flexibility, not only the loan amount.',
      next_topic: 'Repayment and monthly freedom'
    };
  }

  if (/\bborrow(?:ing)?\b/.test(text) && /\bsav(?:e|ing|ings)\b/.test(text)) {
    return {
      topic: 'Borrowing vs saving for a goal',
      title: 'Borrowing buys speed; saving keeps flexibility',
      plain_answer: 'Borrowing can move a purchase closer, but it gives future-you a fixed payment. Saving is slower, but it keeps more room to change plans.',
      key_points: [
        'Borrowing may fit better when the goal creates real future value or cannot reasonably wait.',
        'Saving may fit better when the goal is flexible or the monthly repayment would feel tight.',
        'The practical comparison is speed today versus freedom later.'
      ],
      check_question: 'What is the most useful tradeoff to compare before borrowing for a goal?',
      correct_answer: 'Speed now versus future monthly flexibility.',
      next_topic: 'Repayment and monthly freedom'
    };
  }

  if (/\brepay(?:ment)?\b|\bmonthly\b/.test(text)) {
    return {
      topic: 'Repayment and monthly freedom',
      title: 'Repayment is a future subscription you cannot casually cancel',
      plain_answer: 'A loan repayment becomes a recurring monthly commitment. Before borrowing, future-you needs enough room for rent, food, savings, and normal life after that payment.',
      key_points: [
        'A smaller monthly payment may feel easier, but it can last longer.',
        'A larger payment can clear debt faster, but it must survive a normal month.',
        'The safe question is how much freedom remains after repayment.'
      ],
      check_question: 'Why does monthly repayment matter more than the headline loan amount?',
      correct_answer: 'Because repayment affects future monthly flexibility.',
      next_topic: 'Borrowing vs saving for a goal'
    };
  }

  if (/\binterest\b|\brate\b/.test(text)) {
    return {
      topic: 'What loan interest really means',
      title: 'Interest is rent on borrowed money',
      plain_answer: 'Loan interest is the cost of using money before it is yours. The longer the loan stays open, the more that cost can matter.',
      key_points: [
        'The rate tells you part of the cost, but time and repayment pace matter too.',
        'A loan can look manageable as a total amount and still feel heavy each month.',
        'Comparing loans needs approved product data; Nora can explain the concept, not quote offers.'
      ],
      check_question: 'What does loan interest pay for?',
      correct_answer: 'The cost of using money before you have earned or saved it.',
      next_topic: 'Repayment and monthly freedom'
    };
  }

  return {
    topic: 'When a loan is useful and when it becomes pressure',
    title: 'A loan should create options, not trap them',
    plain_answer: 'Borrowing can be useful when it helps with something important and the repayment fits future monthly life. It becomes pressure when the payment squeezes basics, savings, or peace of mind.',
    key_points: [
      'Useful borrowing usually has a clear purpose and a repayment plan.',
      'Pressure starts when monthly payments crowd out essentials or safety savings.',
      'For actual loan choices, the bank needs approved product data and a proper decision flow.'
    ],
    check_question: 'When does borrowing usually become risky for everyday life?',
    correct_answer: 'When repayment crowds out essentials, savings, or flexibility.',
    next_topic: 'Borrowing vs saving for a goal'
  };
}

function lessonFor({ blocker, riskComfort, goal, inputText }) {
  if (blocker === 'loan_question') {
    return loanLessonFor(inputText);
  }

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
  const lesson = lessonFor({ blocker, riskComfort, goal, inputText: allUserText(input) });
  const monthly = goal.monthlyContribution ? ` The current draft habit is EUR ${goal.monthlyContribution}/month.` : '';
  const isLoanLesson = blocker === 'loan_question';

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
        explanation: isLoanLesson
          ? 'This checks the core borrowing concept before Nora discusses any loan-related decision.'
          : 'This checks the core concept before Nora drafts any investment action.'
      }
    ],
    next_topic: lesson.next_topic,
    resource_stub: {
      title: lesson.topic,
      format,
      status: 'selector_available',
      note: 'Curated article/video/podcast links are selected by suggest_education_resource after the education progress step.'
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
    safety_flags: isLoanLesson
      ? ['education_only', 'not_loan_advice', 'no_loan_product_recommendation', 'no_eligibility_or_rate_claims']
      : ['education_before_investment_action', 'not_investment_advice']
  };
}
