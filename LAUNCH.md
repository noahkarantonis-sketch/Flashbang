# Launching Flashbang — selling it & making it findable

Everything in code is **done**. What's left is creating 3 free accounts and pasting
a few keys. This is the runbook. Do it top to bottom.

---

## What's already built

- ✅ Desktop app (Electron) — builds & runs.
- ✅ Distributable: `release/Flashbang-0.1.0-win.zip` (unzip → run `Flashbang.exe`).
- ✅ Landing page: `landing/index.html` (download + pricing + buy).
- ✅ Backend: Supabase auth + AI proxy (Haiku), usage limits (free 40 / pro 6000).
- ✅ Stripe subscription code: checkout + webhook + in-app "Get Pro" button.

What's left = hosting + accounts. ~30–45 min.

---

## 1. Host the download (GitHub — free)

GitHub Releases is the right home for the 124 MB installer (Vercel/Netlify reject files that big).

1. Make a free account at https://github.com.
2. Create a repo, e.g. `flashbang` (can be private — releases can still be public).
3. Releases → **Draft a new release** → tag `v0.1.0` → drag in
   `release/Flashbang-0.1.0-win.zip` → Publish.
4. Copy the asset's download URL (right-click the uploaded file → Copy link). It looks like:
   `https://github.com/<you>/flashbang/releases/download/v0.1.0/Flashbang-0.1.0-win.zip`
5. In `landing/index.html`, set BOTH download buttons' `href` to that URL
   (search for `id="download-win"` and the hero `href="#download"` button).

> Nicer option later: a proper `Setup.exe` installer. That needs Windows **Developer Mode ON**
> (Settings → System → For developers → Developer Mode) so electron-builder can create symlinks,
> then `npm run dist:win` produces `release/Flashbang Setup 0.1.0.exe`. Tell me when it's on and I'll build it.

## 2. Deploy the landing page (Vercel — free)

1. Free account at https://vercel.com (sign in with the GitHub account above).
2. Easiest: `npm i -g vercel`, then from `study-app/landing/` run `vercel` and follow prompts.
   You get a free URL like `flashbang.vercel.app`.
3. (Optional) Buy a domain (e.g. `flashbang.app`, ~$15/yr) and add it in Vercel → Domains.

## 3. Turn on payments (Stripe — free until you earn)

1. Free account at https://stripe.com (start in **Test mode** with the toggle on).
2. Products → **Add product**: name "Flashbang Pro", price **$6.00 / month recurring**.
   Copy the **Price ID** (`price_...`).
3. Developers → API keys → copy the **Secret key** (`sk_test_...`).
4. Set the Supabase secrets (run from `study-app/`, using the bundled CLI):
   ```
   .tools/supabase.exe secrets set STRIPE_SECRET_KEY=sk_test_xxx
   .tools/supabase.exe secrets set STRIPE_PRICE_ID=price_xxx
   ```
5. Deploy the two new functions:
   ```
   .tools/supabase.exe functions deploy stripe-checkout
   .tools/supabase.exe functions deploy stripe-webhook --no-verify-jwt
   ```
6. Run the billing migration: open Supabase → SQL editor → paste `supabase/schema-stripe.sql` → Run.
7. Stripe → Developers → **Webhooks** → Add endpoint:
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the signing secret (`whsec_...`) and set it:
   ```
   .tools/supabase.exe secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
8. (Optional) set the post-payment URLs:
   ```
   .tools/supabase.exe secrets set CHECKOUT_SUCCESS_URL=https://<your-site>/?paid=1
   .tools/supabase.exe secrets set CHECKOUT_CANCEL_URL=https://<your-site>/#pricing
   ```

### Test the whole flow
Use a Stripe test card `4242 4242 4242 4242` (any future expiry, any CVC). In the app:
Settings → **Get Pro** → pay → return → plan flips to Pro (webhook did it).

### Go live
In Stripe flip off Test mode, redo step 2–3 & 7 with the **live** keys/secret, update the
Supabase secrets with the `sk_live_...` / live `whsec_...`, and you're charging real money.

---

## Quick reference — files

| Piece | Path |
|---|---|
| Landing page | `landing/index.html` |
| Download zip | `release/Flashbang-0.1.0-win.zip` |
| Checkout function | `supabase/functions/stripe-checkout/index.ts` |
| Webhook function | `supabase/functions/stripe-webhook/index.ts` |
| Billing migration | `supabase/schema-stripe.sql` |
| In-app upgrade button | `src/screens/Settings.tsx` |
