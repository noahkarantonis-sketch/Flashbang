import type { Card, Grade } from '../types'

const DAY = 24 * 60 * 60 * 1000

// SM-2, adapted to a 3-button grade (forgot / hard / easy). This is the
// spaced-repetition core — the same logic Forge's Revise tab uses.
export function applyGrade(card: Card, grade: Grade): Card {
  let { ease, intervalDays, reps } = card

  if (grade === 'forgot') {
    reps = 0
    intervalDays = 0 // see again today
    ease = Math.max(1.3, ease - 0.2)
  } else {
    const quality = grade === 'easy' ? 5 : 3
    ease = Math.max(
      1.3,
      ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    )
    reps += 1
    if (reps === 1) intervalDays = 1
    else if (reps === 2) intervalDays = grade === 'easy' ? 6 : 3
    else intervalDays = Math.round(intervalDays * ease * (grade === 'easy' ? 1.3 : 1))
  }

  const now = Date.now()
  return {
    ...card,
    ease,
    intervalDays,
    reps,
    due: now + intervalDays * DAY,
    lastSeen: now
  }
}

export function isDue(card: Card, now = Date.now()): boolean {
  return !card.suspended && card.due <= now
}

export function freshCardDefaults(): Pick<
  Card,
  'ease' | 'intervalDays' | 'reps' | 'due' | 'history' | 'suspended' | 'pinned' | 'lastSeen'
> {
  return {
    ease: 2.5,
    intervalDays: 0,
    reps: 0,
    due: Date.now(),
    history: [],
    suspended: false,
    pinned: false,
    lastSeen: null
  }
}
