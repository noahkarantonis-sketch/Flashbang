import type { CardType, CardFormat } from '../types'

// Built-in question bank: original, style-matched practice modelled on the
// shape/difficulty of WACE-style exams (NOT verbatim copies of any paper).
// Two branches — Theory (definitions/rules/concepts) and Practice (exam-style
// questions). The app ships these so there's instant value with zero upload.

export interface BankQuestion {
  question: string
  answer: string
  topic: string
  type: CardType
  format: CardFormat
  options?: string[] // MCQ choices (one must equal `answer`)
}

export interface BankSubject {
  id: string
  name: string
  level: string
  questions: BankQuestion[]
}

export interface BankBranch {
  id: string
  name: string
  blurb: string
  subjects: BankSubject[]
}

const methodsPractice: BankSubject = {
  id: 'methods',
  name: 'Mathematics Methods',
  level: 'ATAR Unit 3 · Calculator-free',
  questions: [
    {
      topic: 'Integration & Area',
      type: 'application',
      format: 'flip',
      question:
        'Determine the area enclosed by the x-axis, the y-axis, the line x = 2 and the curve y = 48/(3x + 2)². (5 marks)',
      answer:
        'Area = ∫₀² 48(3x+2)⁻² dx. Antiderivative: 48·(3x+2)⁻¹/(−1·3) = −16/(3x+2).\nEvaluate 0→2: [−16/(3x+2)]₀² = −16/8 − (−16/2) = −2 + 8 = 6.\nArea = 6 square units.'
    },
    {
      topic: 'Kinematics',
      type: 'application',
      format: 'flip',
      question:
        'A particle starts from rest at the origin and moves in a straight line with acceleration a(t) = 2t − 6 ms⁻², t ≥ 0.\n(a) Find v(t).  (b) Find the acceleration when v = 7.  (c) Find the velocity as it passes through the origin for the last time. (8 marks)',
      answer:
        '(a) v = ∫(2t−6) dt = t² − 6t + C. v(0) = 0 ⇒ C = 0, so v(t) = t² − 6t.\n(b) t² − 6t = 7 ⇒ t² − 6t − 7 = 0 ⇒ (t−7)(t+1) = 0 ⇒ t = 7 (t ≥ 0). a(7) = 2(7) − 6 = 8 ms⁻².\n(c) x = ∫v dt = t³/3 − 3t². x = 0 ⇒ t²(t/3 − 3) = 0 ⇒ t = 0 or t = 9. Last time t = 9: v(9) = 81 − 54 = 27 ms⁻¹.'
    },
    {
      topic: 'Differentiation & Curve Analysis',
      type: 'application',
      format: 'flip',
      question:
        'For f(x) = eˣ(x² − 5):\n(a) Show that f′(x) = eˣ(x² + 2x − 5).  (b) Find the x-coordinates of the stationary points.  (c) Given f″(x) = eˣ(x² + 4x − 3), use the second derivative to classify each stationary point. (6 marks)',
      answer:
        '(a) Product rule: f′ = eˣ(x²−5) + eˣ(2x) = eˣ(x² + 2x − 5). ✓\n(b) Stationary where f′ = 0: x² + 2x − 5 = 0 ⇒ x = −1 ± √6.\n(c) f″ sign (eˣ > 0): at x = −1−√6, x²+4x−3 = −2√6 < 0 ⇒ local maximum. At x = −1+√6, x²+4x−3 = 2√6 > 0 ⇒ local minimum.'
    },
    {
      topic: 'Differentiation Rules',
      type: 'application',
      format: 'flip',
      question:
        '(a) Determine d/dx [ (1 + e³ˣ) / (1 + x²) ].  (b) Determine d/dx [ 3x sin(2x) ].  (c) Hence determine ∫ 6x cos(2x) dx. (8 marks)',
      answer:
        '(a) Quotient rule: [3e³ˣ(1+x²) − (1+e³ˣ)(2x)] / (1+x²)².\n(b) Product rule: 3 sin(2x) + 6x cos(2x).\n(c) From (b), ∫[3 sin(2x) + 6x cos(2x)] dx = 3x sin(2x) + C, so ∫6x cos(2x) dx = 3x sin(2x) − ∫3 sin(2x) dx = 3x sin(2x) + (3/2)cos(2x) + C.'
    },
    {
      topic: 'Random Variables',
      type: 'application',
      format: 'flip',
      question:
        'A discrete random variable X has P(X = 0,1,2,3) = a, a + b, b, 2a respectively, with E(X) = 1.6.\n(a) Find a and b.  (b) Find E(3 − 2X) and Var(3 − 2X), given Var(X) = 0.84. (6 marks)',
      answer:
        '(a) Probabilities sum to 1: 4a + 2b = 1. E(X) = (a+b) + 2b + 6a = 7a + 3b = 1.6. Solving: a = 0.1, b = 0.3. (Check: 0.1, 0.4, 0.3, 0.2 → sum 1 ✓, E = 1.6 ✓.)\n(b) E(3 − 2X) = 3 − 2E(X) = 3 − 3.2 = −0.2. Var(3 − 2X) = (−2)²Var(X) = 4(0.84) = 3.36. (The +3 shift does NOT affect variance.)'
    },
    {
      topic: 'Increments & Antidifferentiation',
      type: 'application',
      format: 'flip',
      question:
        '(a) A function f has f(1) = −2 and f′(x) = √(5 + x²). Use the increments formula to approximate f(1.1).\n(b) A function C has C(1) = 10 and C′(x) = 3√(x + 3). Explain why the increments formula would not give a good approximation for C(6), then find C(6) exactly. (7 marks)',
      answer:
        '(a) δf ≈ f′(1)·δx = √6 × 0.1. So f(1.1) ≈ −2 + 0.1√6.\n(b) The increment δx = 5 is not small, so the linear approximation is unreliable. Integrate: C(x) = ∫3(x+3)^½ dx = 2(x+3)^{3/2} + k. C(1) = 2(4)^{3/2} + k = 16 + k = 10 ⇒ k = −6. C(6) = 2(9)^{3/2} − 6 = 54 − 6 = 48.'
    },
    {
      topic: 'Optimisation',
      type: 'application',
      format: 'flip',
      question:
        'A rectangle has its base on the x-axis, lower-left corner at the origin, and upper-right corner on y = cos(2x) for 0 ≤ x ≤ π/4. Its perimeter is p(x) = 2x + 2cos(2x). Determine the largest perimeter. (4 marks)',
      answer:
        'p′(x) = 2 − 4 sin(2x) = 0 ⇒ sin(2x) = ½ ⇒ 2x = π/6 ⇒ x = π/12. (p″ = −8cos(2x) < 0 ⇒ maximum.)\np(π/12) = 2(π/12) + 2cos(π/6) = π/6 + 2(√3/2) = π/6 + √3.'
    },
    {
      topic: 'Fundamental Theorem',
      type: 'application',
      format: 'flip',
      question:
        'A function is given by f(t) = 4 − ½t for 0 ≤ t ≤ 10.\n(a) Determine ∫₀² f(t) dt.  (b) For F(x) = ∫₀ˣ f(t) dt, state the value of x at which F is greatest, giving a reason. (4 marks)',
      answer:
        '(a) ∫₀²(4 − ½t) dt = [4t − ¼t²]₀² = 8 − 1 = 7.\n(b) F is greatest where F′(x) = f(x) = 0 and f changes + → −. f(t) = 0 at t = 8, and f > 0 before, < 0 after, so F is maximum at x = 8.'
    },
    {
      topic: 'Integration & Area',
      type: 'application',
      format: 'flip',
      question:
        'Determine ∫ (2x − 1)/(x² − x + 4) dx. (3 marks)',
      answer:
        'The numerator (2x − 1) is the derivative of the denominator (x² − x + 4). So the integral is of the form ∫ g′/g dx = ln|g| + C.\nAnswer: ln|x² − x + 4| + C.'
    }
  ]
}

