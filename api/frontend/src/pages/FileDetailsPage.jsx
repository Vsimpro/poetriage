import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Settings } from 'lucide-react'
import { fetchJson, publicShareUrl } from '../lib/api.js'
import { formatBytes, formatDate } from '../lib/format.js'
import { displayStatus, statusTone } from '../lib/status.js'
import { useDisclosure } from '../hooks/useDisclosure.js'
import { copyText } from '../lib/clipboard.js'
import { ReportDownloadLink } from '../components/ReportDownloadLink.jsx'
import { ReportMarkdown } from '../components/ReportMarkdown.jsx'
import { AnalysisMetricsRows, RiskScoreRow } from '../components/ReportMetadata.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card } from '../components/ui/Card.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { LoadingPanel } from '../components/ui/LoadingPanel.jsx'
import { MetaRow } from '../components/ui/MetaRow.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Select } from '../components/ui/Select.jsx'
import { useToast } from '../components/ui/Toast.jsx'

const POLL_MS = 5000
const ANALYSIS_STARTED_FIELDS = {
  status: 'queued',
  analysis: '',
  token_count: 0,
  analysis_token_count: 0,
  summary_token_count: 0,
  final_conversation_token_count: null,
  estimated_cost: 0,
  analysis_context_rot: false,
  risk_score: null,
}

const MODEL_STORAGE_KEY = 'poetriage.selectedModel'

