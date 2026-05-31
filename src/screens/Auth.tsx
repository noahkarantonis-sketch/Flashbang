import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'

export function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    setMsg('')
    if (!email.trim() || password.length < 6) {
      setErr('Enter an email and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        setMsg('Account created. If email confirmation is on, check your inbox, then sign in.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })
        if (error) throw error
        // App.tsx listens for the session change and routes onward.
      }
    } catch (e: any) {
      setErr(e?.message || 'Could not authenticate.')
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
          <div className="label" style={{ marginTop: 0 }}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </div>
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={{ marginTop: 10 }}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {err && <p className="c-weak" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
          {msg && <p className="c-strong" style={{ fontSize: 13, marginTop: 10 }}>{msg}</p>}
          <div style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} onClick={submit}>
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>

        <button
          className="muted btn-sm"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setErr('')
            setMsg('')
          }}
        >
          {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
