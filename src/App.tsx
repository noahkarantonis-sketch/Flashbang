import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useStore } from './store'
import { supabase, supabaseConfigured } from './lib/supabase'
import { checkForUpdate, type UpdateInfo } from './lib/version'
import { Auth } from './screens/Auth'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Library } from './screens/Library'
import { Add } from './screens/Add'
import { Study } from './screens/Study'
import { Graph } from './screens/Graph'
import { Settings } from './screens/Settings'
import { Logo } from './components/Logo'
import {
  HomeIcon,
  DocsIcon,
  PlusIcon,
  StudyIcon,
  GraphIcon
} from './components/Icons'

export type Tab = 'home' | 'library' | 'add' | 'study' | 'graph' | 'settings'

export function App() {
  const theme = useStore((s) => s.theme)
  const onboarded = useStore((s) => s.onboarded)
  const [tab, setTab] = useState<Tab>('home')
  const [studyTopic, setStudyTopic] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [updateDismissed, setUpdateDismissed] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    checkForUpdate().then(setUpdate)
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      setSession(null)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const go = (t: Tab, topic: string | null = null) => {
    setStudyTopic(topic)
    setTab(t)
  }

  // --- gate 1: project not configured yet ---
  if (!supabaseConfigured) {
    return (
      <div className="app">
        <div className="titlebar" />
        <SetupNotice />
      </div>
    )
  }

  // --- gate 2: still loading the session ---
  if (session === undefined) {
    return (
      <div className="app">
        <div className="titlebar" />
        <div className="screen">
          <div className="center-col">
            <Logo size={56} />
          </div>
        </div>
      </div>
    )
  }

  // --- gate 3: not signed in ---
  if (session === null) {
    return (
      <div className="app">
        <div className="titlebar" />
        <Auth />
      </div>
    )
  }

  // --- gate 4: first run, no subject yet ---
  if (!onboarded) {
    return (
      <div className="app">
        <div className="titlebar" />
        <Onboarding />
      </div>
    )
  }

  const showUpdate = update && !updateDismissed

  return (
    <div className="app">
      <div className="titlebar" />
      {showUpdate && (
        <div className="update-bar fade-in">
          <span>
            A new version of Flashbang is available{update.notes ? ` — ${update.notes}` : '.'}
          </span>
          <span className="update-actions">
            <button className="btn btn-sm" onClick={() => window.open(update.url, '_blank')}>
              Download
            </button>
            <button
              className="update-x"
              onClick={() => setUpdateDismissed(true)}
              title="Dismiss"
            >
              ✕
            </button>
          </span>
        </div>
      )}
      <div className="screen" key={tab}>
        <div className="screen-inner fade-in">
          {tab === 'home' && <Home go={go} />}
          {tab === 'library' && <Library go={go} />}
          {tab === 'add' && <Add go={go} />}
          {tab === 'study' && <Study topic={studyTopic} go={go} />}
          {tab === 'graph' && <Graph go={go} />}
          {tab === 'settings' && <Settings />}
        </div>
      </div>

      <nav className="nav">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => go('home')}>
          <HomeIcon /> Home
        </button>
        <button className={tab === 'library' ? 'active' : ''} onClick={() => go('library')}>
          <DocsIcon /> Library
        </button>
        <button className="add" onClick={() => go('add')}>
          <div className="add-circle">
            <PlusIcon size={24} />
          </div>
        </button>
        <button className={tab === 'study' ? 'active' : ''} onClick={() => go('study')}>
          <StudyIcon /> Study
        </button>
        <button className={tab === 'graph' ? 'active' : ''} onClick={() => go('graph')}>
          <GraphIcon /> Graph
        </button>
      </nav>
    </div>
  )
}

function SetupNotice() {
  return (
    <div className="screen">
      <div className="screen-inner center-col fade-in" style={{ maxWidth: 520 }}>
        <Logo size={64} />
        <h1 className="greeting">Almost there</h1>
        <div className="card" style={{ textAlign: 'left' }}>
          <p style={{ marginBottom: 12 }}>
            Flashbang needs your Supabase project to run. Two steps:
          </p>
          <ol className="muted" style={{ paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
            <li>Create a project at supabase.com (free tier is fine).</li>
            <li>
              Put its URL and anon key in the <code>.env</code> file at the
              project root, then restart the app.
            </li>
          </ol>
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            Full deploy steps (schema + the AI function + your Anthropic secret)
            are in <code>supabase/README.md</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
