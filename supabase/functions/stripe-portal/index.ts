// ===========================================================================
// Flashbang — Stripe Billing Portal (Supabase Edge Function, Deno).
//
// Returns a Stripe Customer Portal URL for the signed-in user. The app opens
// it in the browser; there the customer can cancel, change card, or view
// invoices. Stripe fires the same subscription webhooks (see ../stripe-webhook)
// when they cancel, so the plan flips back to 'free' automatically.
//
// NOTE: like stripe-checkout, we call Stripe's REST API directly with fetch —
// the Stripe SDK doesn't run in Supabase's Deno edge runtime.
//
// IMPORTANT: the Customer Portal must be activated once in the Stripe dashboard
// (Settings → Billing → Customer portal) in LIVE mode, with "Cancel
// subscriptions" enabled, or Stripe returns a configuration error.
//
// Secrets:
//   STRIPE_SECRET_KEY      sk_live_... / sk_test_...
//   PORTAL_RETURN_URL      (optional) where Stripe sends them back to
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected automatically.
//
// Deploy:  supabase functions deploy stripe-portal
// ===========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RETURN_URL = Deno.env.get('PORTAL_RETURN_URL') || 'https://flashbang-bco.pages.dev/'

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
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    const customerId = profile?.stripe_customer_id as string | undefined
    if (!customerId) return json({ error: 'no subscription found' }, 400)

    const session = await stripe('billing_portal/sessions', {
      customer: customerId,
      return_url: RETURN_URL
    })

    return json({ url: session.url })
  } catch (e) {
    console.error('PORTAL_FAILED detail:', String(e))
    return json({ error: 'PORTAL_FAILED', detail: String(e) }, 500)
  }
})