const methodsTheory: BankSubject = {
  id: 'methods',
  name: 'Mathematics Methods',
  level: 'ATAR Unit 3 · Core rules & concepts',
  questions: [
    {
      topic: 'Differentiation Rules',
      type: 'formula',
      format: 'flip',
      question: 'State the product rule and the quotient rule for differentiation.',
      answer: 'Product: d/dx[u·v] = u′v + uv′.\nQuotient: d/dx[u/v] = (u′v − uv′)/v².'
    },
    {
      topic: 'Differentiation Rules',
      type: 'formula',
      format: 'flip',
      question: 'State the chain rule, and the derivatives of eˣ, ln x, sin x and cos x.',
      answer: 'Chain: d/dx f(g(x)) = f′(g(x))·g′(x).\nd/dx eˣ = eˣ;  d/dx ln x = 1/x;  d/dx sin x = cos x;  d/dx cos x = −sin x.'
    },
    {
      topic: 'Curve Analysis',
      type: 'concept',
      format: 'typed',
      question: 'What is a stationary point, and how do you use the second derivative to classify one?',
      answer: 'A stationary point is where f′(x) = 0. Second-derivative test: f″ > 0 ⇒ local minimum; f″ < 0 ⇒ local maximum; f″ = 0 is inconclusive (use a sign test of f′ either side).'
    },
    {
      topic: 'Random Variables',
      type: 'concept',
      format: 'typed',
      question: 'How do you find an unknown constant k in a discrete probability distribution?',
      answer: 'Sum EVERY P(X = x), set the total equal to 1, and solve for k. It is often a quadratic — find both roots and reject any that make a probability negative or greater than 1.'
    },
    {
      topic: 'Random Variables',
      type: 'formula',
      format: 'flip',
      question: 'State the rules for E(aX + b) and Var(aX + b).',
      answer: 'E(aX + b) = aE(X) + b.\nVar(aX + b) = a²Var(X). The constant b does NOT affect the variance — only the multiplier a, and it is squared.'
    },
    {
      topic: 'Random Variables',
      type: 'formula',
      format: 'flip',
      question: 'How do you calculate E(X) and Var(X) from a probability distribution table?',
      answer: 'E(X) = Σ x·P(X = x).\nVar(X) = E(X²) − [E(X)]² = Σ x²·P(X = x) − [E(X)]².  SD(X) = √Var(X).'
    },
    {
      topic: 'Increments',
      type: 'concept',
      format: 'typed',
      question: 'State the increments formula and when it is valid to use.',
      answer: 'δf ≈ f′(x)·δx (equivalently f(x + δx) ≈ f(x) + f′(x)·δx). It is only a good approximation when δx is small; for large increments it is unreliable and you should integrate instead.'
    },
    {
      topic: 'Integration',
      type: 'concept',
      format: 'typed',
      question: 'State the Fundamental Theorem of Calculus (both parts).',
      answer: 'If F(x) = ∫ₐˣ f(t) dt then F′(x) = f(x) (differentiation undoes integration). And ∫ₐᵇ f(x) dx = F(b) − F(a), where F is any antiderivative of f.'
    },
    {
      topic: 'Integration',
      type: 'formula',
      format: 'flip',
      question: 'What is ∫ g′(x)/g(x) dx, and what is the reverse chain rule for ∫ (ax + b)ⁿ dx?',
      answer: '∫ g′(x)/g(x) dx = ln|g(x)| + C.\n∫ (ax + b)ⁿ dx = (ax + b)ⁿ⁺¹ / [a(n+1)] + C, for n ≠ −1.'
    },
    {
      topic: 'Kinematics',
      type: 'concept',
      format: 'typed',
      question: 'How are displacement, velocity and acceleration related by calculus?',
      answer: 'Differentiate to go down: x → v = dx/dt → a = dv/dt. Integrate to go up: a → v = ∫a dt → x = ∫v dt (each integration needs an initial condition to find the constant).'
    }
  ]
}

