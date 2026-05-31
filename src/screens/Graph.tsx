import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import { useStore } from '../store'
import { topicConfidence, band } from '../lib/confidence'
import type { Tab } from '../App'

interface GNode {
  id: string
  name: string
  kind: 'subject' | 'topic' | 'card' | 'doc'
  topic?: string
  score?: number | null
  val: number
  color: string
}
interface GLink {
  source: string
  target: string
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function Graph({ go }: { go: (t: Tab, topic?: string | null) => void }) {
  const { subjects, cards, tests, theme } = useStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 700, h: 460 })
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [info, setInfo] = useState<{ topic: string; score: number | null; count: number } | null>(null)

  useEffect(() => {
    const measure = () => {
      if (wrapRef.current) {
        setDims({ w: wrapRef.current.clientWidth, h: Math.max(380, window.innerHeight - 320) })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const palette = useMemo(() => ({
    subject: cssVar('--accent') || '#7c92b8',
    weak: cssVar('--weak') || '#cf8466',
    mid: cssVar('--mid') || '#dcb368',
    strong: cssVar('--strong') || '#8bb085',
    neutral: cssVar('--ink-soft') || '#8a857b',
    doc: cssVar('--hairline') || '#34312c'
  }), [theme])

  const bg = useMemo(() => cssVar('--bg') || '#1b1a17', [theme])

  const data = useMemo(() => {
    const nodes: GNode[] = []
    const links: GLink[] = []
    const scope = selectedSubject === 'all' ? subjects : subjects.filter((s) => s.id === selectedSubject)

    const colorFor = (score: number | null) => {
      if (score == null) return palette.neutral
      const b = band(score)
      return b === 'weak' ? palette.weak : b === 'mid' ? palette.mid : palette.strong
    }

    for (const s of scope) {
      const sCards = cards.filter((c) => c.subjectId === s.id && !c.suspended)
      if (sCards.length === 0 && subjects.length > 1 && selectedSubject === 'all') continue
      nodes.push({ id: 'subj:' + s.id, name: s.name, kind: 'subject', val: 8, color: palette.subject })

      const topics = [...new Set(sCards.map((c) => c.topic))]
      for (const t of topics) {
        const tId = 'topic:' + s.id + ':' + t
        const score = topicConfidence(t, cards, tests)
        const tCards = sCards.filter((c) => c.topic === t)
        nodes.push({ id: tId, name: `${t} · ${score ?? '—'}`, kind: 'topic', topic: t, score, val: 5, color: colorFor(score) })
        links.push({ source: 'subj:' + s.id, target: tId })

        // cards
        for (const c of tCards) {
          nodes.push({ id: 'card:' + c.id, name: c.question, kind: 'card', topic: t, val: 1.5, color: colorFor(score) })
          links.push({ source: tId, target: 'card:' + c.id })
        }
      }
    }
    return { nodes, links }
  }, [subjects, cards, tests, selectedSubject, palette])

  if (cards.length === 0) {
    return (
      <div className="center-col">
        <h2 className="serif" style={{ fontSize: 26 }}>Your graph is empty</h2>
        <p className="muted">Add notes and the topics, documents and cards will connect up here.</p>
        <button className="btn btn-sm" onClick={() => go('add')}>Add notes</button>
      </div>
    )
  }

  return (
    <>
      <div className="row">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Knowledge graph</h1>
        <select
          style={{ width: 'auto' }}
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
        >
          <option value="all">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div ref={wrapRef} style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--hairline)' }}>
        <ForceGraph3D
          graphData={data}
          width={dims.w}
          height={dims.h}
          backgroundColor={bg}
          nodeColor={(n: any) => n.color}
          nodeVal={(n: any) => n.val}
          nodeLabel={(n: any) => n.name}
          nodeOpacity={0.92}
          linkColor={() => palette.doc}
          linkOpacity={0.5}
          linkWidth={0.6}
          enableNodeDrag={false}
          onNodeClick={(n: any) => {
            if (n.kind === 'topic') {
              const count = cards.filter((c) => c.topic === n.topic && !c.suspended).length
              setInfo({ topic: n.topic, score: n.score, count })
            } else if (n.kind === 'card') {
              const count = cards.filter((c) => c.topic === n.topic && !c.suspended).length
              setInfo({ topic: n.topic, score: topicConfidence(n.topic, cards, tests), count })
            }
          }}
        />
      </div>

      <p className="muted" style={{ fontSize: 13, marginTop: 12, textAlign: 'center' }}>
        Drag to rotate · scroll to zoom · tap a node to study that topic
      </p>

      {info && (
        <div className="card fade-in" style={{ marginTop: 12 }}>
          <div className="row">
            <div className="stack">
              <h2 style={{ fontSize: 20 }}>{info.topic}</h2>
              <span className="muted" style={{ fontSize: 14 }}>
                {info.score != null ? `${info.score}% confidence · ` : ''}{info.count} cards
              </span>
            </div>
            <button className="btn btn-sm" onClick={() => go('study', info.topic)}>Study</button>
          </div>
        </div>
      )}
    </>
  )
}
