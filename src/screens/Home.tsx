import { useMemo } from 'react'
import { useStore } from '../store'
import { buildQueue, subjectReadiness } from '../lib/priority'
import { topicConfidence } from '../lib/confidence'
import { bandClass, barClass, daysUntil, formatExamDate } from '../lib/ui'
import { ChevronRight, SettingsIcon } from '../components/Icons'
import type { Tab } from '../App'

// Time-bucketed greetings. {name} is filled in; if there's no name we fall
// back to the plain "Good morning/afternoon/evening." line per bucket.
const GREETINGS: Record<string, string[]> = {
  early: [
    'Back on the grind, {name}?',
    'Up early, {name}. Respect.',
    'First one in the library, {name}?',
    'No days off, {name}?',
    'Good morning, {name}.',
    'Welcome back, {name}.'
  ],
  morning: [
    "Let's get it, {name}.",
    'Lock in, {name}.',
    'Make it count, {name}.',
    'Books open, {name}.',
    'Good morning, {name}.',
    'Welcome back, {name}.'
  ],
  afternoon: [
    'Round two, {name}?',
    "Don't fade now, {name}.",
    'Push through, {name}.',
    'Afternoon slump? Not today, {name}.',
    'Good afternoon, {name}.',
    'Welcome back, {name}.'
  ],
  evening: [
    'Evening reps, {name}.',
    'One more session, {name}?',
    'Finish strong, {name}.',
    'Closing out the day, {name}?',
    'Good evening, {name}.',
    'Welcome back, {name}.'
  ],
  late: [
    'Midnight oil, {name}?',
    'Should you be up, {name}?',
    'Bed after this one, {name}.',
    'Good evening, {name}.',
    'Welcome back, {name}.'
  ]
}

function bucketFor(hour: number) {
  if (hour < 8) return 'early'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 22) return 'evening'
  return 'late'
}

function pickGreeting(rawName: string) {
  const name = rawName.trim()
  const bucket = bucketFor(new Date().getHours())
  const list = GREETINGS[bucket]
  const template = list[Math.floor(Math.random() * list.length)]
  if (name) return template.replace('{name}', name)
  // No name: drop the ", {name}" / " {name}" tail and tidy punctuation.
  return template
    .replace(/,?\s*\{name\}/g, '')
    .replace(/\s+([?.!])/g, '$1')
}

