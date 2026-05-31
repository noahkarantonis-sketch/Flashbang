import { useState } from 'react'
import { useStore } from '../store'
import { Logo } from '../components/Logo'

// Post-login first-run: create one subject. (The API key is gone — it lives on
// the server now; users sign in instead.)
const NAME_MAX = 16

export function Onboarding() {
  const addSubject = useStore((s) => s.addSubject)
  const setOnboarded = useStore((s) => s.setOnboarded)
  const setUserName = useStore((s) => s.setUserName)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')

  function finish() {
    if (name.trim()) setUserName(name.trim())
    if (subject.trim()) addSubject(subject.trim())
    setOnboarded(true)
  }

  return (
    <div className="screen">
      <div className="screen-inner center-col fade-in" style={{ maxWidth: 480 }}>
        <Logo size={64} />
        <h1 className="greeting">Let's set you up</h1>
        <p className="muted" style={{ marginTop: -6 }}>
          Two quick things. You can change both later.
        </p>
        <div className="card" style={{ width: '100%', textAlign: 'left', marginTop: 18 }}>
          <div className="label" style={{ marginTop: 0 }}>
            What should we call you?
          </div>
          <input
            autoFocus
            placeholder="e.g. Alex"
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="label">First subject</div>
          <input
            placeholder="e.g. Physics"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && finish()}
          />
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Add more subjects later — try the one with the closest exam.
          </p>
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={finish}>
              Enter Flashbang
            </button>
          </div>
        </div>
        <button className="btn-ghost btn btn-sm" onClick={finish}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
