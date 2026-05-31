import { useRef, useState } from 'react'
import { useStore, type GeneratedCard } from '../store'
import type { StudyDoc } from '../types'
import { ai, aiErrorMessage } from '../lib/ai'
import { CameraIcon, FileIcon, PasteIcon, ChevronLeft, EditIcon } from '../components/Icons'
import type { Tab } from '../App'

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
  // The draft lives in the store so switching tabs mid-flow doesn't lose it.
  const { phase, pasteText, cards, docTitle, docKind, newSubject, refineText, error } = addDraft
  const subjectId = addDraft.subjectId || subjects[0]?.id || ''
  const [refining, setRefining] = useState(false)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const imgInput = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)

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

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await fileToBase64(file)
    run(() => ai.cardsFromImage(b64, file.type), file.name, 'scan')
  }

  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await fileToBase64(file)
    run(() => ai.cardsFromPdf(b64), file.name, 'upload')
  }

  function onPaste() {
    if (pasteText.trim().length < 20) {
      patchAddDraft({ error: 'Add a bit more text to make good cards.' })
      return
    }
    const snippet = pasteText.trim().slice(0, 40)
    run(() => ai.cardsFromText(pasteText.trim()), snippet + '…', 'paste')
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

  if (phase === 'paste') {
    return (
      <>
        <button className="muted" onClick={() => patchAddDraft({ phase: 'choose' })} style={{ marginBottom: 8 }}>
          <ChevronLeft size={18} />
        </button>
        <h1 className="page-title">Paste your notes</h1>
        <textarea
          autoFocus
          placeholder="Paste notes, a passage, definitions — anything you want turned into cards."
          value={pasteText}
          onChange={(e) => patchAddDraft({ pasteText: e.target.value })}
          style={{ minHeight: 240 }}
        />
        {error && <p className="c-weak" style={{ marginTop: 8 }}>{error}</p>}
        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={onPaste}>
            Make cards
          </button>
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
          onClick={() => patchAddDraft({ phase: 'paste' })}
        >
          <PasteIcon size={24} className="muted" />
          <div style={{ marginTop: 8 }}>Paste text</div>
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
          <div className="muted">{card.answer}</div>
          <div className="divider" />
          <div className="row">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="pill">{card.topic}</span>
              <button
                className="pill"
                onClick={() => onEdit({ format: (card.format ?? 'flip') === 'typed' ? 'flip' : 'typed' })}
                title="Switch how you answer this card"
                style={{ cursor: 'pointer', border: '1px solid var(--hairline)', background: 'transparent' }}
              >
                {(card.format ?? 'flip') === 'typed' ? 'Type-in' : 'Flip'}
              </button>
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
