import { supabase, supabaseConfigured } from './supabase'
import { useStore } from '../store'
import type { Subject, StudyDoc, Card, TestResult } from '../types'

// ---------------------------------------------------------------------------
// Cloud sync. The whole study library (subjects/docs/cards/tests + name) lives
// as ONE jsonb row per user in `study_state`. Strategy:
//   • pull on launch and whenever the app regains focus
//   • debounced push whenever synced content changes
//   • last-write-wins (solo user, one active device at a time)
// Display prefs (theme/accent/density/uiStyle/etc.) stay device-local.
// ---------------------------------------------------------------------------

const META_KEY = 'flashbang-sync-meta'

interface SyncPayload {
  subjects: Subject[]
  docs: StudyDoc[]
  cards: Card[]
  tests: TestResult[]
  userName: string
}

// What we last reconciled with the server. Keyed by user so a different
// account on the same device never pushes the previous user's library up.
interface SyncMeta {
  userId: string
  remoteUpdatedAt: string | null
}

function readMeta(): SyncMeta | null {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || 'null')
  } catch {
    return null
  }
}
function writeMeta(m: SyncMeta) {
  localStorage.setItem(META_KEY, JSON.stringify(m))
}

function snapshot(): SyncPayload {
  const s = useStore.getState()
  return { subjects: s.subjects, docs: s.docs, cards: s.cards, tests: s.tests, userName: s.userName }
}

function deviceLabel(): string {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone'
  if (/android/i.test(ua)) return 'Android'
  if (/electron/i.test(ua)) return 'Desktop app'
  if (/macintosh/i.test(ua)) return 'Mac'
  if (/windows/i.test(ua)) return 'Windows'
  return 'Browser'
}

// Module state
let applyingRemote = false // guards the change-subscription while we adopt remote
let pushTimer: ReturnType<typeof setTimeout> | null = null
let subscribed = false
let currentUserId: string | null = null
let channel: ReturnType<typeof supabase.channel> | null = null

type Remote = { data: SyncPayload; updated_at: string } | null

// Returns the row, null (no row), or undefined (network/permission error).
async function pull(userId: string): Promise<Remote | undefined> {
  const { data, error } = await supabase
    .from('study_state')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[sync] pull failed:', error.message)
    return undefined
  }
  return (data as Remote) ?? null
}

async function push(userId: string) {
  const { data, error } = await supabase
    .from('study_state')
    .upsert({
      user_id: userId,
      data: snapshot(),
      device: deviceLabel(),
      updated_at: new Date().toISOString()
    })
    .select('updated_at')
    .single()
  if (error) {
    console.error('[sync] push failed:', error.message)
    return
  }
  writeMeta({ userId, remoteUpdatedAt: data.updated_at })
}

function adopt(remote: { data: SyncPayload; updated_at: string }, userId: string) {
  applyingRemote = true
  useStore.getState().replaceData(remote.data)
  applyingRemote = false
  writeMeta({ userId, remoteUpdatedAt: remote.updated_at })
}

function clearLocal(userId: string) {
  applyingRemote = true
  useStore.getState().replaceData({ subjects: [], docs: [], cards: [], tests: [], userName: '' })
  applyingRemote = false
  writeMeta({ userId, remoteUpdatedAt: null })
}

// Live updates: while the app is open, apply changes another device pushes —
// without waiting for a focus event. Best-effort; failure leaves focus-pull as
// the reliable fallback. The echo of our own push is ignored because its
// updated_at already matches our stored meta.
function startRealtime(userId: string) {
  if (channel) return
  channel = supabase
    .channel(`study_state:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'study_state', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { data: SyncPayload; updated_at: string } | undefined
        if (!row?.updated_at || !row.data) return
        if (currentUserId !== userId) return
        const meta = readMeta()
        if (row.updated_at !== meta?.remoteUpdatedAt) adopt(row, userId)
      }
    )
    .subscribe()
}

// Push whenever synced content changes (debounced). Display prefs are ignored.
function startSubscription() {
  if (subscribed) return
  subscribed = true
  useStore.subscribe((state, prev) => {
    if (applyingRemote || !currentUserId || !supabaseConfigured) return
    if (
      state.subjects === prev.subjects &&
      state.docs === prev.docs &&
      state.cards === prev.cards &&
      state.tests === prev.tests &&
      state.userName === prev.userName
    ) {
      return
    }
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      if (currentUserId) void push(currentUserId)
    }, 1500)
  })
}

// Call once the user is signed in. Resolves after the initial reconcile so the
// UI can hold a loader until the library is correct for this account.
export async function syncOnAuth(userId: string) {
  if (!supabaseConfigured) return
  currentUserId = userId
  startSubscription()
  startRealtime(userId)

  const meta = readMeta()
  const remote = await pull(userId)
  if (remote === undefined) return // offline — keep local, retry on focus

  if (!meta) {
    // First sync ever on this device: either migrating an existing local
    // library or a fresh install. Any local data belongs to this user.
    if (remote) {
      adopt(remote, userId) // cloud already has this account's data → take it
    } else {
      await push(userId) // seed the cloud from whatever is local (don't wipe!)
    }
    return
  }

  if (meta.userId !== userId) {
    // A genuinely different account than the one last synced on this device.
    if (remote) {
      adopt(remote, userId) // pull down the new account's cloud library
    } else {
      // New account with no cloud copy, and local belongs to the previous
      // account → start clean so we never push their cards into this account.
      clearLocal(userId)
    }
    return
  }

  // Same account we last synced with.
  if (!remote) {
    await push(userId) // cloud row missing → seed it from local
  } else if (remote.updated_at !== meta.remoteUpdatedAt) {
    adopt(remote, userId) // edited on another device → take the cloud copy
  } else {
    await push(userId) // we're authoritative; flush any offline edits up
  }
}

// On regaining focus: flush our pending push, then take the cloud copy if
// another device wrote since we last synced.
export async function syncOnFocus() {
  if (!supabaseConfigured || !currentUserId) return
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
    await push(currentUserId)
  }
  const meta = readMeta()
  const remote = await pull(currentUserId)
  if (!remote) return
  if (remote.updated_at !== meta?.remoteUpdatedAt) adopt(remote, currentUserId)
}

// Send any pending change immediately (app backgrounding / unload).
export function flushPush() {
  if (pushTimer && currentUserId) {
    clearTimeout(pushTimer)
    pushTimer = null
    void push(currentUserId)
  }
}

export function stopSync() {
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  if (channel) {
    void supabase.removeChannel(channel)
    channel = null
  }
  currentUserId = null
}
