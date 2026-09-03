import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, CircleUserRound, LogOut, Users } from 'lucide-react'
import { fetchJson } from '../lib/api.js'
import { Badge } from './ui/Badge.jsx'

const POLL_MS = 5000

export function AppShell({ currentUser, setCurrentUser, children }) {
  const navigate = useNavigate()
  const [worker, setWorker] = useState({ status: 'unknown', current_file: null })
  const [accountOpen, setAccountOpen] = useState(false)
  const accountMenuRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let inFlight = false
    let timerId

    async function poll() {
      if (!currentUser || inFlight) return
      inFlight = true
      try {
        const status = await fetchJson('/api/analyze/status')
        if (!cancelled) setWorker(status)
      } catch (error) {
        if (!cancelled) setWorker({ status: 'unavailable', current_file: null })
      } finally {
        inFlight = false
      }
    }

    poll()
    timerId = window.setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timerId)
    }
  }, [currentUser])

  useEffect(() => {
    if (!accountOpen) return undefined

    function closeOnOutsideClick(event) {
      if (!accountMenuRef.current?.contains(event.target)) setAccountOpen(false)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setAccountOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [accountOpen])

  async function logout() {
    try {
      await fetchJson('/api/auth/logout', { method: 'POST' })
    } finally {
      setAccountOpen(false)
      setCurrentUser(null)
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/94 text-foreground backdrop-blur supports-[backdrop-filter]:bg-white/86">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-h-11 items-center rounded-md pr-2 font-mono text-xs font-semibold tracking-[0.04em] text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            <span className="mr-2 h-2.5 w-2.5 rounded-sm bg-blue-600" aria-hidden="true" />
            Poetriage v0.1
          </Link>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Badge tone={worker.status === 'analyzing' || worker.status === 'queued' ? 'warning' : worker.status === 'idle' ? 'success' : 'neutral'} polished className="max-w-[42vw] overflow-hidden text-ellipsis whitespace-nowrap sm:max-w-72">
              {worker.status === 'analyzing' ? `Analyzing ${worker.current_file}` : worker.status === 'queued' ? `${worker.queued || 0} queued` : worker.status === 'idle' ? 'Worker idle' : 'Worker unknown'}
            </Badge>
            {currentUser?.is_admin ? (
              <Link className="hidden min-h-9 items-center gap-2 rounded-md px-2.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:inline-flex" to="/admin/panel">
                <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                Admin Panel
              </Link>
            ) : null}
            <div ref={accountMenuRef} className="relative hidden sm:block">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200" aria-hidden="true">
                  <CircleUserRound className="h-4 w-4" />
                </span>
                <span className="max-w-28 truncate">{currentUser?.username}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${accountOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {accountOpen ? (
                <div className="absolute right-0 top-11 z-30 w-44 rounded-lg border border-slate-300 bg-white p-1 shadow-lg" role="menu">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    role="menuitem"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 outline-none sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
