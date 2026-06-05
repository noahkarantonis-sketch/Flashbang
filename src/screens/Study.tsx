import { useMemo, useState, useEffect } from 'react'
import { useStore } from '../store'
import { buildQueue } from '../lib/priority'
import type { Card, Grade } from '../types'
import { HintIcon, SuspendIcon, ChevronLeft } from '../components/Icons'
import { ai, type AnswerGrade, type GeneratedCard } from '../lib/ai'
import { Markdown } from '../components/Markdown'
import type { Tab } from '../App'

// Turn a card's history + topic test results into a short phrase the hint
// model can use to tailor itself ("missed on Test 2", "you keep grading hard").
function historyPhrase(card: Card, tests: { topic: string; scorePct: number; label: string }[]) {
  const bits: string[] = []
  const bombed = tests.filter((t) => t.topic === card.topic && t.scorePct < 55)
  if (bombed.length) {
    const t = bombed[bombed.length - 1]
    bits.push(`scored ${Math.round(t.scorePct)}% on ${t.label || 'a test'} in this topic`)
  }
  const recent = card.history.slice(-3)
  const forgot = recent.filter((r) => r.grade === 'forgot').length
  const hard = recent.filter((r) => r.grade === 'hard').length
  if (forgot >= 1) bits.push('forgot this recently')
  else if (hard >= 2) bits.push('found this hard last few times')
  return bits.join('; ') || 'no strong signal yet'
}

// A typed answer's verdict maps onto the existing spaced-repetition grades.
const VERDICT_GRADE: Record<AnswerGrade['verdict'], Grade> = {
  correct: 'easy',
  partial: 'hard',
  incorrect: 'forgot'
}
const gradeLabel = (g: Grade) => g.charAt(0).toUpperCase() + g.slice(1)
const VERDICT_LABEL: Record<AnswerGrade['verdict'], string> = {
  correct: 'Correct',
  partial: 'Partly right',
  incorrect: 'Not quite'
}
const VERDICT_COLOR: Record<AnswerGrade['verdict'], string> = {
  correct: 'var(--strong)',
  partial: 'var(--mid)',
  incorrect: 'var(--weak)'
}

