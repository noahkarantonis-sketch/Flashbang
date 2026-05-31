import type { Card, Subject, TestResult } from '../types'
import { topicConfidence } from './confidence'

const DAY = 24 * 60 * 60 * 1000

// Live priority score per card. Higher = study sooner. This is the core
// differentiator over Anki: it weights by upcoming test dates + topic weakness
// (from real results) + card recall history, not recall alone.
//
//   Priority = recall_difficulty x forgetting_factor
//            x topic_weakness_multiplier
//            x test_urgency_multiplier
//            x subject_intensity        (manual override)
//            x pin_boost                (manual override)
//
// Deliberately simple. The spec says: ship simple, refine weights on real data.
export function cardPriority(
  card: Card,
  subject: Subject | undefined,
  cards: Card[],
  tests: TestResult[],
  now = Date.now()
): number {
  if (card.suspended) return 0

  // recall_difficulty: low ease + few reps = harder = higher
  const recallDifficulty = 1 + (2.5 - card.ease) + 1 / (card.reps + 1)

  // forgetting_factor: how overdue is it
  const overdueDays = Math.max(0, (now - card.due) / DAY)
  const forgetting = 1 + Math.min(3, overdueDays / Math.max(1, card.intervalDays || 1))

  // topic_weakness: lower confidence = higher multiplier
  const conf = topicConfidence(card.topic, cards, tests, now)
  const weakness = conf == null ? 1.4 : 1 + (100 - conf) / 100 // 1.0 .. 2.0

  // test_urgency: closer exam = higher. No exam = neutral.
  let urgency = 1
  if (subject?.examDate) {
    const daysToExam = (subject.examDate - now) / DAY
    if (daysToExam <= 0) urgency = 1 // exam passed
    else if (daysToExam <= 14) urgency = 1 + (14 - daysToExam) / 7 // up to ~3x
    else urgency = 1
  }

  const intensity = subject?.intensity ?? 1
  const pin = card.pinned ? 5 : 1

  return recallDifficulty * forgetting * weakness * urgency * intensity * pin
}

// Build the study queue: due (or pinned) cards, sorted by priority desc.
export function buildQueue(
  cards: Card[],
  subjects: Subject[],
  tests: TestResult[],
  now = Date.now()
): Card[] {
  const subjById = new Map(subjects.map((s) => [s.id, s]))
  return cards
    .filter((c) => !c.suspended && (c.pinned || c.due <= now))
    .map((c) => ({
      card: c,
      p: cardPriority(c, subjById.get(c.subjectId), cards, tests, now)
    }))
    .sort((a, b) => b.p - a.p)
    .map((x) => x.card)
}

// Subject readiness % for the Home "next exam" card: mean topic confidence
// across the subject's cards, weighted by how many cards each topic has.
export function subjectReadiness(
  subjectId: string,
  cards: Card[],
  tests: TestResult[],
  now = Date.now()
): number | null {
  const subjCards = cards.filter((c) => c.subjectId === subjectId && !c.suspended)
  if (subjCards.length === 0) return null
  const topics = [...new Set(subjCards.map((c) => c.topic))]
  let num = 0
  let den = 0
  for (const t of topics) {
    const count = subjCards.filter((c) => c.topic === t).length
    const conf = topicConfidence(t, cards, tests, now)
    num += (conf ?? 30) * count
    den += count
  }
  return den > 0 ? Math.round(num / den) : null
}
