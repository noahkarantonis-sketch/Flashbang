import { useRef, useState } from 'react'
import { useStore, type GeneratedCard } from '../store'
import type { StudyDoc } from '../types'
import { ai, aiErrorMessage } from '../lib/ai'
import { CameraIcon, FileIcon, PasteIcon, ChevronLeft, EditIcon, TestIcon, ChevronRight } from '../components/Icons'
import type { Tab } from '../App'

// Turns raw extracted exam questions into clean, original, style-matched
// practice cards — transformative (not verbatim reproduction of the paper).
const EXAM_INSTRUCTION =
  'These were extracted from a past exam paper. Rewrite them as original, self-contained practice cards in the student\'s study format: one card per distinct question or sub-part; preserve the difficulty and command word (define / explain / calculate / justify / evaluate); include the mark allocation in the question when shown (e.g. "(3 marks)"); write a concise correct model answer; and set a precise syllabus topic for each. Do not copy wording verbatim — reword into fresh equivalent questions. Use type-in format for anything beyond pure recall.'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const res = r.result as string
      resolve(res.split(',')[1]) // strip data: prefix
    }
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export function Add({ go }: { go: (t: Tab, topic?: string | null) => void }) {
  const { subjects, addSubject, commitGenerated, addDraft, patchAddDraft, resetAddDraft } = useStore()
  // The question bank comes from the store (remote-fetched on launch, bundled fallback).
  const questionBank = useStore((s) => s.bank)
  // The draft lives in the store so switching tabs mid-flow doesn't lose it.
  const { phase, pasteText, cards, docTitle, docKind, newSubject, refineText, error, examMode } = addDraft
  const subjectId = addDraft.subjectId || subjects[0]?.id || ''
  const [refining, setRefining] = useState(false)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [bankBranchId, setBankBranchId] = useState<string | null>(null)
  const [bankSubjectId, setBankSubjectId] = useState<string | null>(null)
  const [openTopic, setOpenTopic] = useState<string | null>(null)
  const imgInput = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)

  // Load bank questions straight into the review flow (no AI cost — pre-written).
  function loadBank(questions: GeneratedCard[], title: string) {
    patchAddDraft({ cards: questions, docTitle: title, docKind: 'bank', phase: 'review', error: '' })
  }

  function resolveSubjectId(): string {
    if (newSubject.trim()) {
      const id = addSubject(newSubject.trim())
      patchAddDraft({ subjectId: id })
      return id
    }
    return subjectId
  }

  async function run(fn: () => Promise<GeneratedCard[]>, title: string, kind: StudyDoc['kind']) {
    patchAddDraft({ docTitle: title, docKind: kind, phase: 'loading', error: '' })
    try {
      const result = await fn()
      if (!result || result.length === 0) {
        patchAddDraft({
          error: "Couldn't pull any cards from that. Try a clearer image or more text.",
          phase: 'error'
        })
        return
      }
      patchAddDraft({ cards: result, phase: 'review' })
    } catch (e: any) {
      patchAddDraft({ error: aiErrorMessage(e), phase: 'error' })
    }
  }

  // Past-exam import: extract from the paper, then rewrite into clean, original
  // practice cards (style-matched, not verbatim copies — safer + better drilling).
  async function runExam(fn: () => Promise<GeneratedCard[]>, title: string) {
    patchAddDraft({ docTitle: title, docKind: 'exam', phase: 'loading', error: '' })
    try {
      const raw = await fn()
      if (!raw || raw.length === 0) {
        patchAddDraft({ error: "Couldn't read questions from that paper. Try clearer text or a PDF.", phase: 'error' })
        return
      }
      let finalCards = raw
      try {
        const refined = await ai.refineCards(raw, EXAM_INSTRUCTION)
        if (refined && refined.length) finalCards = refined
      } catch {
        /* refine is best-effort; fall back to the raw extraction */
      }
      patchAddDraft({ cards: finalCards, phase: 'review' })
    } catch (e: any) {
      patchAddDraft({ error: aiErrorMessage(e), phase: 'error' })
    }
  }

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await fileToBase64(file)
    if (examMode) runExam(() => ai.cardsFromImage(b64, file.type), file.name)
    else run(() => ai.cardsFromImage(b64, file.type), file.name, 'scan')
  }

  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await fileToBase64(file)
    if (examMode) runExam(() => ai.cardsFromPdf(b64), file.name)
    else run(() => ai.cardsFromPdf(b64), file.name, 'upload')
  }

  function onPaste() {
    if (pasteText.trim().length < 20) {
      patchAddDraft({ error: 'Add a bit more text to make good cards.' })
      return
    }
    const snippet = pasteText.trim().slice(0, 40)
    if (examMode) runExam(() => ai.cardsFromText(pasteText.trim()), snippet + '…')
    else run(() => ai.cardsFromText(pasteText.trim()), snippet + '…', 'paste')
  }

  function commit() {
    const sid = resolveSubjectId()
    if (!sid) {
      patchAddDraft({ error: 'Pick or name a subject first.' })
      return
    }
    commitGenerated(sid, { title: docTitle, kind: docKind }, cards)
    resetAddDraft()
    go('library')
  }

  function editCard(i: number, patch: Partial<GeneratedCard>) {
    patchAddDraft({ cards: cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
  }
  function discard(i: number) {
    patchAddDraft({ cards: cards.filter((_, idx) => idx !== i) })
  }

  async function refine() {
    if (!refineText.trim() || cards.length === 0) return
    setRefining(true)
    patchAddDraft({ error: '' })
    try {
      const revised = await ai.refineCards(cards, refineText.trim())
      if (revised && revised.length) {
        patchAddDraft({ cards: revised, refineText: '' })
      } else {
        patchAddDraft({ error: 'The AI returned nothing — try rewording your instruction.' })
      }
    } catch (e: any) {
      patchAddDraft({ error: aiErrorMessage(e) })
    } finally {
      setRefining(false)
    }
  }

  async function addPractice() {
    if (cards.length === 0) return
    setPracticeLoading(true)
    patchAddDraft({ error: '' })
    try {
      const material = cards
        .map((c) => `Topic: ${c.topic} — Q: ${c.question} A: ${c.answer}`)
        .join('\n')
      const extra = await ai.practice(material, 5)
      if (extra && extra.length) {
        patchAddDraft({ cards: [...cards, ...extra.map((c) => ({ ...c, format: 'typed' as const }))] })
      }
    } catch (e: any) {
      patchAddDraft({ error: aiErrorMessage(e) })
    } finally {
      setPracticeLoading(false)
    }
  }

  // ---- subject picker (shared) ----
  const SubjectPicker = (
    <>
      <div className="label">Subject</div>
      {subjects.length > 0 && (
        <select value={subjectId} onChange={(e) => patchAddDraft({ subjectId: e.target.value, newSubject: '' })}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <input
        style={{ marginTop: 10 }}
        placeholder={subjects.length ? 'or type a new subject' : 'Subject name'}
        value={newSubject}
        onChange={(e) => patchAddDraft({ newSubject: e.target.value })}
      />
    </>
  )

  if (phase === 'loading') {
    return (
      <div className="center-col">
        <div className="pulse-dot" />
        <h2 className="serif" style={{ fontSize: 24 }}>Reading your notes…</h2>
        <p className="muted">Pulling out the facts and writing cards.</p>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          This keeps going if you switch tabs — your progress is saved.
        </p>
      </div>
    )
  }

  if (phase === 'error') {
    const isLimit = error.includes('Upgrade to Pro')
    return (
      <div className="center-col">
        <h2 className="serif" style={{ fontSize: 24 }}>
          {isLimit ? 'Weekly limit reached' : 'Hmm.'}
        </h2>
        <p className="c-weak">{error}</p>
        <div className="btn-row" style={{ marginTop: 4 }}>
          {isLimit && (
            <button className="btn btn-sm" onClick={() => go('settings')}>
              See Pro
            </button>
          )}
          <button
            className={'btn btn-sm ' + (isLimit ? 'btn-ghost' : '')}
            onClick={() => patchAddDraft({ phase: 'choose', error: '' })}
          >
            {isLimit ? 'Back' : 'Try again'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'review') {
    return (
      <>
        <button className="muted" onClick={() => patchAddDraft({ phase: 'choose' })} style={{ marginBottom: 8 }}>
          <ChevronLeft size={18} />
        </button>
        <h1 className="page-title">{cards.length} cards generated</h1>
        <div className="card" style={{ marginBottom: 16 }}>
          {SubjectPicker}
        </div>

        {/* Refine the whole set with a free-text instruction before saving. */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label" style={{ marginTop: 0 }}>Adjust these cards</div>
          <textarea
            placeholder='e.g. "make them harder", "more cards on cash budgets", "shorter answers", "turn definitions into type-in"'
            value={refineText}
            onChange={(e) => patchAddDraft({ refineText: e.target.value })}
            style={{ minHeight: 64 }}
          />
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn-sm" onClick={refine} disabled={refining || !refineText.trim()}>
              {refining ? 'Adjusting…' : 'Apply'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={addPractice} disabled={practiceLoading}>
              {practiceLoading ? 'Writing…' : 'Add practice questions'}
            </button>
          </div>
        </div>

        {cards.map((c, i) => (
          <ReviewCard
            key={i}
            card={c}
            onEdit={(p) => editCard(i, p)}
            onDiscard={() => discard(i)}
          />
        ))}

        {cards.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', margin: '30px 0' }}>
            All discarded. Nothing to add.
          </p>
        )}

        <div className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={() => resetAddDraft()}>
            Discard all
          </button>
          <button className="btn" disabled={cards.length === 0} onClick={commit}>
            Add all ({cards.length})
          </button>
        </div>
        {error && <p className="c-weak" style={{ marginTop: 10 }}>{error}</p>}
      </>
    )
  }

  if (phase === 'bank') {
    const branch = questionBank.find((b) => b.id === bankBranchId) || null

    // Level 1 — choose Theory or Practice.
    if (!branch) {
      return (
        <>
          <button className="muted" onClick={() => patchAddDraft({ phase: 'choose' })} style={{ marginBottom: 8 }}>
            <ChevronLeft size={18} />
          </button>
          <h1 className="page-title">Question bank</h1>
          <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
            Ready-made questions. Start with the rules, then drill exam-style problems.
          </p>
          {questionBank.map((b) => (
            <div key={b.id} className="card" style={{ cursor: 'pointer' }} onClick={() => { setBankBranchId(b.id); setBankSubjectId(null) }}>
              <div className="row">
                <div className="stack">
                  <h2 style={{ fontSize: 22 }}>{b.name}</h2>
                  <span className="muted" style={{ fontSize: 14 }}>{b.blurb}</span>
                </div>
                <ChevronRight className="muted" />
              </div>
            </div>
          ))}
        </>
      )
    }

    const subject = branch.subjects.find((s) => s.id === bankSubjectId) || null

    // Level 2 — choose a subject within the branch.
    if (!subject) {
      return (
        <>
          <button className="muted" onClick={() => setBankBranchId(null)} style={{ marginBottom: 8 }}>
            <ChevronLeft size={18} />
          </button>
          <h1 className="page-title">{branch.name}</h1>
          {branch.subjects.map((s) => (
            <div key={s.id} className="card" style={{ cursor: 'pointer' }} onClick={() => { setBankSubjectId(s.id); setOpenTopic(null) }}>
              <div className="row">
                <div className="stack">
                  <h2 style={{ fontSize: 20 }}>{s.name}</h2>
                  <span className="muted" style={{ fontSize: 14 }}>{s.level} · {s.questions.length} questions</span>
                </div>
                <ChevronRight className="muted" />
              </div>
            </div>
          ))}
        </>
      )
    }

    // Level 3 — topics with preview + add.
    const topics = [...new Set(subject.questions.map((q) => q.topic))].map((t) => ({
      topic: t,
      questions: subject.questions.filter((q) => q.topic === t)
    }))

    return (
      <>
        <button className="muted" onClick={() => setBankSubjectId(null)} style={{ marginBottom: 8 }}>
          <ChevronLeft size={18} />
        </button>
        <h1 className="page-title">{subject.name}</h1>
        <span className="pill" style={{ marginBottom: 14, display: 'inline-block' }}>{branch.name}</span>
        <button
          className="btn"
          style={{ marginBottom: 16, marginTop: 6, display: 'block' }}
          onClick={() => loadBank(subject.questions, `${subject.name} · ${branch.name}`)}
        >
          Add all {subject.questions.length}
        </button>
        <div className="label">By topic — tap to preview</div>
        {topics.map((t) => {
          const open = openTopic === t.topic
          return (
            <div key={t.topic} className="card">
              <div className="row" style={{ cursor: 'pointer' }} onClick={() => setOpenTopic(open ? null : t.topic)}>
                <div className="stack">
                  <span style={{ fontWeight: 600 }}>{t.topic}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{t.questions.length} questions</span>
                </div>
                <span style={{ display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>
                  <ChevronRight className="muted" />
                </span>
              </div>

              {open && (
                <div className="fade-in" style={{ marginTop: 12 }}>
                  {t.questions.map((q, i) => (
                    <div key={i} style={{ padding: '10px 0', borderTop: '1px solid var(--hairline)' }}>
                      <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{q.question}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {q.format === 'typed' ? 'Type-in' : 'Flip'} · {q.topic}
                      </div>
                    </div>
                  ))}
                  <button
                    className="btn btn-sm"
                    style={{ marginTop: 12 }}
                    onClick={() => loadBank(t.questions, `${subject.name} · ${t.topic}`)}
                  >
                    Add these {t.questions.length}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </>
    )
  }

  if (phase === 'paste') {
    return (
      <>
        <input ref={pdfInput} type="file" accept="application/pdf" hidden onChange={onPdf} />
        <button className="muted" onClick={() => patchAddDraft({ phase: 'choose' })} style={{ marginBottom: 8 }}>
          <ChevronLeft size={18} />
        </button>
        <h1 className="page-title">{examMode ? 'Paste a past exam' : 'Paste your notes'}</h1>
        {examMode && (
          <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
            Paste the questions from a past paper (or upload the PDF). The AI rewrites them into
            original, style-matched practice — keeping the difficulty and mark allocations.
          </p>
        )}
        <textarea
          autoFocus
          placeholder={
            examMode
              ? 'Paste exam questions here…'
              : 'Paste notes, a passage, definitions — anything you want turned into cards.'
          }
          value={pasteText}
          onChange={(e) => patchAddDraft({ pasteText: e.target.value })}
          style={{ minHeight: 240 }}
        />
        {error && <p className="c-weak" style={{ marginTop: 8 }}>{error}</p>}
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onPaste}>
            {examMode ? 'Make practice' : 'Make cards'}
          </button>
          {examMode && (
            <button className="btn btn-ghost" onClick={() => pdfInput.current?.click()}>
              Upload exam PDF
            </button>
          )}
        </div>
      </>
    )
  }

  // choose
  return (
    <>
      <h1 className="page-title">Add to your library</h1>

      <input ref={imgInput} type="file" accept="image/*" hidden onChange={onImage} />
      <input ref={pdfInput} type="file" accept="application/pdf" hidden onChange={onPdf} />

      <div
        className="card"
        style={{ textAlign: 'center', padding: '40px 22px', cursor: 'pointer' }}
        onClick={() => imgInput.current?.click()}
      >
        <CameraIcon size={34} className="muted" />
        <h2 className="serif" style={{ fontSize: 22, marginTop: 12 }}>
          Scan handwritten notes
        </h2>
        <p className="muted" style={{ fontSize: 14 }}>
          Snap or drop a photo of a page
        </p>
      </div>

      <div className="btn-row" style={{ marginTop: 14 }}>
        <div
          className="card"
          style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}
          onClick={() => pdfInput.current?.click()}
        >
          <FileIcon size={24} className="muted" />
          <div style={{ marginTop: 8 }}>Upload PDF</div>
        </div>
        <div
          className="card"
          style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}
          onClick={() => patchAddDraft({ phase: 'paste', examMode: false })}
        >
          <PasteIcon size={24} className="muted" />
          <div style={{ marginTop: 8 }}>Paste text</div>
        </div>
      </div>

      <div
        className="card"
        style={{ marginTop: 14, cursor: 'pointer' }}
        onClick={() => { setBankBranchId(null); setBankSubjectId(null); setOpenTopic(null); patchAddDraft({ phase: 'bank', error: '' }) }}
      >
        <div className="row">
          <div className="stack">
            <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <TestIcon size={20} className="muted" />
              <h2 style={{ fontSize: 20 }}>Question bank</h2>
            </div>
            <p className="muted" style={{ fontSize: 14 }}>
              Ready-made exam-style questions by subject and topic — no upload needed
            </p>
          </div>
          <ChevronRight className="muted" />
        </div>
      </div>

      <div
        className="card drill-card"
        style={{ marginTop: 14, cursor: 'pointer' }}
        onClick={() => patchAddDraft({ phase: 'paste', examMode: true, error: '' })}
      >
        <div className="row">
          <div className="stack">
            <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <TestIcon size={20} className="c-weak" />
              <h2 style={{ fontSize: 20 }}>Past exam</h2>
            </div>
            <p className="muted" style={{ fontSize: 14 }}>
              Paste or upload a past paper — AI turns it into style-matched practice
            </p>
          </div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 13, textAlign: 'center', marginTop: 18 }}>
        Cards land in the subject you pick on the next screen.
      </p>
    </>
  )
}

function ReviewCard({
  card,
  onEdit,
  onDiscard
}: {
  card: GeneratedCard
  onEdit: (p: Partial<GeneratedCard>) => void
  onDiscard: () => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="card">
      {editing ? (
        <>
          <div className="label" style={{ marginTop: 0 }}>Question</div>
          <textarea value={card.question} onChange={(e) => onEdit({ question: e.target.value })} style={{ minHeight: 70 }} />
          <div className="label">Answer</div>
          <textarea value={card.answer} onChange={(e) => onEdit({ answer: e.target.value })} style={{ minHeight: 70 }} />
          <div className="label">Topic</div>
          <input value={card.topic} onChange={(e) => onEdit({ topic: e.target.value })} />
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-sm" onClick={() => setEditing(false)}>Done</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{card.question}</div>
          {card.format === 'mcq' && card.options ? (
            <ul className="muted" style={{ margin: '4px 0 0 18px', fontSize: 14 }}>
              {card.options.map((o) => (
                <li key={o} style={{ color: o === card.answer ? 'var(--strong)' : undefined }}>
                  {o}{o === card.answer ? '  ✓' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted">{card.answer}</div>
          )}
          <div className="divider" />
          <div className="row">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="pill">{card.topic}</span>
              {card.format === 'mcq' ? (
                <span className="pill">Multiple choice</span>
              ) : (
                <button
                  className="pill"
                  onClick={() => onEdit({ format: (card.format ?? 'flip') === 'typed' ? 'flip' : 'typed' })}
                  title="Switch how you answer this card"
                  style={{ cursor: 'pointer', border: '1px solid var(--hairline)', background: 'transparent' }}
                >
                  {(card.format ?? 'flip') === 'typed' ? 'Type-in' : 'Flip'}
                </button>
              )}
            </div>
            <div className="btn-row">
              <button className="muted" onClick={() => setEditing(true)} title="Edit">
                <EditIcon size={18} />
              </button>
              <button className="muted" onClick={onDiscard} title="Discard">
                Discard
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
