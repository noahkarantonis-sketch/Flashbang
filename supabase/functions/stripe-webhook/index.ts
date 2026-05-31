// ===========================================================================
// Flashbang — Stripe Webhook (Supabase Edge Function, Deno).
//
// Stripe calls this when a subscription is created, renewed, or cancelled.
// This is the ONLY thing that flips a user's plan between 'free' and 'pro'.
//
// We verify Stripe's signature manually with Web Crypto and parse the event as
// JSON — no Stripe SDK (it doesn't run in Supabase's Deno edge runtime).
//
// Secrets:
//   STRIPE_WEBHOOK_SECRET   whsec_...
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected automatically.
//
// Deploy WITHOUT JWT verification so Stripe can reach it:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// ===========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
const ACTIVE = new Set(['active', 'trialing'])
const enc = new TextEncoder()

// Verify the Stripe-Signature header against the raw body (HMAC-SHA256).
async function verifyStripeSignature(raw: string, header: string, secret: string): Promise<boolean> {
  const parts: Record<string, string> = {}
  for (const kv of header.split(',')) {
    const [k, v] = kv.split('=')
    if (k && v) parts[k.trim()] = v.trim()
  }
  const t = parts['t']
  const v1 = parts['v1']
  if (!t || !v1) return false

  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${raw}`))
  const expected = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')

  // constant-time-ish compare
  if (expected.length !== v1.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i)
  return diff === 0
}

async function setPlanByCustomer(
  customerId: string,
  fields: { plan: string; plan_status: string; stripe_subscription_id?: string; current_period_end?: string | null }
) {
  await admin.from('profiles').update(fields).eq('stripe_customer_id', customerId)
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('no signature', { status: 400 })

  const raw = await req.text()
  const ok = await verifyStripeSignature(raw, sig, WEBHOOK_SECRET)
  if (!ok) return new Response('bad signature', { status: 400 })

  let event: any
  try {
    event = JSON.parse(raw)
  } catch {
    return new Response('bad json', { status: 400 })
  }

  try {
    const obj = event?.data?.object ?? {}
    switch (event.type) {
      case 'checkout.session.completed': {
        await setPlanByCustomer(String(obj.customer), {
          plan: 'pro',
          plan_status: 'active',
          stripe_subscription_id: obj.subscription ? String(obj.subscription) : undefined
        })
        break
      }
      case 'customer.subscription.updated': {
        const active = ACTIVE.has(obj.status)
        await setPlanByCustomer(String(obj.customer), {
          plan: active ? 'pro' : 'free',
          plan_status: obj.status,
          stripe_subscription_id: obj.id,
          current_period_end: obj.current_period_end
            ? new Date(obj.current_period_end * 1000).toISOString()
            : null
        })
        break
      }
      case 'customer.subscription.deleted': {
        await setPlanByCustomer(String(obj.customer), {
          plan: 'free',
          plan_status: 'canceled',
          stripe_subscription_id: obj.id
        })
        break
      }
    }
    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('WEBHOOK handler error:', String(e))
    return new Response(`handler error: ${String(e)}`, { status: 500 })
  }
})
