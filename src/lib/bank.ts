import type { BankBranch } from '../data/questionBank'
import { bundledBank } from '../data/questionBank'

// The live question bank is hosted alongside the landing site so questions can
// be added without shipping an app update. The app fetches it on launch, caches
// it, and falls back to the bundled copy when offline or if the fetch fails.
const REMOTE_URL = 'https://flashbang-bco.pages.dev/bank.json'
const CACHE_KEY = 'flashbang.bank.cache.v1'

function isBranches(d: unknown): d is BankBranch[] {
  return (
    Array.isArray(d) &&
    d.every(
      (b) =>
        b &&
        typeof b === 'object' &&
        typeof (b as BankBranch).id === 'string' &&
        Array.isArray((b as BankBranch).subjects)
    )
  )
}

// Accept either a raw branches array or a { branches: [...] } wrapper.
function coerce(d: unknown): BankBranch[] | null {
  if (isBranches(d)) return d
  if (d && typeof d === 'object' && isBranches((d as { branches: unknown }).branches)) {
    return (d as { branches: BankBranch[] }).branches
  }
  return null
}

// Best bank available synchronously at startup: the cached remote copy if we
// have one, otherwise the bundled fallback. Never throws.
export function getInitialBank(): BankBranch[] {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const bank = coerce(JSON.parse(cached))
      if (bank) return bank
    }
  } catch {
    /* ignore corrupt cache */
  }
  return bundledBank
}

// Pull the latest bank from the network. Caches on success. Returns null on any
// failure (offline, 404, malformed) so callers can keep the current bank.
export async function fetchRemoteBank(): Promise<BankBranch[] | null> {
  try {
    const res = await fetch(REMOTE_URL, { cache: 'no-store' })
    if (!res.ok) return null
    const bank = coerce(await res.json())
    if (!bank) return null
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(bank))
    } catch {
      /* storage full / unavailable — still return the fresh bank */
    }
    return bank
  } catch {
    return null
  }
}
