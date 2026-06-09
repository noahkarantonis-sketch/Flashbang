import { useMemo } from 'react'
import { useStore } from '../store'
import { subjectReadiness } from '../lib/priority'
import { bandClass, barClass } from '../lib/ui'
import { ChevronLeft } from '../components/Icons'
import type { Go } from '../App'

const DAY = 24 * 60 * 60 * 1000

export function Stats({ go }: { go: Go }) {
  const { subjects, cards, tests } = useStore()

  const data = useMemo(() => {
    const now = Date.now()
    const allReviews = cards.flatMap((c) => c.history)

    // Reviews per day for the last 14 days.
    const days: { label: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * DAY)
      const key = d.toDateString()
      days.push({
        label: d.toLocaleDateString('en-AU', { weekday: 'narrow' }),
        count: allReviews.filter((r) => new Date(r.at).toDateString() === key).length
      })
    }
    const maxDay = Math.max(1, ...days.map((d) => d.count))

    // Streak (consecutive days ending today/yesterday with >=1 review).
    const reviewDays = new Set(allReviews.map((r) => new Date(r.at).toDateString()))
    let streak = 0
    const cur = new Date()
    if (!reviewDays.has(cur.toDateString())) cur.setDate(cur.getDate() - 1)
    while (reviewDays.has(cur.toDateString())) {
      streak++
      cur.setDate(cur.getDate() - 1)
    }

    // Retention: last 50 reviews, % not "forgot".
    const recent = [...allReviews].sort((a, b) => b.at - a.at).slice(0, 50)
    const retention = recent.length
      ? Math.round((recent.filter((r) => r.grade !== 'forgot').length / recent.length) * 100)
      : null

    // Confidence by subject.
    const bySubject = subjects
      .map((s) => ({
        name: s.name,
        score: subjectReadiness(s.id, cards, tests, now),
        cards: cards.filter((c) => c.subjectId === s.id && !c.suspended).length
      }))
      .filter((s) => s.cards > 0)
      .sort((a, b) => (a.score ?? 100) - (b.score ?? 100))

    return {
      days,
      maxDay,
      streak,
      retention,
      bySubject,
      totalCards: cards.filter((c) => !c.suspended).length,
      totalReviews: allReviews.length
    }
  }, [subjects, cards, tests])

  if (data.totalReviews === 0) {
    return (
      <div className="fade-in">
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="muted" onClick={() => go('home')}><ChevronLeft size={18} /></button>
          <span className="pill">Insights</span>
          <span />
        </div>
        <div className="center-col" style={{ minHeight: '50vh' }}>
          <h2 className="serif" style={{ fontSize: 24 }}>No data yet</h2>
          <p className="muted">Study a few cards and your trends show up here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="muted" onClick={() => go('home')}><ChevronLeft size={18} /></button>
        <span className="pill">Insights</span>
        <span />
      </div>

      <h1 className="page-title">Your trends</h1>

      {/* headline tiles */}
      <div className="row" style={{ gap: 12 }}>
        <Tile n={data.totalReviews} label="Reviews" />
        <Tile n={data.streak} label="Day streak" />
        <Tile n={data.retention != null ? `${data.retention}%` : '—'} label="Retention" />
      </div>

      {/* reviews per day */}
      <div className="label">Last 14 days</div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
          {data.days.map((d, i) => (
            <div key={i} className="stack" style={{ flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <div
                title={`${d.count} reviews`}
                style={{
                  width: '100%',
                  height: `${(d.count / data.maxDay) * 100}%`,
                  minHeight: d.count > 0 ? 4 : 0,
                  background: 'var(--accent)',
                  borderRadius: 4,
                  transition: 'height 0.3s ease'
                }}
              />
              <span className="muted" style={{ fontSize: 10 }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* confidence by subject */}
      {data.bySubject.length > 0 && (
        <>
          <div className="label">Confidence by subject</div>
          <div className="card">
            {data.bySubject.map((s, i) => (
              <div key={s.name} style={{ marginTop: i === 0 ? 0 : 16 }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span>{s.name}</span>
                  <span className={s.score != null ? bandClass(s.score) : 'muted'} style={{ fontWeight: 600 }}>
                    {s.score != null ? `${s.score}%` : '—'}
                  </span>
                </div>
                <div className="bar">
                  {s.score != null && (
                    <span className={barClass(s.score)} style={{ width: `${s.score}%` }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
        {data.totalCards} active cards across {data.bySubject.length} subject
        {data.bySubject.length === 1 ? '' : 's'}.
      </p>
    </div>
  )
}

function Tile({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="card" style={{ flex: 1, textAlign: 'center', padding: '18px 8px' }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{n}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{label}</div>
    </div>
  )
}
