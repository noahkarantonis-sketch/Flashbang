import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { buildWeakDrill } from '../lib/priority'
import { bandClass } from '../lib/ui'
import { ai, type AnswerGrade } from '../lib/ai'
import { Markdown } from '../components/Markdown'
import { ChevronLeft, TargetIcon } from '../components/Icons'
import type { Card } from '../types'
import type { Go } from '../App'

type Phase = 'setup' | 'running' | 'grading' | 'result'
type Scope = 'weak' | 'all' | string // string = subjectId

interface Q {
  question: string
  answer: string
  topic: string
  subjectId: string
}
interface Graded extends Q {
  userAnswer: string
  verdict: AnswerGrade['verdict']
  feedback: string
}

const VERDICT_POINTS: Record<AnswerGrade['verdict'], number> = {
  correct: 1,
  partial: 0.5,
  incorrect: 0
}
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Test({ go }: { go: Go }) {
  const { subjects, cards, tests, addTest } = useStore()

  const [phase, setPhase] = useState<Phase>('setup')
  const [scope, setScope] = useState<Scope>('weak')
  const [length, setLength] = useState(10)

  const [questions, setQuestions] = useState<Q[]>([])
  const [i, setI] = useState(0)
  const [typed, setTyped] = useState('')
  const answers = useRef<string[]>([])

  const [graded, setGraded] = useState<Graded[]>([])
  const [gradeProgress, setGradeProgress] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const logged = useRef(false)

  // Candidate cards available for the chosen scope.
  const candidates = useMemo<Card[]>(() => {
    const live = cards.filter((c) => !c.suspended)
    if (scope === 'weak') {
      const drill = buildWeakDrill(cards, subjects, tests, { limit: 999 })
      return drill.length ? drill : live
    }
    if (scope === 'all') return live
    return live.filter((c) => c.subjectId === scope)
  }, [scope, cards, subjects, tests])

  const available = candidates.length
  const realLength = Math.min(length, available)

  // Live timer while taking the test.
  useEffect(() => {
    if (phase !== 'running') return
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 500)
    return () => clearInterval(t)
  }, [phase, startedAt])

  function start() {
    const picked = shuffle(candidates).slice(0, realLength)
    const qs: Q[] = picked.map((c) => ({
      question: c.question,
      answer: c.answer,
      topic: c.topic,
      subjectId: c.subjectId
    }))
    setQuestions(qs)
    answers.current = []
    setI(0)
    setTyped('')
    setStartedAt(Date.now())
    setElapsed(0)
    setPhase('running')
  }

  function submitAnswer() {
    answers.current[i] = typed.trim()
    if (i + 1 < questions.length) {
      setI(i + 1)
      setTyped('')
    } else {
      runGrading()
    }
  }

  async function runGrading() {
    setPhase('grading')
    setGradeProgress(0)
    let done = 0
    const out = await Promise.all(
      questions.map(async (q, idx) => {
        const ua = answers.current[idx] || ''
        let verdict: AnswerGrade['verdict'] = 'incorrect'
        let feedback = 'No answer given.'
        if (ua) {
          try {
            const r = await ai.gradeAnswer({
              question: q.question,
              answer: q.answer,
              userAnswer: ua,
              topic: q.topic
            })
            verdict = r.verdict
            feedback = r.feedback
          } catch {
            verdict = 'partial'
            feedback = 'Could not auto-grade — compare with the model answer.'
          }
        }
        done++
        setGradeProgress(done)
        return { ...q, userAnswer: ua, verdict, feedback } as Graded
      })
    )
    setGraded(out)
    setPhase('result')
  }

  // Overall + per-topic scores; log a TestResult per topic once.
  const summary = useMemo(() => {
    if (graded.length === 0) return null
    const pts = graded.reduce((a, g) => a + VERDICT_POINTS[g.verdict], 0)
    const overall = Math.round((pts / graded.length) * 100)

    const byTopic = new Map<string, { subjectId: string; got: number; n: number }>()
    for (const g of graded) {
      const cur = byTopic.get(g.topic) ?? { subjectId: g.subjectId, got: 0, n: 0 }
      cur.got += VERDICT_POINTS[g.verdict]
      cur.n += 1
      byTopic.set(g.topic, cur)
    }
    const topics = [...byTopic.entries()]
      .map(([topic, v]) => ({
        topic,
        subjectId: v.subjectId,
        score: Math.round((v.got / v.n) * 100),
        n: v.n
      }))
      .sort((a, b) => a.score - b.score)
    return { overall, topics }
  }, [graded])

  useEffect(() => {
    if (phase !== 'result' || !summary || logged.current) return
    logged.current = true
    const at = Date.now()
    for (const t of summary.topics) {
      addTest({ subjectId: t.subjectId, topic: t.topic, scorePct: t.score, at, label: 'Practice test' })
    }
  }, [phase, summary, addTest])

  // ---------------------------------------------------------------- SETUP ----
  if (phase === 'setup') {
    return (
      <div className="fade-in">
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="muted" onClick={() => go('home')}><ChevronLeft size={18} /></button>
          <span className="pill">Practice test</span>
          <span />
        </div>

        <h1 className="greeting" style={{ marginTop: 8 }}>Set up your test</h1>

        <div className="label">What to test</div>
        <div className="card stack" style={{ gap: 10 }}>
          <ScopeBtn active={scope === 'weak'} onClick={() => setScope('weak')} title="Weak spots" sub="Your lowest-confidence topics" />
          <ScopeBtn active={scope === 'all'} onClick={() => setScope('all')} title="Everything" sub="All subjects mixed" />
          {subjects.map((s) => (
            <ScopeBtn key={s.id} active={scope === s.id} onClick={() => setScope(s.id)} title={s.name} sub="This subject only" />
          ))}
        </div>

        <div className="label">Length</div>
        <div className="btn-row">
          {[5, 10, 15].map((n) => (
            <button
              key={n}
              className={'btn ' + (length === n ? '' : 'btn-ghost')}
              onClick={() => setLength(n)}
            >
              {n} Qs
            </button>
          ))}
        </div>

        <div className="card" style={{ marginTop: 20, textAlign: 'center' }}>
          {available === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              No cards in this selection yet. Add some notes first.
            </p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
                {realLength} question{realLength === 1 ? '' : 's'} from your cards · AI-graded · free
              </p>
              <button className="btn" onClick={start}>Start test</button>
            </>
          )}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------- RUNNING ----
  if (phase === 'running') {
    const q = questions[i]
    const progress = (i / questions.length) * 100
    const last = i + 1 === questions.length
    return (
      <div className="fade-in">
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="muted" onClick={() => go('home')}><ChevronLeft size={18} /></button>
          <span className="pill">{q.topic}</span>
          <span className="muted" style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
            {fmtTime(elapsed)}
          </span>
        </div>
        <div className="bar" style={{ marginBottom: 8 }}>
          <span className="bar-strong" style={{ width: `${progress}%` }} />
        </div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 28 }}>
          Question {i + 1} of {questions.length}
        </div>

        <div style={{ minHeight: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 className="serif" style={{ fontSize: 25, textAlign: 'center', lineHeight: 1.3 }}>
            {q.question}
          </h2>
        </div>

        <div style={{ maxWidth: 520, marginInline: 'auto', marginTop: 18 }}>
          <textarea
            autoFocus
            placeholder="Type your answer…"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            style={{ minHeight: 110 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitAnswer() }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            <button className="btn" onClick={submitAnswer}>
              {last ? 'Finish & grade' : 'Next question'}
            </button>
            {!typed.trim() && (
              <button className="muted btn-sm" onClick={submitAnswer} style={{ textDecoration: 'underline' }}>
                Skip this one
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------- GRADING ----
  if (phase === 'grading') {
    return (
      <div className="center-col" style={{ minHeight: '60vh' }}>
        <div className="pulse-dot" />
        <h2 className="serif" style={{ fontSize: 24 }}>Marking your test…</h2>
        <p className="muted">{gradeProgress} / {questions.length} graded</p>
      </div>
    )
  }

  // --------------------------------------------------------------- RESULT ----
  return (
    <div className="fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="pill">Result</span>
        <span className="muted" style={{ fontSize: 14 }}>{fmtTime(elapsed)} · {graded.length} Qs</span>
      </div>

      <div className="center-col" style={{ padding: '12px 0 4px' }}>
        <div className={bandClass(summary?.overall ?? 0)} style={{ fontSize: 60, fontWeight: 700, lineHeight: 1 }}>
          {summary?.overall ?? 0}%
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          {(summary?.overall ?? 0) >= 75 ? 'Strong — that topic is locking in.'
            : (summary?.overall ?? 0) >= 50 ? 'Getting there — worth another pass.'
            : 'Rough patch — good that you found it.'}
        </p>
      </div>

      {summary && summary.topics.length > 1 && (
        <>
          <div className="label">By topic</div>
          <div className="card">
            {summary.topics.map((t, idx) => (
              <div key={t.topic} className="row" style={{ marginTop: idx === 0 ? 0 : 12 }}>
                <span>{t.topic} <span className="muted" style={{ fontSize: 12 }}>· {t.n}</span></span>
                <span className={bandClass(t.score)} style={{ fontWeight: 600 }}>{t.score}%</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="label">Review</div>
      <div className="stack" style={{ gap: 12 }}>
        {graded.map((g, idx) => (
          <div key={idx} className="card" style={{ borderLeft: `3px solid ${VERDICT_COLOR[g.verdict]}` }}>
            <div className="row">
              <span className="muted" style={{ fontSize: 12 }}>{g.topic}</span>
              <span style={{ fontWeight: 700, color: VERDICT_COLOR[g.verdict], fontSize: 14 }}>
                {VERDICT_LABEL[g.verdict]}
              </span>
            </div>
            <div className="serif" style={{ fontSize: 17, margin: '6px 0 10px' }}>{g.question}</div>
            <div className="muted" style={{ fontSize: 13 }}>Your answer</div>
            <div style={{ fontSize: 15, marginBottom: 8 }}>{g.userAnswer || <span className="muted">— skipped —</span>}</div>
            {g.feedback && <div style={{ marginBottom: 8 }}><Markdown text={g.feedback} /></div>}
            <div className="muted" style={{ fontSize: 13 }}>Model answer</div>
            <div style={{ fontSize: 15 }}>{g.answer}</div>
          </div>
        ))}
      </div>

      <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
        Scores logged — your confidence by topic just updated.
      </p>
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go('study', null, { weak: true })}>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <TargetIcon size={16} /> Drill weak spots
          </span>
        </button>
        <button className="btn btn-sm" onClick={() => go('home')}>Done</button>
      </div>
    </div>
  )
}

function ScopeBtn({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={'scope-btn' + (active ? ' active' : '')}
      style={{
        textAlign: 'left',
        width: '100%',
        padding: '12px 14px',
        borderRadius: 12,
        cursor: 'pointer',
        color: 'var(--ink)',
        border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--hairline)',
        background: active ? 'var(--surface-2)' : 'transparent'
      }}
    >
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div className="muted" style={{ fontSize: 13 }}>{sub}</div>
    </button>
  )
}
