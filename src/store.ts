import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Card, Subject, StudyDoc, TestResult, Grade, CardType, CardFormat } from './types'
import { applyGrade, freshCardDefaults } from './lib/sm2'

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export interface GeneratedCard {
  question: string
  answer: string
  topic: string
  type: CardType
  format?: CardFormat
}

// The in-progress "Add cards" flow. Lives in the store (not Add's local state)
// so switching tabs mid-flow doesn't throw away typed text / generated cards.
// NOT persisted to disk (see partialize) — it survives tab switches but resets
// on a full app restart, so a half-finished 'loading' can never get stuck.
export type AddPhase = 'choose' | 'paste' | 'loading' | 'review' | 'error' | 'bank'
export interface AddDraft {
  phase: AddPhase
  pasteText: string
  cards: GeneratedCard[]
  docTitle: string
  docKind: StudyDoc['kind']
  subjectId: string
  newSubject: string
  refineText: string
  error: string
  examMode: boolean // import is a past exam → extract then exam-style refine
}

const emptyAddDraft: AddDraft = {
  phase: 'choose',
  pasteText: '',
  cards: [],
  docTitle: '',
  docKind: 'scan',
  subjectId: '',
  newSubject: '',
  refineText: '',
  error: '',
  examMode: false
}

interface State {
  subjects: Subject[]
  docs: StudyDoc[]
  cards: Card[]
  tests: TestResult[]
  theme: 'light' | 'dark'
  onboarded: boolean
  userName: string

  // study preferences
  sessionLimit: number // max cards per study session (0 = no limit)
  autoAdvance: boolean // auto-apply the suggested grade after a typed answer

  // customisation
  accent: string // accent palette key ('default' | 'sage' | 'terracotta' | 'plum')
  dailyGoal: number // target reviews per day (0 = off)
  defaultFormat: 'auto' | 'flip' | 'typed' // format for newly generated cards
  uiStyle: 'classic' | 'refined' // overall visual treatment; classic = original
  density: 'comfortable' | 'compact' // spacing scale

  // in-progress Add-cards flow (survives tab switches)
  addDraft: AddDraft
  patchAddDraft: (patch: Partial<AddDraft>) => void
  resetAddDraft: () => void

  // subjects
  addSubject: (name: string) => string
  renameSubject: (id: string, name: string) => void
  setExamDate: (id: string, date: number | null) => void
  setIntensity: (id: string, intensity: number) => void
  removeSubject: (id: string) => void

  // docs + cards
  commitGenerated: (
    subjectId: string,
    doc: { title: string; kind: StudyDoc['kind'] },
    cards: GeneratedCard[]
  ) => void
  gradeCard: (cardId: string, grade: Grade, usedHint: boolean) => void
  suspendCard: (cardId: string, suspended: boolean) => void
  pinCard: (cardId: string, pinned: boolean) => void
  editCard: (cardId: string, patch: Partial<Pick<Card, 'question' | 'answer' | 'topic'>>) => void
  deleteCard: (cardId: string) => void

  // tests
  addTest: (t: Omit<TestResult, 'id'>) => void
  removeTest: (id: string) => void

  // archive (suspended cards)
  restoreAllArchived: () => void
  deleteAllArchived: () => void

  // misc
  setTheme: (t: 'light' | 'dark') => void
  setOnboarded: (v: boolean) => void
  setUserName: (name: string) => void
  setSessionLimit: (n: number) => void
  setAutoAdvance: (v: boolean) => void
  setAccent: (a: string) => void
  setDailyGoal: (n: number) => void
  setDefaultFormat: (f: 'auto' | 'flip' | 'typed') => void
  setUiStyle: (s: 'classic' | 'refined') => void
  setDensity: (d: 'comfortable' | 'compact') => void
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      subjects: [],
      docs: [],
      cards: [],
      tests: [],
      theme: 'dark',
      onboarded: false,
      userName: '',
      sessionLimit: 0,
      autoAdvance: false,
      accent: 'default',
      dailyGoal: 0,
      defaultFormat: 'auto',
      uiStyle: 'refined',
      density: 'comfortable',
      addDraft: emptyAddDraft,

