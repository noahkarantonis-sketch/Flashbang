import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { redeemPendingRef } from '../lib/referral'
import { Logo } from '../components/Logo'

export function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Single smart flow — no separate "create account" button. We try to sign in
  // first; only if that fails AND the email is genuinely new do we create the
  // account. This makes it impossible to accidentally make a second account
  // with an email you already use (the cause of the duplicate-account mess).
  async function submit() {
    setErr('')
    if (!email.trim() || password.length < 6) {
      setErr('Enter your email and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      const creds = { email: email.trim(), password }

      // 1. Try to sign in to an existing account.
      const { error: signInErr } = await supabase.auth.signInWithPassword(creds)
      if (!signInErr) return // App.tsx picks up the session and routes onward.

      // 2. Sign-in failed — either the email is new, or the password is wrong.
      //    Attempt to create the account. Supabase only creates one if the email
      //    is genuinely unused; an existing email either errors or returns no
      //    session — in both cases we treat it as "wrong password", never a dup.
      const { data, error: signUpErr } = await supabase.auth.signUp(creds)

      if (signUpErr) {
        if (/already|registered|exists/i.test(signUpErr.message)) {
          setErr('That email already has an account — check your password and try again.')
        } else {
          setErr(signUpErr.message)
        }
        return
      }
      if (!data.session) {
        // No session back = the email already exists (Supabase won't sign you in
        // on a duplicate signup). Don't create a second account.
        setErr('That email already has an account — check your password and try again.')
        return
      }
      // New account created and signed in — redeem an invite code if they came
      // via a referral link (grants both sides bonus generations). App routes on.
      await redeemPendingRef()
    } catch (e: any) {
      setErr(e?.message || 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen-inner center-col fade-in" style={{ maxWidth: 440 }}>
        <Logo size={72} />
        <h1 className="greeting" style={{ marginTop: 4 }}>Flashbang</h1>
        <p className="muted" style={{ marginTop: -6 }}>
          Scan your notes. Study what you're weakest at, first.
        </p>

        <div className="card" style={{ width: '100%', textAlign: 'left', marginTop: 18 }}>
          <div className="label" style={{ marginTop: 0 }}>Sign in or create your account</div>
          <input
            type="email"
            placeholder="you@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={{ marginTop: 10 }}
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {err && <p className="c-weak" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
          <div style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} onClick={submit}>
              {busy ? 'Working…' : 'Continue'}
            </button>
          </div>
        </div>

        <p className="muted btn-sm" style={{ marginTop: 12, textAlign: 'center' }}>
          New here? Just enter an email and password — we'll set you up.
          <br />Already have an account? Same box — we'll sign you in.
        </p>
      </div>
    </div>
  )
}
