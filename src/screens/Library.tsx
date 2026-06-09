import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { topicConfidence, band } from '../lib/confidence'
import { bandClass, barClass, toDateInput, fromDateInput, formatExamDate, daysUntil } from '../lib/ui'
import { ChevronLeft, ChevronRight, PinIcon, SuspendIcon, TrashIcon, EditIcon } from '../components/Icons'
import type { Tab } from '../App'

export function Library({ go }: { go: (t: Tab, topic?: string | null) => void }) {
  const { subjects, cards, docs } = useStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [fSubject, setFSubject] = useState('') // '' = all subjects
  const [fBand, setFBand] = useState<'all' | 'weak' | 'mid' | 'strong'>('all')

  const q = query.trim().toLowerCase()
  const searching = q.length > 0 || fSubject !== '' || fBand !== 'all'
  const results = useMemo(() => {
    if (!searching) return []
    return cards
      .filter((c) => {
        if (fSubject && c.subjectId !== fSubject) return false
        if (fBand !== 'all') {
          const s = topicConfidence(c.topic, cards, [])
          if (s == null || band(s) !== fBand) return false
        }
        if (q && !`${c.question} ${c.answer} ${c.topic}`.toLowerCase().includes(q)) return false
        return true
      })
      .slice(0, 80)
  }, [cards, q, fSubject, fBand, searching])

  if (selected) {
    const subject = subjects.find((s) => s.id === selected)
    if (!subject) {
      setSelected(null)
      return null
    }
    return <SubjectView subjectId={selected} onBack={() => setSelected(null)} go={go} />
  }

  return (
    <>
      <h1 className="page-title">Library</h1>

      {cards.length > 0 && (
        <>
          <input
            placeholder="Search all cards…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <select value={fSubject} onChange={(e) => setFSubject(e.target.value)} style={{ width: 'auto', flex: '1 1 auto' }}>
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="btn-row">
              {(['all', 'weak', 'mid', 'strong'] as const).map((b) => (
                <button
                  key={b}
                  className={'btn btn-sm ' + (fBand === b ? '' : 'btn-ghost')}
                  onClick={() => setFBand(b)}
                  style={{ textTransform: 'capitalize', padding: '6px 10px' }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {searching ? (
        <>
          <div className="label">
            {results.length} {results.length === 1 ? 'match' : 'matches'}
          </div>
          <div className="card">
            {results.length === 0 ? (
              <p className="muted" style={{ fontSize: 14 }}>No cards match.</p>
            ) : (
              results.map((c) => <CardRow key={c.id} cardId={c.id} showTopic />)
            )}
          </div>
        </>
      ) : (
        <>
          {subjects.length === 0 && (
            <p className="muted">No subjects yet. Add notes from the + tab to get started.</p>
          )}
          {subjects.map((s) => {
            const sCards = cards.filter((c) => c.subjectId === s.id && !c.suspended)
            const sDocs = docs.filter((d) => d.subjectId === s.id)
            return (
              <div
                key={s.id}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected(s.id)}
              >
                <div className="row">
                  <div className="stack">
                    <h2 style={{ fontSize: 22 }}>{s.name}</h2>
                    <span className="muted" style={{ fontSize: 14 }}>
                      {sCards.length} cards · {sDocs.length} docs
                      {s.examDate && s.examDate > Date.now()
                        ? ` · exam in ${Math.max(0, daysUntil(s.examDate))}d`
                        : ''}
                    </span>
                  </div>
                  <ChevronRight className="muted" />
                </div>
              </div>
            )
          })}
        </>
      )}
    </>
  )
}

function SubjectView({
  subjectId,
  onBack,
  go
}: {
  subjectId: string
  onBack: () => void
  go: (t: Tab, topic?: string | null) => void
}) {
  const store = useStore()
  const { cards, tests, docs } = store
  const subject = store.subjects.find((s) => s.id === subjectId)!
  const [showTest, setShowTest] = useState(false)
  const [openTopic, setOpenTopic] = useState<string | null>(null)

  const topics = useMemo(() => {
    const sCards = cards.filter((c) => c.subjectId === subjectId)
    const names = [...new Set(sCards.map((c) => c.topic))]
    return names
      .map((t) => ({
        topic: t,
        count: sCards.filter((c) => c.topic === t && !c.suspended).length,
        suspended: sCards.filter((c) => c.topic === t && c.suspended).length,
        score: topicConfidence(t, cards, tests)
      }))
      .sort((a, b) => (a.score ?? 50) - (b.score ?? 50))
  }, [cards, tests, subjectId])

  const sDocs = docs.filter((d) => d.subjectId === subjectId)

  return (
    <>
      <button className="muted" onClick={onBack} style={{ marginBottom: 8 }}>
        <ChevronLeft size={18} />
      </button>
      <h1 className="page-title" style={{ marginBottom: 16 }}>{subject.name}</h1>

      {/* exam + intensity controls */}
      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Exam date</div>
        <input
          type="date"
          value={toDateInput(subject.examDate)}
          onChange={(e) => store.setExamDate(subjectId, fromDateInput(e.target.value))}
        />
        {subject.examDate && (
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            {formatExamDate(subject.examDate)} — the whole queue re-prioritises around this.
          </p>
        )}

        <div className="label">Study intensity — {subject.intensity.toFixed(1)}×</div>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={subject.intensity}
          onChange={(e) => store.setIntensity(subjectId, parseFloat(e.target.value))}
        />
        <p className="muted" style={{ fontSize: 13 }}>
          Crank it up to hammer this subject this week, regardless of the algorithm.
        </p>
      </div>

      {/* topics + confidence */}
      <div className="label">Topics</div>
      {topics.length === 0 && <p className="muted">No cards yet.</p>}
      {topics.map((t) => (
        <div className="card" key={t.topic}>
          <div className="row" style={{ cursor: 'pointer' }} onClick={() => setOpenTopic(openTopic === t.topic ? null : t.topic)}>
            <div className="stack" style={{ flex: 1 }}>
              <div className="row">
                <span>{t.topic}</span>
                {t.score != null && (
                  <span className={bandClass(t.score)} style={{ fontWeight: 600 }}>{t.score}</span>
                )}
              </div>
              {t.score != null && (
                <div className="bar" style={{ marginTop: 6 }}>
                  <span className={barClass(t.score)} style={{ width: `${t.score}%` }} />
                </div>
              )}
              <span className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                {t.count} active{t.suspended ? ` · ${t.suspended} discarded` : ''}
              </span>
            </div>
          </div>

          {openTopic === t.topic && (
            <div className="fade-in" style={{ marginTop: 14 }}>
              <button className="btn btn-sm" onClick={() => go('study', t.topic)}>
                Study {t.topic}
              </button>
              <div className="divider" />
              {cards
                .filter((c) => c.subjectId === subjectId && c.topic === t.topic)
                .map((c) => (
                  <CardRow key={c.id} cardId={c.id} />
                ))}
            </div>
          )}
        </div>
      ))}

      {/* documents */}
      {sDocs.length > 0 && (
        <>
          <div className="label">Documents</div>
          {sDocs.map((d) => (
            <div className="card" key={d.id}>
              <div className="row">
                <div className="stack">
                  <span>{d.title}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {d.kind} · {d.cardCount} cards
                  </span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* test results */}
      <div className="label">Test results</div>
      {tests.filter((t) => t.subjectId === subjectId).map((t) => (
        <div className="card" key={t.id}>
          <div className="row">
            <div className="stack">
              <span>{t.label || 'Test'} {t.topic ? `· ${t.topic}` : ''}</span>
              <span className="muted" style={{ fontSize: 13 }}>{new Date(t.at).toLocaleDateString()}</span>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <span className={bandClass(t.scorePct)} style={{ fontWeight: 600 }}>{Math.round(t.scorePct)}%</span>
              <button className="muted" onClick={() => store.removeTest(t.id)}><TrashIcon size={16} /></button>
            </div>
          </div>
        </div>
      ))}
      {showTest ? (
        <TestForm subjectId={subjectId} topics={topics.map((t) => t.topic)} onDone={() => setShowTest(false)} />
      ) : (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setShowTest(true)}>
          Log a test result
        </button>
      )}
    </>
  )
}

function CardRow({ cardId, showTopic = false }: { cardId: string; showTopic?: boolean }) {
  const store = useStore()
  const card = store.cards.find((c) => c.id === cardId)
  const [editing, setEditing] = useState(false)
  if (!card) return null
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--hairline)' }}>
      {editing ? (
        <>
          <textarea value={card.question} onChange={(e) => store.editCard(card.id, { question: e.target.value })} style={{ minHeight: 56 }} />
          <textarea value={card.answer} onChange={(e) => store.editCard(card.id, { answer: e.target.value })} style={{ minHeight: 56, marginTop: 8 }} />
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setEditing(false)}>Done</button>
        </>
      ) : (
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="stack" style={{ flex: 1, opacity: card.suspended ? 0.45 : 1 }}>
            {showTopic && <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{card.topic}</span>}
            <span style={{ fontWeight: 500 }}>{card.question}</span>
            <span className="muted" style={{ fontSize: 13 }}>{card.answer}</span>
          </div>
          <div className="btn-row" style={{ flexShrink: 0 }}>
            <button className={card.pinned ? 'c-mid' : 'muted'} title="Pin to top" onClick={() => store.pinCard(card.id, !card.pinned)}>
              <PinIcon size={16} />
            </button>
            <button className="muted" title="Edit" onClick={() => setEditing(true)}><EditIcon size={16} /></button>
            <button className={card.suspended ? 'c-strong' : 'muted'} title={card.suspended ? 'Restore' : 'Discard'} onClick={() => store.suspendCard(card.id, !card.suspended)}>
              <SuspendIcon size={16} />
            </button>
            <button className="muted" title="Delete" onClick={() => store.deleteCard(card.id)}><TrashIcon size={16} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

function TestForm({ subjectId, topics, onDone }: { subjectId: string; topics: string[]; onDone: () => void }) {
  const addTest = useStore((s) => s.addTest)
  const [label, setLabel] = useState('')
  const [topic, setTopic] = useState('')
  const [score, setScore] = useState('')
  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="label" style={{ marginTop: 0 }}>Log a test</div>
      <input placeholder="Label (e.g. Test 2)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <select style={{ marginTop: 10 }} value={topic} onChange={(e) => setTopic(e.target.value)}>
        <option value="">Whole subject</option>
        {topics.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input style={{ marginTop: 10 }} type="number" min={0} max={100} placeholder="Score %" value={score} onChange={(e) => setScore(e.target.value)} />
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>Cancel</button>
        <button className="btn btn-sm" onClick={() => {
          const pct = parseFloat(score)
          if (isNaN(pct)) return
          addTest({ subjectId, topic, scorePct: Math.max(0, Math.min(100, pct)), at: Date.now(), label })
          onDone()
        }}>Save</button>
      </div>
    </div>
  )
}
