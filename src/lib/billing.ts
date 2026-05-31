import { supabase } from './supabase'

// Client-side billing. Starts a Stripe Checkout for Flashbang Pro by calling
// the `stripe-checkout` Edge Function, then opens the returned URL in the
// user's browser (Electron's main process routes window.open -> shell.openExternal).
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
  window.open(data.url, '_blank')
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
  window.open(data.url, '_blank')
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