export function Study({
  topic,
  go
}: {
  topic: string | null
  go: (t: Tab, topic?: string | null) => void
}) {
  const { subjects, cards, tests, gradeCard, suspendCard, sessionLimit, autoAdvance } = useStore()

  // Build the queue ONCE on entry so grading doesn't reshuffle mid-session.
  const initialQueue = useMemo(() => {
    let q = buildQueue(cards, subjects, tests)
    if (topic) q = q.filter((c) => c.topic === topic)
    let ids = q.map((c) => c.id)
    if (sessionLimit > 0) ids = ids.slice(0, sessionLimit)
    return ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [hint, setHint] = useState('')
  const [hintLoading, setHintLoading] = useState(false)
  const [usedHint, setUsedHint] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [explLoading, setExplLoading] = useState(false)
  const [done, setDone] = useState(0)

  // typed-answer state
  const [typed, setTyped] = useState('')
  const [checking, setChecking] = useState(false)
  const [answerGrade, setAnswerGrade] = useState<AnswerGrade | null>(null)

  // practice drill
  const [drillOpen, setDrillOpen] = useState(false)

  const cardId = initialQueue[idx]
  const card = cards.find((c) => c.id === cardId)
  const format = card?.format ?? 'flip'

  useEffect(() => {
    setRevealed(false)
    setHint('')
    setUsedHint(false)
    setExplanation('')
    setTyped('')
    setAnswerGrade(null)
    setDrillOpen(false)
  }, [idx])

  if (initialQueue.length === 0) {
    return (
      <div className="center-col">
        <h2 className="serif" style={{ fontSize: 26 }}>Nothing due</h2>
        <p className="muted">
          {topic ? `No cards ready in ${topic}.` : 'Your queue is empty. Add notes to make cards.'}
        </p>
        <button className="btn btn-sm" onClick={() => go('home')}>Back home</button>
      </div>
    )
  }

  if (idx >= initialQueue.length || !card) {
    return (
      <div className="center-col fade-in">
        <h1 className="greeting">Session done</h1>
        <p className="muted">
          {done} {done === 1 ? 'card' : 'cards'} reviewed. Your confidence scores just updated.
        </p>
        <div className="btn-row">
          <button className="btn btn-sm btn-ghost" onClick={() => go('graph')}>See the graph</button>
          <button className="btn btn-sm" onClick={() => go('home')}>Home</button>
        </div>
      </div>
    )
  }

  async function loadHint() {
    if (!card) return
    setHintLoading(true)
    setUsedHint(true)
    try {
      const h = await ai.hint({
        question: card.question,
        answer: card.answer,
        topic: card.topic,
        history: historyPhrase(card, tests)
      })
      setHint(h)
    } catch {
      setHint('(Hint unavailable — check your connection.)')
    } finally {
      setHintLoading(false)
    }
  }

  async function loadExplanation() {
    if (!card) return
    setExplLoading(true)
    try {
      const related = cards
        .filter((c) => c.topic === card.topic && c.id !== card.id)
        .slice(0, 5)
        .map((c) => `- ${c.question}`)
        .join('\n')
      const ex = await ai.explain({
        question: card.question,
        answer: card.answer,
        topic: card.topic,
        context: related
      })
      setExplanation(ex)
    } catch {
      setExplanation('(Explanation unavailable right now.)')
    } finally {
      setExplLoading(false)
    }
  }

  function grade(g: Grade) {
    gradeCard(card!.id, g, usedHint)
    setDone((d) => d + 1)
    setIdx((i) => i + 1)
  }

  async function checkTyped() {
    if (!card || !typed.trim()) return
    setChecking(true)
    try {
      const result = await ai.gradeAnswer({
        question: card.question,
        answer: card.answer,
        userAnswer: typed.trim(),
        topic: card.topic
      })
      setAnswerGrade(result)
      setRevealed(true)
    } catch {
      setAnswerGrade({ verdict: 'partial', feedback: "Couldn't grade that automatically — check the answer below and grade yourself." })
      setRevealed(true)
    } finally {
      setChecking(false)
    }
  }

  const progress = (idx / initialQueue.length) * 100
  const suggested = answerGrade ? VERDICT_GRADE[answerGrade.verdict] : null

  return (
    <div className="fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="muted" onClick={() => go('home')}><ChevronLeft size={18} /></button>
        <span className="pill">{card.topic}</span>
        <span className="muted" style={{ fontSize: 14 }}>
          {idx + 1} / {initialQueue.length}
        </span>
      </div>
      <div className="bar" style={{ marginBottom: 36 }}>
        <span className="bar-strong" style={{ width: `${progress}%` }} />
      </div>

      <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2 className="serif" style={{ fontSize: 27, textAlign: 'center', lineHeight: 1.3 }}>
          {card.question}
        </h2>
      </div>

      {hint && (
        <div className="card fade-in" style={{ borderLeft: '3px solid var(--mid)' }}>
          <div className="label" style={{ marginTop: 0, color: 'var(--mid)' }}>Hint</div>
          <Markdown text={hint} />
        </div>
      )}

      {/* ---------- TYPED CARD: input + check ---------- */}
      {format === 'typed' && !revealed && (
        <div style={{ marginTop: 22, maxWidth: 520, marginInline: 'auto' }}>
          <textarea
            autoFocus
            placeholder="Type your answer…"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            style={{ minHeight: 110 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) checkTyped() }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={loadHint} disabled={hintLoading}>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <HintIcon size={18} /> {hintLoading ? 'Thinking…' : hint ? 'Another hint' : 'Need a hint'}
              </span>
            </button>
            <button className="btn" onClick={checkTyped} disabled={checking || !typed.trim()}>
              {checking ? 'Checking…' : 'Check answer'}
            </button>
            <button className="muted btn-sm" onClick={() => setRevealed(true)} style={{ textDecoration: 'underline' }}>
              Skip — just show me
            </button>
          </div>
        </div>
      )}

      {/* ---------- FLIP CARD: hint + reveal ---------- */}
      {format === 'flip' && !revealed && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, marginInline: 'auto' }}>
          <button className="btn btn-ghost" onClick={loadHint} disabled={hintLoading}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <HintIcon size={18} /> {hintLoading ? 'Thinking…' : hint ? 'Another hint' : 'Need a hint'}
            </span>
          </button>
          <button className="btn" onClick={() => setRevealed(true)}>Reveal answer</button>
        </div>
      )}

      {/* ---------- REVEALED ---------- */}
      {revealed && (
        <div className="fade-in">
          {/* verdict for typed answers */}
          {answerGrade && (
            <div className="card fade-in" style={{ marginTop: 24, borderLeft: `3px solid ${VERDICT_COLOR[answerGrade.verdict]}` }}>
              <div className="row">
                <span style={{ fontWeight: 700, color: VERDICT_COLOR[answerGrade.verdict] }}>
                  {VERDICT_LABEL[answerGrade.verdict]}
                </span>
              </div>
              <div style={{ marginTop: 6 }}><Markdown text={answerGrade.feedback} /></div>
            </div>
          )}

          <div className="divider" style={{ margin: '24px 0' }} />
          <div className="label" style={{ marginTop: 0, textAlign: answerGrade ? 'left' : 'center' }}>
            {answerGrade ? 'Model answer' : ''}
          </div>
          <div style={{ fontSize: 17, textAlign: answerGrade ? 'left' : 'center', lineHeight: 1.5, marginBottom: 8 }}>
            {card.answer}
          </div>

          {explanation && (
            <div className="card fade-in" style={{ marginTop: 16 }}>
              <div className="label" style={{ marginTop: 0 }}>Explanation</div>
              <Markdown text={explanation} />
            </div>
          )}
          {!explanation && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="muted btn-sm" onClick={loadExplanation} disabled={explLoading} style={{ textDecoration: 'underline' }}>
                {explLoading ? 'Explaining…' : 'Explain this'}
              </button>
            </div>
          )}

          {autoAdvance && suggested ? (
            <div style={{ maxWidth: 380, marginInline: 'auto', textAlign: 'center' }}>
              <button className="btn" style={{ width: '100%' }} onClick={() => grade(suggested)}>Next card</button>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Auto-graded “{gradeLabel(suggested)}” — take your time, then continue.
              </p>
            </div>
          ) : (
            <>
              <div className="label" style={{ textAlign: 'center' }}>
                {suggested ? 'Suggested — adjust if needed' : 'How did you go?'}
              </div>
              <div className="btn-row" style={{ maxWidth: 380, marginInline: 'auto' }}>
                <button className="btn" style={{ background: 'var(--weak)', color: '#fff', outline: suggested === 'forgot' ? '2px solid var(--ink)' : 'none' }} onClick={() => grade('forgot')}>Forgot</button>
                <button className="btn" style={{ background: 'var(--mid)', color: '#3a2e16', outline: suggested === 'hard' ? '2px solid var(--ink)' : 'none' }} onClick={() => grade('hard')}>Hard</button>
                <button className="btn" style={{ background: 'var(--strong)', color: '#16261a', outline: suggested === 'easy' ? '2px solid var(--ink)' : 'none' }} onClick={() => grade('easy')}>Easy</button>
              </div>
            </>
          )}

          <div className="row" style={{ justifyContent: 'center', gap: 20, marginTop: 22 }}>
            <button className="muted btn-sm" onClick={() => setDrillOpen(true)} style={{ textDecoration: 'underline' }}>
              Practice similar
            </button>
            <button className="muted btn-sm" onClick={() => { suspendCard(card.id, true); setIdx((i) => i + 1) }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <SuspendIcon size={16} /> Archive card
              </span>
            </button>
          </div>
          <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 14 }}>
            This updates your {card.topic} confidence and when you see it next.
          </p>
        </div>
      )}

      {drillOpen && card && (
        <PracticeDrill
          card={card}
          onClose={() => setDrillOpen(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ephemeral practice drill — fresh typed questions on the same concept.
// Nothing is saved; answer, get graded, close.
// ---------------------------------------------------------------------------
function PracticeDrill({ card, onClose }: { card: Card; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<GeneratedCard[]>([])
  const [i, setI] = useState(0)
  const [typed, setTyped] = useState('')
  const [checking, setChecking] = useState(false)
  const [grade, setGrade] = useState<AnswerGrade | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const material = `Topic: ${card.topic}\nQuestion: ${card.question}\nAnswer: ${card.answer}`
    ai.practice(material, 4)
      .then((qs) => setQuestions(qs))
      .catch(() => setError("Couldn't generate practice questions right now."))
      .finally(() => setLoading(false))
  }, [card])

  const q = questions[i]

  async function check() {
    if (!q || !typed.trim()) return
    setChecking(true)
    try {
      const r = await ai.gradeAnswer({
        question: q.question,
        answer: q.answer,
        userAnswer: typed.trim(),
        topic: q.topic
      })
      setGrade(r)
    } catch {
      setGrade({ verdict: 'partial', feedback: 'See the model answer below.' })
    } finally {
      setChecking(false)
    }
  }

  function next() {
    setTyped('')
    setGrade(null)
    setI((n) => n + 1)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 14 }}>
          <span className="pill">Practice · {card.topic}</span>
          <button className="muted btn-sm" onClick={onClose}>Close</button>
        </div>

        {loading && (
          <div className="center-col" style={{ padding: '30px 0' }}>
            <div className="pulse-dot" />
            <p className="muted">Writing fresh practice questions…</p>
          </div>
        )}

        {error && <p className="c-weak">{error}</p>}

        {!loading && !error && i >= questions.length && (
          <div className="center-col" style={{ padding: '24px 0' }}>
            <h3 className="serif" style={{ fontSize: 22 }}>Nice work</h3>
            <p className="muted">That's the drill. These weren't saved to your deck.</p>
            <button className="btn btn-sm" onClick={onClose}>Done</button>
          </div>
        )}

        {!loading && !error && q && i < questions.length && (
          <>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              {i + 1} / {questions.length}
            </div>
            <h3 className="serif" style={{ fontSize: 21, lineHeight: 1.3, marginBottom: 16 }}>
              {q.question}
            </h3>

            {!grade && (
              <>
                <textarea
                  autoFocus
                  placeholder="Type your answer…"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  style={{ minHeight: 90 }}
                />
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-sm" onClick={check} disabled={checking || !typed.trim()}>
                    {checking ? 'Checking…' : 'Check'}
                  </button>
                </div>
              </>
            )}

            {grade && (
              <div className="fade-in">
                <div className="card" style={{ borderLeft: `3px solid ${VERDICT_COLOR[grade.verdict]}` }}>
                  <span style={{ fontWeight: 700, color: VERDICT_COLOR[grade.verdict] }}>
                    {VERDICT_LABEL[grade.verdict]}
                  </span>
                  <div style={{ marginTop: 6 }}><Markdown text={grade.feedback} /></div>
                </div>
                <div className="label">Model answer</div>
                <div style={{ lineHeight: 1.5 }}>{q.answer}</div>
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-sm" onClick={next}>
                    {i + 1 < questions.length ? 'Next' : 'Finish'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
