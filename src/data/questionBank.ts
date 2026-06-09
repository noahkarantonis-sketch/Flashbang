import type { CardType, CardFormat } from '../types'
import bankData from './questionBank.json'

// Built-in question bank: original, style-matched practice modelled on the
// shape/difficulty of WACE-style exams (NOT verbatim copies of any paper).
// Two branches — Theory (definitions/rules/concepts) and Practice (exam-style
// questions). The data lives in questionBank.json so it can also be served as a
// remote /bank.json (see lib/bank.ts) and updated without an app release; this
// bundled copy is the offline fallback.

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

// JSON widens literal types (e.g. `type`/`format` become `string`); the file is
// authored to the BankBranch shape, so the cast is safe.
export const bundledBank = (bankData.branches as unknown) as BankBranch[]

// Back-compat alias for existing imports.
export const questionBank = bundledBank
