import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Search } from 'lucide-react'
import { fetchJson } from '../lib/api.js'
import { formatDate } from '../lib/format.js'
import { cx } from '../lib/cx.js'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Input } from '../components/ui/Input.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { PasswordInput } from '../components/ui/PasswordInput.jsx'
import { Skeleton } from '../components/ui/Skeleton.jsx'
import { useToast } from '../components/ui/Toast.jsx'

export function AdminUsersPage() {
  const { toast } = useToast()
  const discoveryMenuRef = useRef(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyUser, setBusyUser] = useState('')
  const [busyModel, setBusyModel] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const [creating, setCreating] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [models, setModels] = useState([])
  const [discovered, setDiscovered] = useState([])
  const [selectedDiscovery, setSelectedDiscovery] = useState('')
  const [discoveryMenuOpen, setDiscoveryMenuOpen] = useState(false)
  const [discoveryQuery, setDiscoveryQuery] = useState('')

  function modelName(model) {
    const label = model?.label || model?.model_id || ''
    const maker = (model?.model_id || '').split('/')[0]
    return maker && label.toLowerCase().startsWith(maker.toLowerCase()) ? label.slice(maker.length).replace(/^[:\s-]+/, '') : label
  }

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await fetchJson('/api/admin/users')
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not load operators', description: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function loadModels() {
    try {
      const data = await fetchJson('/api/admin/models')
      setModels(Array.isArray(data.models) ? data.models : [])
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not load models', description: err.message })
    }
  }

  useEffect(() => {
    loadUsers()
    loadModels()
  }, [])

  useEffect(() => {
    if (!discoveryMenuOpen) return undefined

    function closeOnOutsideClick(event) {
      if (!discoveryMenuRef.current?.contains(event.target)) setDiscoveryMenuOpen(false)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setDiscoveryMenuOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [discoveryMenuOpen])

  async function createUser(event) {
    event.preventDefault()
    if (!username.trim() || !password) {
      toast({ tone: 'danger', title: 'Username and password required' })
      return
    }
    setCreating(true)
    try {
      await fetchJson('/api/admin/users', { method: 'POST', body: { username: username.trim(), password } })
      setUsername('')
      setPassword('')
      toast({ tone: 'success', title: 'Operator account created' })
      await loadUsers()
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not create operator', description: err.message })
    } finally {
      setCreating(false)
    }
  }

  async function toggleUser(user) {
    setBusyUser(user.id)
    try {
      await fetchJson(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'PATCH', body: { is_active: !user.is_active } })
      toast({ tone: 'success', title: 'Operator status updated' })
      await loadUsers()
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not update operator', description: err.message })
    } finally {
      setBusyUser('')
    }
  }

  async function discoverModels() {
    setDiscovering(true)
    try {
      const data = await fetchJson('/api/admin/models/discover', { method: 'POST' })
      setDiscovered(Array.isArray(data) ? data : [])
      setSelectedDiscovery(data?.[0]?.model_id || '')
      setDiscoveryQuery('')
      setDiscoveryMenuOpen(true)
      toast({ tone: 'success', title: 'Models discovered' })
    } catch (err) {
      toast({ tone: 'danger', title: 'Discovery failed', description: err.message })
    } finally {
      setDiscovering(false)
    }
  }

  function openDiscoveryMenu() {
    setDiscoveryMenuOpen(true)
    if (!discovered.length && !discovering) discoverModels()
  }

  async function addModel() {
    if (!selectedDiscovery) return
    const found = discovered.find((model) => model.model_id === selectedDiscovery)
    setBusyModel(selectedDiscovery)
    try {
      const data = await fetchJson('/api/admin/models', { method: 'POST', body: { model_id: selectedDiscovery, label: modelName(found) || selectedDiscovery, tags: [] } })
      setModels(Array.isArray(data.models) ? data.models : [])
      toast({ tone: 'success', title: 'Model added' })
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not add model', description: err.message })
    } finally {
      setBusyModel('')
    }
  }

  const visibleDiscoveredModels = discovered.filter((model) => `${model.label || ''} ${model.model_id}`.toLowerCase().includes(discoveryQuery.trim().toLowerCase()))
  const groupedDiscoveredModels = visibleDiscoveredModels.reduce((groups, model) => {
    const provider = (model.model_id.split('/')[0] || 'other').toUpperCase()
    groups[provider] = [...(groups[provider] || []), model]
    return groups
  }, {})

  function updateLocalModel(modelId, patch) {
    setModels((current) => current.map((model) => model.model_id === modelId ? { ...model, ...patch } : model))
  }

  async function saveModel(model, patch) {
    const next = { ...model, ...patch }
    if (patch.is_default) {
      setModels((current) => current.map((item) => ({ ...item, is_default: item.model_id === model.model_id, is_enabled: item.model_id === model.model_id ? true : item.is_enabled })))
    } else {
      updateLocalModel(model.model_id, patch)
    }

    setBusyModel(model.model_id)
    try {
      const data = await fetchJson(`/api/admin/models/${encodeURIComponent(model.model_id)}`, { method: 'PATCH', body: { label: next.label, is_enabled: next.is_enabled, tags: next.tags, is_default: patch.is_default === true } })
      setModels(Array.isArray(data.models) ? data.models : [])
      toast({ tone: 'success', title: 'Model updated' })
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not update model', description: err.message })
      await loadModels()
    } finally {
      setBusyModel('')
    }
  }

  return (
    <>
      <PageHeader title="Admin Panel" description="Provision operators and manage the analysis model allowlist." />
      <div className="mb-4">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" to="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
      </div>
      <div className="grid gap-5">
        <Card polished>
          <h2 className="text-base font-semibold text-slate-950">Operator Provisioning</h2>
          <form className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start" onSubmit={createUser}>
            <Input id="new-operator" label="Username" value={username} onChange={(event) => setUsername(event.target.value)} polished />
            <PasswordInput id="new-password" label="Temporary password" hint="Minimum 8 characters." value={password} onChange={(event) => setPassword(event.target.value)} polished />
            <div className="lg:pt-[26px]">
              <Button type="submit" variant="primary" disabled={creating} polished className="w-full lg:w-auto">Provision</Button>
            </div>
          </form>
        </Card>
        <Card polished>
          <div className="mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Operator Directory</h2>
              <div className="mt-2"><Badge tone="primary" polished>Total operators: {users.length}</Badge></div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-[0.04em] text-slate-500">
                  <th className="h-9 border-b border-slate-300 pr-4 font-bold">Username</th>
                  <th className="h-9 border-b border-slate-300 pr-4 font-bold">Role</th>
                  <th className="h-9 border-b border-slate-300 pr-4 font-bold">Status</th>
                  <th className="h-9 border-b border-slate-300 pr-4 font-bold">Created</th>
                  <th className="h-9 border-b border-slate-300 pr-4 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? [0, 1, 2].map((item) => (
                  <tr key={item} className="last:[&>td]:border-b-0">
                    <td className="h-12 border-b border-slate-200 pr-4"><Skeleton className="h-5 w-32" /></td>
                    <td className="h-12 border-b border-slate-200 pr-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="h-12 border-b border-slate-200 pr-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="h-12 border-b border-slate-200 pr-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="h-12 border-b border-slate-200 pr-4 text-right"><Skeleton className="ml-auto h-8 w-20 rounded-md" /></td>
                  </tr>
                )) : users.map((user) => (
                  <tr key={user.id} className={cx('last:[&>td]:border-b-0', !user.is_active && 'bg-slate-50/80 text-muted')}>
                    <td className="h-12 border-b border-slate-200 pr-4 font-medium text-foreground">{user.username}</td>
                    <td className="h-12 border-b border-slate-200 pr-4"><Badge tone={user.is_admin ? 'primary' : 'neutral'} polished>{user.is_admin ? 'Admin' : 'Operator'}</Badge></td>
                    <td className="h-12 border-b border-slate-200 pr-4"><Badge tone={user.is_active ? 'success' : 'danger'} polished>{user.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="h-12 border-b border-slate-200 pr-4 text-slate-600">{formatDate(user.created_at)}</td>
                    <td className="h-12 border-b border-slate-200 pr-4 text-right">
                      <Button disabled={user.is_admin || busyUser === user.id} onClick={() => toggleUser(user)} polished className="!h-8 w-24 px-3 text-xs">{user.is_active ? 'Deactivate' : 'Activate'}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && !users.length ? <p className="mt-4 rounded-md border border-dashed border-slate-400 bg-slate-50 p-6 text-center text-sm text-slate-600">No operators found. Provision the first operator above.</p> : null}
        </Card>
        <Card polished>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Discover Models</h2>
            <p className="mt-1 text-sm text-slate-600">Fetch provider models, then add the ones operators may use.</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div ref={discoveryMenuRef} className="relative">
                <div className="flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 shadow-[0_1px_1px_rgba(15,23,42,0.06)] focus-within:border-blue-500 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-600">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <input className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none" placeholder="Search or select a model..." value={discoveryQuery} onFocus={openDiscoveryMenu} onChange={(event) => { setDiscoveryQuery(event.target.value); openDiscoveryMenu() }} />
                  <button type="button" className="-mr-1 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Toggle model list" aria-expanded={discoveryMenuOpen} onClick={() => discoveryMenuOpen ? setDiscoveryMenuOpen(false) : openDiscoveryMenu()}><ChevronDown className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                {discoveryMenuOpen ? (
                  <div className="absolute left-0 right-0 top-10 z-20 max-h-72 overflow-y-auto rounded-md border border-slate-300 bg-white p-1 shadow-[0_8px_20px_rgba(15,23,42,0.10)]">
                    {Object.entries(groupedDiscoveredModels).map(([provider, items]) => (
                      <div key={provider}>
                        <div className="mx-3 mb-1 border-b border-slate-300 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700">{provider}</div>
                        {items.map((model) => {
                          const label = modelName(model)
                          const meta = `${label} ${model.model_id}`.toLowerCase()
                          const pill = model.model_id.includes(':free') ? 'Free' : meta.includes('batch') ? 'Batch' : meta.includes('preview') ? 'Preview' : ''
                          return (
                            <button key={model.model_id} type="button" className={cx('flex min-h-7 w-full items-center gap-2 rounded py-0.5 pl-8 pr-3 text-left text-sm text-slate-800 hover:bg-slate-50', model.model_id === selectedDiscovery && 'bg-blue-50 text-blue-900')} onClick={() => { setSelectedDiscovery(model.model_id); setDiscoveryQuery(label) }}>
                              <span className="min-w-0 flex-1 truncate">{label}</span>
                              {pill ? <span className={cx('shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', pill === 'Free' && 'border-green-200 bg-green-50 text-green-700', pill === 'Batch' && 'border-slate-200 bg-slate-100 text-slate-600', pill === 'Preview' && 'border-blue-200 bg-white text-blue-700')}>{pill}</span> : null}
                              {model.model_id === selectedDiscovery ? <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" /> : null}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                    {discovering ? <div className="px-3 py-6 text-center text-sm text-slate-500">Discovering models...</div> : null}
                    {!discovering && !visibleDiscoveredModels.length ? <div className="px-3 py-6 text-center text-sm text-slate-500">No models found.</div> : null}
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button variant="primary" onClick={addModel} disabled={!selectedDiscovery || busyModel === selectedDiscovery} polished className="!h-9">Add model</Button>
              </div>
            </div>
        </Card>
        <Card polished>
          <h2 className="text-base font-semibold text-slate-950">Allowed Models</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-[0.04em] text-slate-500">
                  <th className="h-9 border-b border-slate-300 pr-4 font-bold">Default</th>
                  <th className="h-9 border-b border-slate-300 pr-4 font-bold">Model</th>
                  <th className="h-9 border-b border-slate-300 pr-4 font-bold">Label</th>
                  <th className="h-9 border-b border-slate-300 pr-4 font-bold">Status</th>
                  <th className="h-9 border-b border-slate-300 text-right font-bold" aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.model_id} className="last:[&>td]:border-b-0">
                    <td className="h-16 border-b border-slate-200 pr-4">
                      <input type="radio" name="default-model" checked={model.is_default} disabled={busyModel === model.model_id} onChange={() => saveModel(model, { is_default: true, is_enabled: true })} aria-label={`Use ${model.label || model.model_id} as default model`} />
                    </td>
                    <td className="h-16 border-b border-slate-200 pr-4 font-mono text-xs text-slate-700">{model.model_id}</td>
                    <td className="h-16 border-b border-slate-200 pr-4"><Input id={`label-${model.id}`} label={<span className="sr-only">Label for {model.model_id}</span>} value={model.label || ''} onChange={(event) => updateLocalModel(model.model_id, { label: event.target.value })} onBlur={() => saveModel(model, {})} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} polished inputClassName="h-9 min-h-0" /></td>
                    <td className={`h-16 border-b border-slate-200 pr-4 text-sm font-medium ${model.is_enabled ? 'text-green-700' : 'text-red-700'}`}>{model.is_enabled ? 'Enabled' : 'Disabled'}</td>
                    <td className="h-16 border-b border-slate-200 text-right">
                      <Button onClick={() => saveModel(model, { is_enabled: !model.is_enabled })} disabled={model.is_default || busyModel === model.model_id} polished className="!h-8 px-3 text-xs">{model.is_enabled ? 'Disable' : 'Enable'}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
