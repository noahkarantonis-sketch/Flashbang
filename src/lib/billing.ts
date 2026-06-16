import { supabase } from './supabase'

// Open a Stripe URL. In Electron, window.open is routed to the external browser.
// In a real browser (esp. mobile), window.open AFTER an await is blocked as a
// popup — so navigate the current tab instead (Stripe redirects back after).
function openCheckoutUrl(url: string) {
  if (/electron/i.test(navigator.userAgent)) window.open(url, '_blank')
  else window.location.assign(url)
}

// Client-side billing. Starts a Stripe Checkout for Flashbang Pro by calling
// the `stripe-checkout` Edge Function, then opens the returned URL.
export async function startProCheckout(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: {} })
  if (error) {
    try {
      const ctx = await (error as any).context?.json?.()
      if (ctx?.error) throw new Error(ctx.detail ? `${ctx.error} — ${ctx.detail}` : ctx.error)
    } catch (inner: any) {
      if (inner?.message) throw inner
    }
    throw new Error('CHECKOUT_FAILED')
  }
  if (data?.error) throw new Error(data.error)
  if (!data?.url) throw new Error('No checkout URL returned')
  openCheckoutUrl(data.url)
}

// Opens the Stripe Customer Portal so a Pro user can cancel, change card, or
// view invoices. Routes through the `stripe-portal` Edge Function.
export async function openBillingPortal(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('stripe-portal', { body: {} })
  if (error) {
    try {
      const ctx = await (error as any).context?.json?.()
      if (ctx?.error) throw new Error(ctx.detail ? `${ctx.error} — ${ctx.detail}` : ctx.error)
    } catch (inner: any) {
      if (inner?.message) throw inner
    }
    throw new Error('PORTAL_FAILED')
  }
  if (data?.error) throw new Error(data.error)
  if (!data?.url) throw new Error('No portal URL returned')
  openCheckoutUrl(data.url)
}

// Re-read the user's current plan (call after returning from checkout).
export async function fetchPlan(): Promise<string> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return 'free'
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', u.user.id)
    .single()
  return data?.plan ?? 'free'
}
