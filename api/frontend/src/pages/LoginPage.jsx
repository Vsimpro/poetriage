import { useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { TerminalSquare } from 'lucide-react'
import { fetchJson } from '../lib/api.js'
import { Button } from '../components/ui/Button.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Input } from '../components/ui/Input.jsx'
import { PasswordInput } from '../components/ui/PasswordInput.jsx'
import { useToast } from '../components/ui/Toast.jsx'

export function LoginPage({ currentUser, setCurrentUser, authChecked }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const passwordRef = useRef(null)

  if (authChecked && currentUser) return <Navigate to={location.state?.from?.pathname || '/'} replace />

  async function submit(event) {
    event.preventDefault()
    if (!username.trim() || !password) {
      toast({ tone: 'danger', title: 'Username and password required' })
      if (!password) passwordRef.current?.focus()
      return
    }
    setLoading(true)
    try {
      const user = await fetchJson('/api/auth/login', { method: 'POST', body: { username: username.trim(), password } })
      setCurrentUser(user)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      toast({ tone: 'danger', title: 'Sign in failed', description: err.message || 'Check your operator credentials and try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="grid min-h-dvh place-items-center px-4 py-8 outline-none">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-sm border border-slate-900 bg-white">
            <TerminalSquare className="h-6 w-6 text-accent" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">Poetriage</h1>
          <p className="mt-2 text-sm text-muted">Malware Analysis Platform</p>
        </div>
        <Card>
          <form className="grid gap-4" onSubmit={submit}>
            <div>
              <h2 className="text-base font-semibold">Authentication</h2>
              <p className="mt-1 text-sm text-muted">Sign in with operator credentials.</p>
            </div>
            <Input id="username" label="Username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
            <PasswordInput id="password" label="Password" ref={passwordRef} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <Button type="submit" variant="primary" loading={loading} className="w-full">Sign in</Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
