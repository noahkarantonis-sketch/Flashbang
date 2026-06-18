// ===========================================================================
// Flashbang — redeem a referral code. Edge Function (Deno).
//
// Called once, right after a NEW user signs up via someone's invite link.
// Grants bonus GENERATIONS (a depleting pool, never free Pro) to both sides:
//   • the new user (welcome bonus)
//   • the referrer (reward)
// Hardened: one redemption per user, can't refer yourself, code must exist.
//
// Deploy:  supabase functions deploy redeem-referral
// ===========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Conservative on purpose — these are cheap (each generation ≈ ½¢) and the cap
// stays sacred (bonus only spends AFTER the weekly free allowance is used).
const REFERRER_REWARD = 5 // referrer gets this per friend who joins via their link
const WELCOME_BONUS = 3 // the new friend gets this for joining via a link

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // Who is redeeming? (the new user, identified by their JWT)
  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: auth } }
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'NOT_SIGNED_IN' }, 401)

  let code = ''
  try {
    code = String((await req.json())?.code ?? '').trim().toUpperCase()
  } catch {
    return json({ error: 'bad body' }, 400)
  }
  if (!code) return json({ error: 'NO_CODE' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Already referred? One bite only — never grant twice.
  const { data: me } = await admin
    .from('profiles')
    .select('referred_by, referral_code')
    .eq('id', user.id)
    .single()
  if (me?.referred_by) return json({ error: 'ALREADY_REDEEMED' }, 409)
  if (me?.referral_code === code) return json({ error: 'CANNOT_REFER_SELF' }, 400)

  // Find the referrer by their code.
  const { data: referrer } = await admin
    .from('profiles')
    .select('id, bonus_balance')
    .eq('referral_code', code)
    .single()
  if (!referrer || referrer.id === user.id) return json({ error: 'INVALID_CODE' }, 404)

  // Grant both sides. (Two small writes; fine without a transaction at this scale.)
  await admin
    .from('profiles')
    .update({ referred_by: referrer.id, bonus_balance: WELCOME_BONUS })
    .eq('id', user.id)

  await admin
    .from('profiles')
    .update({ bonus_balance: (referrer.bonus_balance ?? 0) + REFERRER_REWARD })
    .eq('id', referrer.id)

  return json({ ok: true, welcomeBonus: WELCOME_BONUS })
})
