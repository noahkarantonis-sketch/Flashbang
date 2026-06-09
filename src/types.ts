export type CardType =
  | 'definition'
  | 'cause-effect'
  | 'formula'
  | 'application'
  | 'concept'

// How the student answers a card.
//   'flip'  — reveal the answer and self-grade (the original behaviour)
//   'typed' — type an answer, the AI grades it for meaning
export type CardFormat = 'flip' | 'typed'

export type Grade = 'forgot' | 'hard' | 'easy'

export interface ReviewEvent {
  at: number // epoch ms
  grade: Grade
  usedHint: boolean
}

export interface Card {
  id: string
  question: string
  answer: string
  topic: string
  type: CardType
  format?: CardFormat // undefined = 'flip' (back-compat with older cards)
  subjectId: string
  docId: string | null

  // SM-2 state
  ease: number // ease factor, starts 2.5
  intervalDays: number // current interval
  reps: number // successful reps in a row
  due: number // epoch ms when next due

  // history + control
  history: ReviewEvent[]
  suspended: boolean // discarded from rotation
  pinned: boolean // forced to top
  createdAt: number
  lastSeen: number | null
}

export interface TestResult {
  id: string
  subjectId: string
  topic: string // matches card topic, or "" for whole-subject
  scorePct: number // 0-100
  at: number
  label: string // e.g. "Test 2"
}

export interface Subject {
  id: string
  name: string
  examDate: number | null // epoch ms
  intensity: number // per-subject study weight, 0.5 - 2, default 1
}

export interface StudyDoc {
  id: string
  subjectId: string
  title: string
  kind: 'scan' | 'upload' | 'paste' | 'exam' | 'bank'
  createdAt: number
  cardCount: number
}