      addSubject: (name) => {
        const id = uid()
        set((s) => ({
          subjects: [...s.subjects, { id, name, examDate: null, intensity: 1 }]
        }))
        return id
      },
      renameSubject: (id, name) =>
        set((s) => ({
          subjects: s.subjects.map((x) => (x.id === id ? { ...x, name } : x))
        })),
      setExamDate: (id, date) =>
        set((s) => ({
          subjects: s.subjects.map((x) => (x.id === id ? { ...x, examDate: date } : x))
        })),
      setIntensity: (id, intensity) =>
        set((s) => ({
          subjects: s.subjects.map((x) => (x.id === id ? { ...x, intensity } : x))
        })),
      removeSubject: (id) =>
        set((s) => ({
          subjects: s.subjects.filter((x) => x.id !== id),
          docs: s.docs.filter((d) => d.subjectId !== id),
          cards: s.cards.filter((c) => c.subjectId !== id),
          tests: s.tests.filter((t) => t.subjectId !== id)
        })),

      commitGenerated: (subjectId, doc, generated) => {
        const docId = uid()
        const now = Date.now()
        const pref = get().defaultFormat
        const newCards: Card[] = generated.map((g) => ({
          id: uid(),
          question: g.question,
          answer: g.answer,
          topic: g.topic || 'General',
          type: g.type,
          format:
            pref === 'auto' ? (g.format === 'typed' ? 'typed' : 'flip') : pref,
          subjectId,
          docId,
          createdAt: now,
          ...freshCardDefaults()
        }))
        const newDoc: StudyDoc = {
          id: docId,
          subjectId,
          title: doc.title,
          kind: doc.kind,
          createdAt: now,
          cardCount: newCards.length
        }
        set((s) => ({
          docs: [newDoc, ...s.docs],
          cards: [...s.cards, ...newCards]
        }))
      },

      gradeCard: (cardId, grade, usedHint) =>
        set((s) => ({
          cards: s.cards.map((c) => {
            if (c.id !== cardId) return c
            const graded = applyGrade(c, grade)
            return {
              ...graded,
              pinned: false, // grading clears a manual pin
              history: [...c.history, { at: Date.now(), grade, usedHint }]
            }
          })
        })),

      suspendCard: (cardId, suspended) =>
        set((s) => ({
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, suspended } : c))
        })),
      pinCard: (cardId, pinned) =>
        set((s) => ({
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, pinned } : c))
        })),
      editCard: (cardId, patch) =>
        set((s) => ({
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c))
        })),
      deleteCard: (cardId) =>
        set((s) => ({ cards: s.cards.filter((c) => c.id !== cardId) })),

      addTest: (t) =>
        set((s) => ({ tests: [...s.tests, { ...t, id: uid() }] })),
      removeTest: (id) =>
        set((s) => ({ tests: s.tests.filter((t) => t.id !== id) })),

      restoreAllArchived: () =>
        set((s) => ({ cards: s.cards.map((c) => (c.suspended ? { ...c, suspended: false } : c)) })),
      deleteAllArchived: () =>
        set((s) => ({ cards: s.cards.filter((c) => !c.suspended) })),

      setTheme: (theme) => set({ theme }),
      setOnboarded: (onboarded) => set({ onboarded }),
      setUserName: (name) => set({ userName: name.slice(0, 16) }),
      setSessionLimit: (sessionLimit) => set({ sessionLimit }),
      setAutoAdvance: (autoAdvance) => set({ autoAdvance }),
      setAccent: (accent) => set({ accent }),
      setDailyGoal: (dailyGoal) => set({ dailyGoal }),
      setDefaultFormat: (defaultFormat) => set({ defaultFormat }),
      setUiStyle: (uiStyle) => set({ uiStyle }),
      setDensity: (density) => set({ density }),

      patchAddDraft: (patch) => set((s) => ({ addDraft: { ...s.addDraft, ...patch } })),
      resetAddDraft: () => set({ addDraft: emptyAddDraft })
    }),
    {
      name: 'study-app-store',
      // Persist everything EXCEPT the transient add-cards draft — it should
      // survive tab switches (in-memory) but not a full app restart.
      partialize: (s) => {
        const { addDraft: _addDraft, ...rest } = s
        return rest
      }
    }
  )
)
