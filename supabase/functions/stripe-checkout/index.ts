// ===========================================================================
// Flashbang — Stripe Checkout (Supabase Edge Function, Deno).
//
// Creates a subscription Checkout Session for the signed-in user and returns
// its URL. The app opens that URL in the browser; on success Stripe fires a
// webhook (see ../stripe-webhook) that flips the user's plan to 'pro'.
//
// NOTE: we call Stripe's REST API directly with fetch instead of the Stripe
// SDK — the SDK pulls in Node internals that Supabase's Deno edge runtime
// rejects ("Deno.core.runMicrotasks() is not supported").
//
// Secrets:
//   STRIPE_SECRET_KEY      sk_live_... / sk_test_...
//   STRIPE_PRICE_ID        price_...   (the monthly Pro price)
//   CHECKOUT_SUCCESS_URL   (optional)
//   CHECKOUT_CANCEL_URL    (optional)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected automatically.
//
// Deploy:  supabase functions deploy stripe-checkout
// ===========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const PRICE_ID = Deno.env.get('STRIPE_PRICE_ID')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUCCESS_URL = Deno.env.get('CHECKOUT_SUCCESS_URL') || 'https://flashbang-bco.pages.dev/?paid=1'
const CANCEL_URL = Deno.env.get('CHECKOUT_CANCEL_URL') || 'https://flashbang-bco.pages.dev/#pricing'

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

// Minimal Stripe REST helper (form-encoded, as Stripe expects).
async function stripe(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params).toString()
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `stripe ${res.status}`)
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'not signed in' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData?.user) return json({ error: 'invalid session' }, 401)
    const user = userData.user

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, plan')
      .eq('id', user.id)
      .single()

    if (profile?.plan === 'pro') return json({ error: 'already pro' }, 400)

    // Find or create this user's Stripe customer.
    let customerId = profile?.stripe_customer_id as string | undefined
    if (!customerId) {
      const customer = await stripe('customers', {
        email: user.email ?? '',
        'metadata[user_id]': user.id
      })
      customerId = customer.id
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    // Create the subscription Checkout Session.
    const session = await stripe('checkout/sessions', {
      mode: 'subscription',
      customer: customerId!,
      client_reference_id: user.id,
      'line_items[0][price]': PRICE_ID,
      'line_items[0][quantity]': '1',
      'subscription_data[metadata][user_id]': user.id,
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      allow_promotion_codes: 'true'
    })

    return json({ url: session.url })
  } catch (e) {
    console.error('CHECKOUT_FAILED detail:', String(e))
    return json({ error: 'CHECKOUT_FAILED', detail: String(e) }, 500)
  }
})
