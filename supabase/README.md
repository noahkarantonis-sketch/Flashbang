# Flashbang — backend setup

This is the "only my API" infrastructure. Your Anthropic key lives **here on the
server**, never in the app. The app signs users in and calls the `ai` Edge
Function, which holds the key, calls **Haiku only**, and enforces plan + usage
limits.

```
Flashbang app  →  Supabase Edge Function `ai` (your ANTHROPIC key)  →  Claude Haiku
                     ├─ verifies the signed-in user
                     ├─ checks plan (free / pro)
                     └─ enforces monthly usage limit
```

## One-time setup

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is fine).

2. **Database schema** — open the SQL Editor, paste in `schema.sql`, run it.
   This creates the `profiles` table (plan + usage) and the trigger that makes a
   profile row whenever someone signs up.

3. **Install the CLI** and link the project:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Set your Anthropic key as a server secret** (this is the whole point):
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-real-key
   ```

5. **Deploy the function:**
   ```bash
   supabase functions deploy ai
   ```

6. **Point the app at the project** — in the app's root `.env`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
   (Find both under Supabase → Settings → API. The anon key is *public by
   design* — safe to ship; RLS + the function protect everything.)

7. Restart the app. Sign up, and you're in.

## Make yourself Pro (skip the free limit)

```sql
update public.profiles set plan = 'pro' where email = 'you@example.com';
```

## Usage limits

Set in `functions/ai/index.ts`:

| Plan | Generations / month |
|------|--------------------|
| free | 40 |
| pro  | 6000 |

Tune these once you see real usage and real cost.

## What's left to actually charge money

The only missing server piece is **Stripe**: a checkout link + a webhook that
flips `profiles.plan` to `'pro'` on payment and back to `'free'` on
cancellation. Everything else (auth, the gate, usage tracking, the proxy) is
already here.