// Accounting theory — a mix of multiple-choice (the format that actually shows
// up in ACF exams) and short-answer. MCQ targets Noah's known weak spots:
// period vs product cost, variance direction, CVP, cash-vs-profit, debtor timing.
const accountingTheory: BankSubject = {
  id: 'accounting',
  name: 'Accounting & Finance',
  level: 'ATAR Unit 3 · Theory & multiple choice',
  questions: [
    {
      topic: 'Cost Classification',
      type: 'concept',
      format: 'mcq',
      question: "Factory rent in a manufacturing business is best classified as:",
      answer: 'A product cost (manufacturing overhead)',
      options: [
        'A product cost (manufacturing overhead)',
        'A period cost expensed when paid',
        'A direct material cost',
        'A selling and distribution expense'
      ]
    },
    {
      topic: 'Cost Classification',
      type: 'concept',
      format: 'mcq',
      question: 'Which of the following is a period cost?',
      answer: 'Sales commission paid to the sales team',
      options: [
        'Sales commission paid to the sales team',
        'Direct labour on the production line',
        'Glue used in assembling the product',
        'Depreciation of factory machinery'
      ]
    },
    {
      topic: 'Variance Analysis',
      type: 'concept',
      format: 'mcq',
      question: 'Actual material cost was $4,200; the budget was $3,800. This variance is:',
      answer: 'Unfavourable, because actual cost exceeded budget',
      options: [
        'Unfavourable, because actual cost exceeded budget',
        'Favourable, because more was spent on materials',
        'Favourable, because it is above budget',
        'Neither — variances only apply to revenue'
      ]
    },
    {
      topic: 'CVP Analysis',
      type: 'concept',
      format: 'mcq',
      question: 'The break-even point in units is calculated as:',
      answer: 'Fixed costs ÷ contribution margin per unit',
      options: [
        'Fixed costs ÷ contribution margin per unit',
        'Fixed costs ÷ selling price per unit',
        'Total costs ÷ selling price per unit',
        'Contribution margin ÷ fixed costs'
      ]
    },
    {
      topic: 'Cash vs Profit',
      type: 'concept',
      format: 'mcq',
      question: 'A business can be profitable yet run out of cash mainly because:',
      answer: 'Profit includes credit sales and non-cash items like depreciation',
      options: [
        'Profit includes credit sales and non-cash items like depreciation',
        'Profit and cash are always the same figure',
        'Cash only falls when the business makes a loss',
        'Depreciation is a cash outflow each period'
      ]
    },
    {
      topic: 'Debtor Collection',
      type: 'concept',
      format: 'typed',
      question: 'In a debtors collection schedule, which month receives the largest percentage of a credit sale, and why draw a timeline first?',
      answer: 'The month OF sale collects the largest share (e.g. 50%), then the following month (e.g. 20%), then two months later (e.g. 8%). Draw a timeline first so you collect FORWARD from the sale month and never reverse the direction.'
    }
  ]
}

export const questionBank: BankBranch[] = [
  {
    id: 'practice',
    name: 'Practice',
    blurb: 'Exam-style questions to work through',
    subjects: [methodsPractice]
  },
  {
    id: 'theory',
    name: 'Theory',
    blurb: 'Definitions, rules and concepts to lock in',
    subjects: [methodsTheory, accountingTheory]
  }
]