export function Home({ go }: { go: (t: Tab, topic?: string | null) => void }) {
  const { subjects, cards, tests, userName } = useStore()

  const data = useMemo(() => {
    const now = Date.now()
    const queue = buildQueue(cards, subjects, tests, now)

    // Next exam: soonest future date.
    const upcoming = subjects
      .filter((s) => s.examDate && s.examDate > now)
      .sort((a, b) => a.examDate! - b.examDate!)
    const nextExam = upcoming[0] ?? null
    const readiness = nextExam
      ? subjectReadiness(nextExam.id, cards, tests, now)
      : null

    // Confidence per topic for the next-exam subject (or all subjects).
    const scopeId = nextExam?.id ?? null
    const scopeCards = scopeId
      ? cards.filter((c) => c.subjectId === scopeId)
      : cards
    const topics = [...new Set(scopeCards.filter((c) => !c.suspended).map((c) => c.topic))]
    const topicScores = topics
      .map((t) => ({ topic: t, score: topicConfidence(t, cards, tests, now) }))
      .filter((x) => x.score != null)
      .sort((a, b) => (a.score! - b.score!)) as { topic: string; score: number }[]

    // Weak cards in queue (topic confidence < 50).
    const weakInQueue = queue.filter((c) => {
      const s = topicConfidence(c.topic, cards, tests, now)
      return s != null && s < 50
    }).length

    // Today's focus: lowest-confidence topic that has cards due.
    const dueTopics = new Set(queue.map((c) => c.topic))
    const focus =
      topicScores.find((t) => dueTopics.has(t.topic)) ??
      topicScores[0] ??
      null
    const focusDue = focus
      ? queue.filter((c) => c.topic === focus.topic).length
      : 0

    // Streak: consecutive days (ending today/yesterday) with >=1 review.
    const reviewDays = new Set(
      cards.flatMap((c) =>
        c.history.map((h) => new Date(h.at).toDateString())
      )
    )
    let streak = 0
    const d = new Date()
    if (!reviewDays.has(d.toDateString())) d.setDate(d.getDate() - 1)
    while (reviewDays.has(d.toDateString())) {
      streak++
      d.setDate(d.getDate() - 1)
    }

    // Retention: last 50 reviews, % not "forgot".
    const recent = cards
      .flatMap((c) => c.history)
      .sort((a, b) => b.at - a.at)
      .slice(0, 50)
    const retention =
      recent.length > 0
        ? Math.round(
            (recent.filter((r) => r.grade !== 'forgot').length / recent.length) *
              100
          )
        : null

    return {
      queue,
      nextExam,
      readiness,
      topicScores,
      weakInQueue,
      focus,
      focusDue,
      streak,
      retention
    }
  }, [subjects, cards, tests])

  // Pick once per mount so it doesn't reshuffle on every re-render.
  const greeting = useMemo(() => pickGreeting(userName), [userName])

  return (
    <>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <h1 className="greeting">{greeting}</h1>
        <button
          className="muted"
          onClick={() => go('settings')}
          style={{ padding: 6 }}
          title="Settings"
        >
          <SettingsIcon size={22} />
        </button>
      </div>

      {data.nextExam && (
        <>
          <div className="label">Next exam</div>
          <div className="card">
            <h2 style={{ fontSize: 26 }}>{data.nextExam.name}</h2>
            <div className="muted" style={{ marginBottom: 4 }}>
              {formatExamDate(data.nextExam.examDate!)}
            </div>
            <div className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
              {Math.max(0, daysUntil(data.nextExam.examDate!))} days away
            </div>
            {data.readiness != null && (
              <>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="label" style={{ margin: 0 }}>
                    Readiness
                  </span>
                  <span className={bandClass(data.readiness)} style={{ fontWeight: 600 }}>
                    {data.readiness}%
                  </span>
                </div>
                <div className="bar">
                  <span
                    className={barClass(data.readiness)}
                    style={{ width: `${data.readiness}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="label">Review queue</div>
      <div className="card">
        {data.queue.length > 0 ? (
          <>
            <h2 style={{ fontSize: 24 }}>{data.queue.length} cards due</h2>
            {data.weakInQueue > 0 && (
              <div className="c-weak" style={{ fontSize: 14, marginBottom: 16 }}>
                {data.weakInQueue} in your weaker topics
              </div>
            )}
            <button className="btn" onClick={() => go('study')}>
              Start session
            </button>
          </>
        ) : (
          <div className="stack">
            <h2 style={{ fontSize: 22 }}>You're all caught up</h2>
            <span className="muted" style={{ fontSize: 14 }}>
              Nothing due right now. Scan some notes to make more cards.
            </span>
          </div>
        )}
      </div>

      {data.focus && (
        <>
          <div className="label">Today's focus</div>
          <div
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => go('study', data.focus!.topic)}
          >
            <div className="row">
              <div className="stack">
                <h2 style={{ fontSize: 22 }}>{data.focus.topic}</h2>
                <span className="muted" style={{ fontSize: 14 }}>
                  Lowest confidence ({data.focus.score}%)
                  {data.focusDue > 0 ? ` — ${data.focusDue} cards ready` : ''}
                </span>
              </div>
              <ChevronRight className="muted" />
            </div>
          </div>
        </>
      )}

      {data.topicScores.length > 0 && (
        <>
          <div className="label">Confidence by topic</div>
          <div className="card">
            {data.topicScores.slice(0, 6).map((t, i) => (
              <div key={t.topic} style={{ marginTop: i === 0 ? 0 : 16 }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span>{t.topic}</span>
                  <span className={bandClass(t.score)} style={{ fontWeight: 600 }}>
                    {t.score}
                  </span>
                </div>
                <div className="bar">
                  <span
                    className={barClass(t.score)}
                    style={{ width: `${t.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {(data.streak > 0 || data.retention != null) && (
        <div className="row" style={{ marginTop: 28, justifyContent: 'center', gap: 32 }}>
          {data.streak > 0 && (
            <span className="muted">
              <strong style={{ color: 'var(--ink)' }}>{data.streak}-day</strong> streak
            </span>
          )}
          {data.retention != null && (
            <span className="muted">
              <strong style={{ color: 'var(--ink)' }}>{data.retention}%</strong> retention
            </span>
          )}
        </div>
      )}
    </>
  )
}
