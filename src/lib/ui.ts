import type { ConfidenceBand } from './confidence'
import { band } from './confidence'

export function bandClass(score: number): string {
  return 'c-' + band(score)
}
export function barClass(score: number): string {
  return 'bar-' + band(score)
}
export function bandLabel(b: ConfidenceBand): string {
  return b === 'weak' ? 'terracotta' : b === 'mid' ? 'amber' : 'sage'
}

const DAY = 24 * 60 * 60 * 1000

export function daysUntil(ts: number): number {
  return Math.ceil((ts - Date.now()) / DAY)
}

export function formatExamDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
}

export function toDateInput(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export function fromDateInput(v: string): number | null {
  if (!v) return null
  const d = new Date(v + 'T09:00:00')
  return isNaN(d.getTime()) ? null : d.getTime()
}
