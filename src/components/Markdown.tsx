import type { ReactNode } from 'react'

// Lightweight, dependency-free markdown renderer for AI text (explanations,
// hints, feedback). Handles **bold**, *italic*, `code`, bullet lists, headings
// and paragraphs. Renders to React nodes (no dangerouslySetInnerHTML).

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[2] !== undefined) nodes.push(<strong key={key++}>{m[2]}</strong>)
    else if (m[3] !== undefined) nodes.push(<em key={key++}>{m[3]}</em>)
    else if (m[4] !== undefined) nodes.push(<code key={key++}>{m[4]}</code>)
    last = regex.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({ text }: { text: string }) {
  const lines = (text || '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={key++}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ul>
      )
      continue
    }

    // heading -> just bold line
    if (/^\s*#{1,6}\s+/.test(line)) {
      blocks.push(
        <p key={key++} style={{ fontWeight: 700 }}>
          {renderInline(line.replace(/^\s*#{1,6}\s+/, ''))}
        </p>
      )
      i++
      continue
    }

    // blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // paragraph (gather consecutive plain lines)
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*#{1,6}\s+/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push(
      <p key={key++}>
        {para.map((p, j) => (
          <span key={j}>
            {renderInline(p)}
            {j < para.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    )
  }

  return <div className="md">{blocks}</div>
}