export function FileDetailsPage() {
  const { sha256 } = useParams()
  const navigate = useNavigate()
  const deleteDialog = useDisclosure(false)
  const shareDialog = useDisclosure(false)
  const { toast } = useToast()
  const leftRailRef = useRef(null)
  const deleteButtonRef = useRef(null)
  const shareButtonRef = useRef(null)
  const modelMenuRef = useRef(null)
  const loadControllerRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [reportHeight, setReportHeight] = useState(null)
  const [models, setModels] = useState([])
  const [defaultModel, setDefaultModel] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)

  async function loadFile(showLoader = true) {
    loadControllerRef.current?.abort()
    const controller = new AbortController()
    loadControllerRef.current = controller
    if (showLoader) setLoading(true)
    try {
      const data = await fetchJson(`/api/file/${encodeURIComponent(sha256)}`, { signal: controller.signal })
      setFile(data)
    } catch (err) {
      if (err.name !== 'AbortError') toast({ tone: 'danger', title: 'Could not load sample', description: err.message })
    } finally {
      if (loadControllerRef.current === controller) setLoading(false)
    }
  }

  useEffect(() => {
    loadFile()
    return () => loadControllerRef.current?.abort()
  }, [sha256])

  useEffect(() => {
    async function loadModels() {
      try {
        const data = await fetchJson('/api/models')
        const enabled = Array.isArray(data.models) ? data.models : []
        const remembered = window.localStorage.getItem(MODEL_STORAGE_KEY)
        const nextModel = enabled.some((model) => model.model_id === remembered) ? remembered : data.default_model
        setModels(enabled)
        setDefaultModel(data.default_model || '')
        setSelectedModel(nextModel || enabled[0]?.model_id || '')
      } catch (err) {
        toast({ tone: 'warning', title: 'Could not load models', description: err.message })
      }
    }

    loadModels()
  }, [])

  useEffect(() => {
    if (!file || !['queued', 'analyzing'].includes(file.status)) return undefined
    const timerId = window.setInterval(() => loadFile(false), POLL_MS)
    return () => window.clearInterval(timerId)
  }, [file?.status, sha256])

  useEffect(() => {
    if (!leftRailRef.current) return undefined

    const observer = new ResizeObserver(([entry]) => {
      setReportHeight(entry.contentRect.height)
    })

    observer.observe(leftRailRef.current)
    return () => observer.disconnect()
  }, [file?.sha256])

  useEffect(() => {
    if (!modelMenuOpen) return undefined

    function closeOnOutsideClick(event) {
      if (!modelMenuRef.current?.contains(event.target)) setModelMenuOpen(false)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setModelMenuOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [modelMenuOpen])

  async function analyze({ force = false } = {}) {
    if (!file) return
    setBusy('analyze')
    try {
      await fetchJson(`/api/analyze/${encodeURIComponent(file.sha256)}${force ? '?force=true' : ''}`, { method: 'POST', body: { model_id: selectedModel } })
      if (selectedModel) window.localStorage.setItem(MODEL_STORAGE_KEY, selectedModel)
      setFile((current) => current ? { ...current, ...ANALYSIS_STARTED_FIELDS, queued_model: selectedModel } : current)
      toast({ tone: 'success', title: 'Analysis added to the queue' })
      await loadFile(false)
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not queue analysis', description: err.message })
    } finally {
      setBusy('')
    }
  }

  function chooseModel(modelId) {
    setSelectedModel(modelId)
    setModelMenuOpen(false)
  }

  async function cancelQueuedAnalysis() {
    if (!file) return
    setBusy('cancel-queue')
    try {
      const updated = await fetchJson(`/api/analyze/${encodeURIComponent(file.sha256)}/queue`, { method: 'DELETE' })
      setFile(updated)
      toast({ tone: 'success', title: 'Removed from analysis queue' })
    } catch (err) {
      toast({ tone: 'danger', title: 'Queue removal failed', description: err.message })
      await loadFile(false)
    } finally {
      setBusy('')
    }
  }

  async function applyVisibility(nextIsPublic) {
    if (!file) return
    setBusy('visibility')
    try {
      const updated = await fetchJson(`/api/file/${encodeURIComponent(file.sha256)}/visibility`, { method: 'PATCH', body: { is_public: nextIsPublic } })
      setFile(updated)
      toast({ tone: 'success', title: updated.is_public ? 'Public link enabled' : 'Public link disabled' })
      shareDialog.hide()
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not update sharing', description: err.message })
    } finally {
      setBusy('')
    }
  }

  async function togglePublic() {
    if (!file) return
    if (!file.is_public) {
      shareDialog.show()
      return
    }
    await applyVisibility(false)
  }

  async function copyShareLink() {
    if (!file?.public_token) return
    const url = publicShareUrl(file.public_token)
    const copied = await copyText(url)
    if (copied) {
      toast({ tone: 'success', title: 'Public link copied' })
    } else {
      toast({ tone: 'warning', title: 'Copy failed', description: 'Select and copy the public link manually.' })
    }
  }

  async function deleteSample() {
    if (!file) return
    setBusy('delete')
    try {
      await fetchJson(`/api/file/${encodeURIComponent(file.sha256)}`, { method: 'DELETE' })
      navigate('/', { replace: true })
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not delete sample', description: err.message })
      setBusy('')
      deleteDialog.hide()
    }
  }

  if (loading) return <LoadingPanel label="Loading sample details" />
  if (!file) {
    return (
      <Card>
        <Alert tone="danger">Sample not found.</Alert>
        <Link className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" to="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
      </Card>
    )
  }

  const isQueued = file.status === 'queued'
  const isAnalyzing = file.status === 'analyzing'
  const showDisabledRemoveFromQueue = !isQueued && file.status !== 'done'
  const shouldForceAnalysis = file.status === 'done' || file.status === 'error'
  const analysisButtonLabel = isAnalyzing
    ? 'Analyzing...'
    : file.status === 'done'
      ? 'Reanalyze sample'
      : file.status === 'error'
        ? 'Retry analysis'
        : 'Begin Analysis'
  const reportText = isQueued
    ? '## Queued for analysis...\n\nThis sample is waiting for the worker. The report will appear here when analysis completes.'
    : isAnalyzing
    ? '## Analyzing...\n\nSit tight. The report will appear here when analysis completes.'
    : file.analysis
  const canDownloadReport = Boolean(file.analysis?.trim())
  const reportDownloadHref = `/api/file/${encodeURIComponent(file.sha256)}/report.md`
  const visibleStatus = displayStatus(file)

  return (
    <>
      <PageHeader title="Sample Details" description={file.filename} compact />
      <div className="mb-4">
        <Link className="inline-flex min-h-9 items-center gap-2 rounded-sm text-sm font-medium text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" to="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
      </div>
      <div className="grid min-w-0 gap-5 pb-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <div ref={leftRailRef} className="grid min-w-0 content-start gap-3">
          <Card compact polished>
            <h2 className="text-base font-semibold text-slate-950">File Metadata</h2>
            <dl className="mt-2">
              <MetaRow label="Status" value={<Badge tone={statusTone(visibleStatus)} polished className="!rounded-md">{visibleStatus}</Badge>} compact polished />
              <MetaRow label="Filename" value={file.filename} compact polished />
              <RiskScoreRow file={file} />
              <MetaRow label="Size" value={formatBytes(file.size)} compact polished />
              <MetaRow label="Uploaded" value={formatDate(file.uploaded_at)} compact polished />
            </dl>
          </Card>
          <Card compact polished>
            <h2 className="text-base font-semibold text-slate-950">Cryptographic Hashes</h2>
            <dl className="mt-2">
              <MetaRow label="MD5" value={file.md5} mono compact polished />
              <MetaRow label="SHA256" value={file.sha256} mono compact polished />
            </dl>
          </Card>
          <Card compact polished>
            <h2 className="text-base font-semibold text-slate-950">Analysis Metadata</h2>
            <dl className="mt-2">
              <AnalysisMetricsRows file={file} />
            </dl>
          </Card>
          <Card compact polished>
            <h2 className="text-base font-semibold text-slate-950">Sharing</h2>
            <p className="mt-2 text-sm text-slate-600">Public reports are read-only and use the frontend share route.</p>
            {file.is_public && file.public_token ? <p className="mt-3 break-all font-mono text-xs text-foreground">{publicShareUrl(file.public_token)}</p> : <p className="mt-3 text-sm text-muted">Not publicly shared.</p>}
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button ref={shareButtonRef} variant={file.is_public ? 'neutral' : 'secondary'} onClick={togglePublic} loading={busy === 'visibility'} polished className="!h-8 px-3 text-xs">{file.is_public ? 'Make Private' : 'Create Share Link'}</Button>
              <Button onClick={copyShareLink} disabled={!file.public_token} polished className="!h-8 px-3 text-xs">Copy Link</Button>
            </div>
          </Card>
          <Card compact polished>
            <h2 className="text-base font-semibold text-slate-950">Actions</h2>
            <div className="mt-3 grid gap-2">
              {isQueued ? (
                <Button
                  variant="neutral"
                  onClick={cancelQueuedAnalysis}
                  loading={busy === 'cancel-queue'}
                  polished
                >
                  Remove from queue
                </Button>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Button
                      variant="primary"
                      onClick={() => analyze({ force: shouldForceAnalysis })}
                      loading={busy === 'analyze'}
                      disabled={isAnalyzing}
                      polished
                    >
                      {analysisButtonLabel}
                    </Button>
                    <div ref={modelMenuRef} className="relative">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-[0_1px_1px_rgba(15,23,42,0.08)] transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-55"
                        aria-label="Choose analysis model"
                        aria-expanded={modelMenuOpen}
                        disabled={!models.length || isAnalyzing}
                        onClick={() => setModelMenuOpen((open) => !open)}
                      >
                        <Settings className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {modelMenuOpen ? (
                        <div className="absolute left-1/2 top-11 z-20 w-72 -translate-x-1/2 rounded-lg border border-slate-300 bg-white p-3 shadow-lg">
                          <Select id="reanalyze-model" label="Analysis model" value={selectedModel} disabled={!models.length || isAnalyzing} onChange={(event) => chooseModel(event.target.value)} polished>
                            {models.map((model) => (
                              <option key={model.model_id} value={model.model_id}>{model.label || model.model_id}{model.model_id === defaultModel ? ' (default)' : ''}</option>
                            ))}
                          </Select>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
              {showDisabledRemoveFromQueue ? (
                <Button
                  variant="neutral"
                  onClick={cancelQueuedAnalysis}
                  loading={busy === 'cancel-queue'}
                  disabled
                  polished
                >
                  Remove from queue
                </Button>
              ) : null}
              <Button
                ref={deleteButtonRef}
                variant="neutral"
                onClick={deleteDialog.show}
                loading={busy === 'delete'}
                disabled={isAnalyzing}
                polished
                className="!border-transparent !bg-transparent !text-red-700 shadow-none hover:!border-transparent hover:!bg-transparent hover:!text-red-800 active:!bg-transparent"
              >
                Delete Sample
              </Button>
            </div>
          </Card>
        </div>
        <Card polished className="flex min-w-0 flex-col overflow-hidden p-6" style={reportHeight ? { height: `${reportHeight}px` } : undefined}>
          <div className="-mx-6 mb-4 flex shrink-0 flex-col gap-2 border-b border-slate-300 px-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Intelligence Report</h2>
              {isAnalyzing ? <p className="mt-1 text-sm text-muted">Analyzing... sit tight.</p> : null}
            </div>
            <ReportDownloadLink href={reportDownloadHref} enabled={canDownloadReport} />
          </div>
          <div className="report-scroll min-h-0 flex-1 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
            <ReportMarkdown text={reportText} polished />
          </div>
        </Card>
      </div>
      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete sample?"
        description={`Delete ${file.filename}? This cannot be undone.`}
        confirmLabel="Delete sample"
        loading={busy === 'delete'}
        onConfirm={deleteSample}
        onClose={deleteDialog.hide}
        returnFocusRef={deleteButtonRef}
      />
      <ConfirmDialog
        open={shareDialog.open}
        title="Enable public report link?"
        description={`Create a read-only public link for ${file.filename}. Anyone with the link can view the report metadata and analysis.`}
        confirmLabel="Create public link"
        confirmVariant="primary"
        loading={busy === 'visibility'}
        onConfirm={() => applyVisibility(true)}
        onClose={shareDialog.hide}
        returnFocusRef={shareButtonRef}
      />
    </>
  )
}
