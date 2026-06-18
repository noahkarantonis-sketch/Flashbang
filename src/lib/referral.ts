import { supabase } from './supabase'

// Referral loop (client side). Rewards are bonus card-generations — see the
// redeem-referral Edge Function. Share link points at the web app so a friend
// on a phone can join in one tap.

const REF_KEY = 'flashbang-pending-ref'
const WEB_BASE = 'https://flashbang-web.pages.dev'

// Capture a ?ref=CODE from the URL on launch and hold it until the user finishes
// signing up. Call once early in app startup.
export function captureRefFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code) localStorage.setItem(REF_KEY, code.trim().toUpperCase())
  } catch {
    /* no URL / blocked storage — ignore */
  }
}

// After a NEW user signs up, redeem any captured code (grants both sides bonus
// generations). No-op if there's no pending code. One-shot — the code is
// consumed regardless so a failed/own/invalid code never loops.
export async function redeemPendingRef(): Promise<void> {
  const code = localStorage.getItem(REF_KEY)
  if (!code) return
  localStorage.removeItem(REF_KEY)
  try {
    await supabase.functions.invoke('redeem-referral', { body: { code } })
  } catch {
    /* best-effort; an invalid/own code simply grants nothing */
  }
}

export interface ReferralInfo {
  code: string
  link: string
  bonus: number
}

// The user's own invite code + link + current bonus balance, for the UI.
export async function fetchReferral(): Promise<ReferralInfo | null> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return null
  const { data } = await supabase
    .from('profiles')
    .select('referral_code, bonus_balance')
    .eq('id', u.user.id)
    .single()
  if (!data?.referral_code) return null
  return {
    code: data.referral_code,
    link: `${WEB_BASE}/?ref=${data.referral_code}`,
    bonus: data.bonus_balance ?? 0
  }
}
