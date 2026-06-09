import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { startProCheckout, openBillingPortal, fetchPlan } from '../lib/billing'
import { DISPLAY_VERSION } from '../lib/version'

const SUPPORT_PHONE = '+61491111623'
const SUPPORT_PHONE_DISPLAY = '+61 491 111 623'
import { SunIcon, MoonIcon, SuspendIcon } from '../components/Icons'

// Flip to true once live Stripe is approved to re-enable real checkout.
const PRO_LIVE = true

// Accent swatches mirror the palettes defined in styles.css.
const ACCENTS = [
  { key: 'default', label: 'Ink blue', swatch: '#3a4d70' },
  { key: 'sage', label: 'Sage', swatch: '#6f9165' },
  { key: 'terracotta', label: 'Terracotta', swatch: '#c1735a' },
  { key: 'plum', label: 'Plum', swatch: '#7d5a80' }
]

const GOAL_OPTIONS = [
  { v: 0, label: 'Off' },
  { v: 15, label: '15' },
  { v: 30, label: '30' },
  { v: 50, label: '50' }
]

export function Settings() {
  const {
    theme, setTheme,
    userName, setUserName,
    sessionLimit, setSessionLimit,
    autoAdvance, setAutoAdvance,
    accent, setAccent,
    dailyGoal, setDailyGoal,
    defaultFormat, setDefaultFormat,
    density, setDensity,
    cards, suspendCard, deleteCard, restoreAllArchived, deleteAllArchived
  } = useStore()

  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState<string | null>(null)
  const [usage, setUsage] = useState<{ count: number; period: string } | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [managing, setManaging] = useState(false)
  const [billingError, setBillingError] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  const archived = cards.filter((c) => c.suspended)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
      if (data.user) {
        supabase
          .from('profiles')
          .select('plan, usage_count, usage_period')
          .eq('id', data.user.id)
          .single()
          .then(({ data: p }) => {
            if (p) {
              setPlan(p.plan)
              setUsage({ count: p.usage_count ?? 0, period: p.usage_period ?? '' })
            }
          })
      }
    })
  }, [])

  async function handleUpgrade() {
    setBillingError('')
    setUpgrading(true)
    try {
      await startProCheckout()
      setTimeout(() => fetchPlan().then(setPlan), 1500)
    } catch (e: any) {
      const msg = e?.message || 'unknown error'
      setBillingError(msg === 'already pro' ? '' : `Couldn't start checkout: ${msg}`)
    } finally {
      setUpgrading(false)
    }
  }

  async function handleManage() {
    setBillingError('')
    setManaging(true)
    try {
      await openBillingPortal()
    } catch (e: any) {
      setBillingError(`Couldn't open the billing portal: ${e?.message || 'unknown error'}`)
    } finally {
      setManaging(false)
    }
  }

  const limitOptions = [
    { v: 0, label: 'All due' },
    { v: 10, label: '10' },
    { v: 20, label: '20' },
    { v: 30, label: '30' },
    { v: 50, label: '50' }
  ]

  return (
    <>
      <h1 className="page-title">Settings</h1>

      {/* ---------- Your name ---------- */}
      <div className="label">Your name</div>
      <div className="card">
        <div className="row">
          <div className="stack">
            <span>What we call you</span>
            <span className="muted" style={{ fontSize: 13 }}>
              Used in your greeting on the home screen.
            </span>
          </div>
          <input
            placeholder="Your name"
            maxLength={16}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            style={{ width: 'auto', minWidth: 160 }}
          />
        </div>
      </div>

      {/* ---------- Appearance ---------- */}
      <div className="label">Appearance</div>
      <div className="card">
        <div className="row">
          <span>Theme</span>
          <div className="btn-row">
            <button
              className={'btn btn-sm ' + (theme === 'light' ? '' : 'btn-ghost')}
              onClick={() => setTheme('light')}
            >
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <SunIcon size={16} /> Day
              </span>
            </button>
            <button
              className={'btn btn-sm ' + (theme === 'dark' ? '' : 'btn-ghost')}
              onClick={() => setTheme('dark')}
            >
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <MoonIcon size={16} /> Night
              </span>
            </button>
          </div>
        </div>

        <div className="divider" />

        <div className="row">
          <div className="stack">
            <span>Accent colour</span>
            <span className="muted" style={{ fontSize: 13 }}>
              The single accent used across the app.
            </span>
          </div>
          <div className="btn-row">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                onClick={() => setAccent(a.key)}
                title={a.label}
                aria-label={a.label}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: a.swatch,
                  cursor: 'pointer',
                  border: accent === a.key ? '2px solid var(--ink)' : '2px solid var(--hairline)',
                  outline: 'none'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Interface ---------- */}
      <div className="label">Interface</div>
      <div className="card">
        <div className="row">
          <div className="stack">
            <span>Density</span>
            <span className="muted" style={{ fontSize: 13 }}>
              Comfortable gives more breathing room; compact fits more on screen.
            </span>
          </div>
          <div className="btn-row">
            <button
              className={'btn btn-sm ' + (density === 'comfortable' ? '' : 'btn-ghost')}
              onClick={() => setDensity('comfortable')}
            >Comfortable</button>
            <button
              className={'btn btn-sm ' + (density === 'compact' ? '' : 'btn-ghost')}
              onClick={() => setDensity('compact')}
            >Compact</button>
          </div>
        </div>
      </div>

      {/* ---------- Studying ---------- */}
      <div className="label">Studying</div>
      <div className="card">
        <div className="row">
          <div className="stack">
            <span>Cards per session</span>
            <span className="muted" style={{ fontSize: 13 }}>
              How many cards a study session serves before it wraps up.
            </span>
          </div>
          <select
            value={sessionLimit}
            onChange={(e) => setSessionLimit(Number(e.target.value))}
            style={{ width: 'auto', minWidth: 110 }}
          >
            {limitOptions.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="divider" />

        <div className="row">
          <div className="stack">
            <span>Daily review goal</span>
            <span className="muted" style={{ fontSize: 13 }}>
              Shows a progress ring on Home. Builds the daily habit.
            </span>
          </div>
          <select
            value={dailyGoal}
            onChange={(e) => setDailyGoal(Number(e.target.value))}
            style={{ width: 'auto', minWidth: 110 }}
          >
            {GOAL_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="divider" />

        <div className="row">
          <div className="stack">
            <span>New card format</span>
            <span className="muted" style={{ fontSize: 13 }}>
              How freshly generated cards behave — let the AI choose, or force one.
            </span>
          </div>
          <div className="btn-row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {([
              ['auto', 'Auto'],
              ['flip', 'Flip'],
              ['typed', 'Type-in'],
              ['mcq', 'Multiple choice']
            ] as const).map(([f, label]) => (
              <button
                key={f}
                className={'btn btn-sm ' + (defaultFormat === f ? '' : 'btn-ghost')}
                onClick={() => setDefaultFormat(f)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="divider" />

        <div className="row">
          <div className="stack">
            <span>Auto-grade typed answers</span>
            <span className="muted" style={{ fontSize: 13 }}>
              Skip the self-rating step — accept the AI's grade and move on with one tap. Feedback still shows.
            </span>
          </div>
          <div className="btn-row">
            <button
              className={'btn btn-sm ' + (autoAdvance ? '' : 'btn-ghost')}
              onClick={() => setAutoAdvance(true)}
            >On</button>
            <button
              className={'btn btn-sm ' + (!autoAdvance ? '' : 'btn-ghost')}
              onClick={() => setAutoAdvance(false)}
            >Off</button>
          </div>
        </div>
      </div>

      {/* ---------- Account ---------- */}
      <div className="label">Account</div>
      <div className="card">
        <div className="row">
          <div className="stack">
            <span>{email || 'Signed in'}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              Plan: {plan === null ? '…' : plan === 'pro' ? 'Pro' : 'Free'}
              {usage ? ` · ${usage.count} generated this week` : ''}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>

      {plan && plan !== 'pro' && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row">
            <div className="stack">
              <span>Upgrade to Pro</span>
              <span className="muted" style={{ fontSize: 13 }}>
                250 generations a week · $6/mo · cancel anytime
              </span>
            </div>
            {PRO_LIVE ? (
              <button className="btn btn-sm" onClick={handleUpgrade} disabled={upgrading}>
                {upgrading ? 'Opening…' : 'Get Pro'}
              </button>
            ) : (
              <span className="pill" style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>
                Coming soon
              </span>
            )}
          </div>
          {billingError && (
            <div className="muted" style={{ fontSize: 12, color: 'var(--weak)', marginTop: 8 }}>
              {billingError}
            </div>
          )}
        </div>
      )}

      {plan === 'pro' && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row">
            <div className="stack">
              <span>Manage subscription</span>
              <span className="muted" style={{ fontSize: 13 }}>
                Cancel, update your card, or view invoices.
              </span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleManage} disabled={managing}>
              {managing ? 'Opening…' : 'Manage'}
            </button>
          </div>
          {billingError && (
            <div className="muted" style={{ fontSize: 12, color: 'var(--weak)', marginTop: 8 }}>
              {billingError}
            </div>
          )}
        </div>
      )}

      {/* ---------- Help ---------- */}
      <div className="label">Help</div>
      <div className="card">
        <div className="row">
          <div className="stack">
            <span>Need a hand?</span>
            <span className="muted" style={{ fontSize: 13 }}>
              Text us and we'll get back to you — {SUPPORT_PHONE_DISPLAY}
            </span>
          </div>
          <button
            className="btn btn-sm"
            onClick={() => window.open(`sms:${SUPPORT_PHONE}`, '_blank')}
          >
            Text us
          </button>
        </div>
      </div>

      {/* ---------- Archive ---------- */}
      <div className="label">Archive</div>
      <div className="card">
        <div className="row">
          <div className="stack">
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <SuspendIcon size={16} /> Archived cards
            </span>
            <span className="muted" style={{ fontSize: 13 }}>
              {archived.length === 0
                ? 'Cards you archive while studying land here, out of rotation.'
                : `${archived.length} card${archived.length === 1 ? '' : 's'} out of rotation.`}
            </span>
          </div>
          {archived.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowArchive((v) => !v)}>
              {showArchive ? 'Hide' : 'Manage'}
            </button>
          )}
        </div>

        {showArchive && archived.length > 0 && (
          <div className="fade-in" style={{ marginTop: 4 }}>
            <div className="divider" />
            {archived.map((c) => (
              <div className="row" key={c.id} style={{ alignItems: 'flex-start', gap: 12, padding: '8px 0' }}>
                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.question}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>{c.topic}</span>
                </div>
                <div className="btn-row">
                  <button className="muted btn-sm" onClick={() => suspendCard(c.id, false)} title="Restore to rotation">
                    Restore
                  </button>
                  <button className="muted btn-sm" onClick={() => deleteCard(c.id)} title="Delete permanently" style={{ color: 'var(--weak)' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            <div className="divider" />
            <div className="btn-row">
              <button className="btn btn-sm btn-ghost" onClick={restoreAllArchived}>Restore all</button>
              {confirmEmpty ? (
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--weak)', color: '#fff' }}
                  onClick={() => { deleteAllArchived(); setConfirmEmpty(false); setShowArchive(false) }}
                >
                  Tap again to confirm
                </button>
              ) : (
                <button className="btn btn-sm btn-ghost" onClick={() => setConfirmEmpty(true)} style={{ color: 'var(--weak)' }}>
                  Empty archive
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------- About ---------- */}
      <p className="muted" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
        Flashbang's intelligence reads your notes, writes your cards, grades your typed
        answers and tailors hints to exactly where you slip up — all handled for you,
        nothing to set up.
      </p>

      <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 24 }}>
        Flashbang · v{DISPLAY_VERSION} · your study data stays on this device
      </p>
    </>
  )
}
