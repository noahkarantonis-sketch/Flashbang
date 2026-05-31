import type { Card, TestResult } from '../types'

const DAY = 24 * 60 * 60 * 1000

// Confidence score per topic, 0-100. Blends flashcard performance, real test
// results, recency (decays if untouched) and consistency (one lucky correct is
// not confidence). Deterministic — the "AI-calculated" feel comes from it
// reacting live to every review and logged test, not from a model call.
export function topicConfidence(
  topic: string,
  cards: Card[],
  tests: TestResult[],
  now = Date.now()
): number | null {
  const topicCards = cards.filter((c) => c.topic === topic && !c.suspended)
  const topicTests = tests.filter((t) => t.topic === topic)

  if (topicCards.length === 0 && topicTests.length === 0) return null

  // --- Flashcard signal ---
  let flashScore = 50
  let flashWeight = 0
  const reviews = topicCards.flatMap((c) => c.history)
  if (reviews.length > 0) {
    // grade → points
    const pts = reviews.map((r) =>
      r.grade === 'easy' ? 100 : r.grade === 'hard' ? 60 : 10
    )
    // recency-weighted mean (recent reviews matter more)
    let num = 0
    let den = 0
    reviews.forEach((r, i) => {
      const ageDays = (now - r.at) / DAY
      const w = Math.exp(-ageDays / 21) // ~3 week half-life-ish decay
      num += pts[i] * w
      den += w
    })
    flashScore = den > 0 ? num / den : 50
    // consistency penalty: high variance lowers confidence
    const mean = pts.reduce((a, b) => a + b, 0) / pts.length
    const variance =
      pts.reduce((a, b) => a + (b - mean) ** 2, 0) / pts.length
    const consistency = Math.max(0, 1 - Math.sqrt(variance) / 100)
    flashScore = flashScore * (0.7 + 0.3 * consistency)
    flashWeight = Math.min(1, reviews.length / 8) // more reviews = more trust
  }

  // --- Real test signal (weighted higher than flashcards) ---
  let testScore = 50
  let testWeight = 0
  if (topicTests.length > 0) {
    let num = 0
    let den = 0
    topicTests.forEach((t) => {
      const ageDays = (now - t.at) / DAY
      const w = Math.exp(-ageDays / 30)
      num += t.scorePct * w
      den += w
    })
    testScore = den > 0 ? num / den : 50
    testWeight = 1
  }

  // Tests count ~2x flashcards when both exist.
  const wFlash = flashWeight
  const wTest = testWeight * 2
  const total = wFlash + wTest
  if (total === 0) return null

  let score = (flashScore * wFlash + testScore * wTest) / total

  // Global recency decay: if nothing in this topic touched recently, fade.
  const lastTouch = Math.max(
    0,
    ...topicCards.map((c) => c.lastSeen ?? 0),
    ...topicTests.map((t) => t.at)
  )
  if (lastTouch > 0) {
    const idleDays = (now - lastTouch) / DAY
    if (idleDays > 7) {
      score *= Math.max(0.6, Math.exp(-(idleDays - 7) / 60))
    }
  }

  return Math.round(Math.max(0, Math.min(100, score)))
}

export type ConfidenceBand = 'weak' | 'mid' | 'strong'

export function band(score: number): ConfidenceBand {
  if (score < 50) return 'weak'
  if (score < 75) return 'mid'
  return 'strong'
}
