import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Copy, Download, FileText, Globe2, LockKeyhole, MoreHorizontal, Settings, UploadCloud, X } from 'lucide-react'
import { fetchJson } from '../lib/api.js'
import { copyText } from '../lib/clipboard.js'
import { formatBytes } from '../lib/format.js'
import { displayStatus, statusTone } from '../lib/status.js'
import { Button } from '../components/ui/Button.jsx'
import { Card } from '../components/ui/Card.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Select } from '../components/ui/Select.jsx'
import { Skeleton } from '../components/ui/Skeleton.jsx'
import { useToast } from '../components/ui/Toast.jsx'

const SAMPLE_COLUMNS = [
  { key: 'status', label: 'Status', width: 'w-[8%]', headerClass: 'pr-1' },
  { key: 'filename', label: 'Filename', width: 'w-[38%]', headerClass: 'pr-5' },
  { key: 'size', label: 'Size', width: 'w-[14%]', headerClass: 'pr-5 text-right' },
  { key: 'visibility', label: 'Visibility', width: 'w-[10%]', headerClass: 'pr-5' },
  { key: 'sha256', label: 'SHA-256', width: 'w-[24%]', headerClass: 'pr-5' },
  { key: 'menu', label: '', width: 'w-[6%]', headerClass: 'text-right', ariaLabel: 'Row menu' },
]

const MODEL_STORAGE_KEY = 'poetriage.selectedModel'

export function DashboardPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const fileInputRef = useRef(null)
  const modelMenuRef = useRef(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const [duplicateFile, setDuplicateFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const [copiedSha, setCopiedSha] = useState('')
  const [models, setModels] = useState([])
  const [defaultModel, setDefaultModel] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)

  async function loadFiles() {
    setLoading(true)
    try {
      const data = await fetchJson('/api/files')
      setFiles(Array.isArray(data) ? data : [])
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not load samples', description: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [])

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
    let cancelled = false

    async function checkDuplicate() {
      setDuplicateFile(null)
      if (!selectedFile) {
        setCheckingDuplicate(false)
        return
      }

      setCheckingDuplicate(true)
      try {
        const sha256 = await sha256File(selectedFile)
        if (cancelled) return
        setDuplicateFile(files.find((item) => item.sha256 === sha256) || null)
      } catch (error) {
        if (!cancelled) setDuplicateFile(null)
      } finally {
        if (!cancelled) setCheckingDuplicate(false)
      }
    }

    checkDuplicate()
    return () => {
      cancelled = true
    }
  }, [selectedFile, files])

  useEffect(() => {
    if (!openMenu) return undefined

    function closeMenu() {
      setOpenMenu(null)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpenMenu(null)
    }

    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)

    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
    }
  }, [openMenu])

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

  async function uploadFile(event) {
    event.preventDefault()
    const file = selectedFile
    if (!file) {
      fileInputRef.current?.click()
      return
    }
    if (checkingDuplicate) return
    if (duplicateFile) {
      toast({ tone: 'warning', title: 'Duplicate sample found', description: 'Opening the existing record.' })
      navigate(`/file/${duplicateFile.sha256}`)
      return
    }
    if (file.size > 200 * 1024 * 1024) {
      toast({ tone: 'danger', title: 'File exceeds 200 MB limit' })
      return
    }
    const knownHashes = new Set(files.map((item) => item.sha256))
    const formData = new FormData()
    formData.append('file', file)
    if (selectedModel) formData.append('model_id', selectedModel)
    setUploading(true)
    setUploadProgress(0)
    try {
      const uploaded = await uploadWithProgress('/api/upload', formData, setUploadProgress)
      await loadFiles()
      setSelectedFile(null)
      setFileInputKey((value) => value + 1)
      const uploadMessage = uploaded.status === 'analyzing'
        ? 'Analysis started'
        : uploaded.status === 'queued'
          ? 'Sample queued for analysis'
        : uploaded.status === 'pending'
          ? 'Sample uploaded'
          : 'Sample uploaded'
      toast({
        tone: knownHashes.has(uploaded.sha256) ? 'warning' : 'success',
        title: knownHashes.has(uploaded.sha256) ? 'Duplicate sample found' : uploadMessage,
        description: knownHashes.has(uploaded.sha256) ? 'Opening the existing record.' : undefined,
      })
      navigate(`/file/${uploaded.sha256}`)
    } catch (err) {
      toast({ tone: 'danger', title: 'Upload failed', description: err.message })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  function chooseFile(file) {
    if (!file || uploading) return
    setSelectedFile(file)
    setDuplicateFile(null)
  }

  function clearSelectedFile() {
    if (uploading) return
    setSelectedFile(null)
    setDuplicateFile(null)
    setCheckingDuplicate(false)
    setFileInputKey((value) => value + 1)
    fileInputRef.current?.focus()
  }

  const selectedStateLabel = checkingDuplicate
    ? 'Checking sample'
    : duplicateFile
      ? 'Duplicate upload'
      : 'Ready to analyze'
  const submitLabel = selectedFile
    ? checkingDuplicate
      ? 'Checking sample'
      : duplicateFile
      ? 'Go to sample'
      : 'Analyze sample'
    : 'Upload sample'

  function onDragOver(event) {
    event.preventDefault()
    if (!uploading) setDragActive(true)
  }

  function onDragLeave(event) {
    event.preventDefault()
    if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return
    setDragActive(false)
  }

  function onDrop(event) {
    event.preventDefault()
    setDragActive(false)
    chooseFile(event.dataTransfer.files?.[0])
  }

  async function copySha256(sha256) {
    const copied = await copyText(sha256)
    if (!copied) {
      toast({ tone: 'warning', title: 'Copy failed', description: 'Select and copy the hash manually.' })
      return
    }
    setCopiedSha(sha256)
    toast({ tone: 'success', title: 'SHA-256 copied' })
    window.setTimeout(() => {
      setCopiedSha((current) => current === sha256 ? '' : current)
    }, 1500)
  }

  function toggleRowMenu(event, file) {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 168
    setOpenMenu((current) => current?.sha256 === file.sha256 ? null : {
      file,
      sha256: file.sha256,
      left: Math.max(8, rect.right - menuWidth),
      top: rect.bottom + 6,
      width: menuWidth,
    })
  }

  function chooseModel(modelId) {
    setSelectedModel(modelId)
    if (modelId) window.localStorage.setItem(MODEL_STORAGE_KEY, modelId)
    setModelMenuOpen(false)
  }

  return (
    <>
      <PageHeader title="Upload Dashboard" description="Send a sample into triage, then review its metadata before starting analysis." />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr] lg:items-start">
        <Card polished className="min-w-0 p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-slate-950">Drop a sample for triage</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Maximum size: 200 MB.</p>
          </div>
          <form className="grid min-w-0 gap-3" onSubmit={uploadFile}>
            <label
              className={`group relative grid min-h-[210px] cursor-pointer place-items-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50/80' : 'border-slate-300 bg-slate-50/80 hover:border-blue-400 hover:bg-blue-50/50'} ${uploading ? 'cursor-wait opacity-80' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <input
                key={fileInputKey}
                ref={fileInputRef}
                type="file"
                aria-label="Choose sample file"
                className="sr-only"
                disabled={uploading}
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />
              <span className="grid max-w-[260px] justify-items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-blue-200 bg-white text-blue-700 shadow-sm transition-colors group-hover:border-blue-300 group-hover:text-blue-800">
                  <UploadCloud className="h-6 w-6" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-slate-950">Drag a file here, or browse</span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">The upload creates a private record and queues analysis with the selected model.</span>
                </span>
              </span>
            </label>
            {selectedFile ? (
              <div className="min-w-0 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-3 text-sm text-blue-950">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-[12px] font-semibold text-blue-800">{selectedStateLabel}</span>
                    <span className="mt-1 block min-w-0 break-all font-medium text-slate-950">{selectedFile.name}</span>
                    <span className="mt-1 block text-slate-700 tabular-nums">{formatBytes(selectedFile.size)}</span>
                    {duplicateFile ? <span className="mt-1 block text-xs text-blue-800">This sample already exists in your library.</span> : null}
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Remove selected file"
                    disabled={uploading}
                    onClick={clearSelectedFile}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {uploading ? (
                  <div className="mt-3" aria-live="polite">
                    <div className="mb-1 flex items-center justify-between text-xs font-medium text-blue-900">
                      <span>Uploading sample</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                      <div className="h-full rounded-full bg-blue-600 transition-[width] duration-200 ease-out" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Button type="submit" variant="primary" loading={uploading || checkingDuplicate} disabled={checkingDuplicate} polished className="w-full min-w-0">{submitLabel}</Button>
              <div ref={modelMenuRef} className="relative">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-[0_1px_1px_rgba(15,23,42,0.08)] transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-55"
                  aria-label="Choose analysis model"
                  aria-expanded={modelMenuOpen}
                  disabled={!models.length || uploading}
                  onClick={() => setModelMenuOpen((open) => !open)}
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </button>
                {modelMenuOpen ? (
                  <div className="absolute right-0 top-11 z-20 w-72 rounded-lg border border-slate-300 bg-white p-3 shadow-lg">
                    <Select
                      id="upload-model"
                      label="Analysis model"
                      value={selectedModel}
                      disabled={!models.length || uploading}
                      onChange={(event) => chooseModel(event.target.value)}
                      polished
                    >
                      {models.map((model) => (
                        <option key={model.model_id} value={model.model_id}>{model.label || model.model_id}{model.model_id === defaultModel ? ' (default)' : ''}</option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid gap-0.5">
              {selectedModel ? <p className="text-xs leading-4 text-slate-600">Model: <span className="font-mono">{selectedModel}</span></p> : null}
              <p className="text-xs leading-4 text-slate-600">After submit, analysis is immediately queued for you.</p>
            </div>
          </form>
        </Card>
        <Card polished className="min-w-0 shadow-none">
          <div className="mb-3">
            <div>
              <h2 className="text-[18px] font-semibold leading-6 text-slate-950">Sample Library <span className="ml-2 text-[13px] font-normal text-slate-600">{files.length} {files.length === 1 ? 'sample' : 'samples'}</span></h2>
              <p className="mt-1 text-[13px] text-slate-600">Files uploaded through your operator account.</p>
            </div>
          </div>
          {loading ? <LibrarySkeleton /> : <SampleLibrary files={files} copiedSha={copiedSha} copySha256={copySha256} toggleRowMenu={toggleRowMenu} />}
          {openMenu ? (
            <RowMenu
              menu={openMenu}
              onClose={() => setOpenMenu(null)}
              onCopy={() => copySha256(openMenu.file.sha256)}
            />
          ) : null}
        </Card>
      </div>
    </>
  )
}

function uploadWithProgress(path, body, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', path)
    request.withCredentials = true

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    })

    request.addEventListener('load', () => {
      const contentType = request.getResponseHeader('content-type') || ''
      let data = request.responseText
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(request.responseText || 'null')
        } catch (error) {
          reject(new Error('Upload response could not be read.'))
          return
        }
      }
      if (request.status < 200 || request.status >= 300) {
        const message = data?.error || data?.status || data?.message || `HTTP ${request.status}`
        const error = new Error(message)
        error.status = request.status
        error.data = data
        reject(error)
        return
      }
      onProgress(100)
      resolve(data)
    })

    request.addEventListener('error', () => reject(new Error('Upload failed. Check your connection and try again.')))
    request.addEventListener('abort', () => reject(new Error('Upload cancelled.')))
    request.send(body)
  })
}

async function sha256File(file) {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function LibrarySkeleton() {
  return (
    <div className="overflow-x-auto" aria-label="Loading samples">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
        <colgroup>
          {SAMPLE_COLUMNS.map((column) => <col key={column.key} className={column.width} />)}
        </colgroup>
        <thead>
          <tr className="text-left text-xs text-slate-500">
            {SAMPLE_COLUMNS.map((column) => (
              <th key={column.key} className="h-8 border-b border-slate-300 pr-5 text-[12px] font-medium first:pl-0 first:pr-1 last:pr-0 last:text-right">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2].map((item) => (
            <tr key={item} className="last:[&>td]:border-b-0">
              <td className="h-14 border-b border-slate-200 pr-1"><Skeleton className="h-5 w-12 rounded" /></td>
              <td className="h-14 border-b border-slate-200 pr-5"><Skeleton className="h-5 w-48" /></td>
              <td className="h-14 border-b border-slate-200 pr-5"><Skeleton className="h-4 w-16" /></td>
              <td className="h-14 border-b border-slate-200 pr-5 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
              <td className="h-14 border-b border-slate-200 pr-5"><Skeleton className="h-4 w-32" /></td>
              <td className="h-14 border-b border-slate-200 text-right"><Skeleton className="ml-auto h-6 w-6 rounded" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SampleLibrary({ files, copiedSha, copySha256, toggleRowMenu }) {
  if (!files.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-400 bg-slate-50 p-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">No samples uploaded yet.</p>
        <p className="mt-1 text-sm text-slate-600">Choose a file and submit it to start a private report.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
        <colgroup>
          {SAMPLE_COLUMNS.map((column) => <col key={column.key} className={column.width} />)}
        </colgroup>
        <thead>
          <tr className="text-left text-xs text-slate-500">
            {SAMPLE_COLUMNS.map((column) => (
              <th key={column.key} className={`h-8 border-b border-slate-300 text-[12px] font-medium ${column.headerClass}`} aria-label={column.ariaLabel}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr
              key={file.sha256}
              className="group last:[&>td]:border-b-0"
            >
              <td className="h-[54px] border-b border-slate-200 pr-1">
                <CompactStatusBadge tone={statusTone(displayStatus(file))}>{displayStatus(file)}</CompactStatusBadge>
              </td>
              <td className="h-[54px] max-w-[260px] border-b border-slate-200 pr-5">
                <Link className="inline-flex max-w-full items-center gap-2 text-[14px] font-semibold text-slate-950 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to={`/file/${file.sha256}`}>
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate" title={file.filename}>{file.filename}</span>
                </Link>
              </td>
              <td className="h-[54px] border-b border-slate-200 pr-5 text-right text-[13px] tabular-nums text-slate-600">{formatBytes(file.size)}</td>
              <td className="h-[54px] border-b border-slate-200 pr-5"><VisibilityLabel isPublic={file.is_public} /></td>
              <td className="h-[54px] border-b border-slate-200 pr-5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-slate-600" title={file.sha256}>{shortSha(file.sha256)}</span>
                  <button
                    type="button"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 group-hover:opacity-100 ${copiedSha === file.sha256 ? 'text-emerald-700 opacity-100' : 'text-slate-500 opacity-100 hover:bg-slate-100 hover:text-slate-700 sm:opacity-0'}`}
                    aria-label={copiedSha === file.sha256 ? `SHA-256 copied for ${file.filename}` : `Copy SHA-256 for ${file.filename}`}
                    onClick={() => copySha256(file.sha256)}
                  >
                    {copiedSha === file.sha256 ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </div>
              </td>
              <td className="h-[54px] border-b border-slate-200 text-right">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  aria-label={`Open row menu for ${file.filename}`}
                  onClick={(event) => toggleRowMenu(event, file)}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowMenu({ menu, onClose, onCopy }) {
  const file = menu.file

  return (
    <div
      className="fixed z-40 rounded-md border border-slate-300 bg-white py-1 shadow-[0_12px_28px_rgba(15,23,42,0.14)]"
      style={{ left: menu.left, top: menu.top, width: menu.width }}
      role="menu"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <Link
        className="flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
        to={`/file/${file.sha256}`}
        role="menuitem"
        onClick={onClose}
      >
        <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />
        View details
      </Link>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
        role="menuitem"
        onClick={() => {
          onCopy()
          onClose()
        }}
      >
        <Copy className="h-4 w-4 text-slate-400" aria-hidden="true" />
        Copy SHA-256
      </button>
      <a
        className="flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
        href={`/api/file/${encodeURIComponent(file.sha256)}/report.md`}
        role="menuitem"
        onClick={onClose}
      >
        <Download className="h-4 w-4 text-slate-400" aria-hidden="true" />
        Download
      </a>
    </div>
  )
}

function shortSha(sha256) {
  if (!sha256 || sha256.length <= 18) return sha256
  return `${sha256.slice(0, 10)}…${sha256.slice(-6)}`
}

function CompactStatusBadge({ children, tone }) {
  const tones = {
    success: 'border-emerald-200 bg-emerald-100 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
    primary: 'border-blue-200 bg-blue-50 text-blue-800',
    neutral: 'border-slate-300 bg-slate-100 text-slate-700',
  }

  return <span className={`inline-flex h-6 items-center rounded border px-2 text-[12px] font-medium leading-none ${tones[tone] || tones.neutral}`}>{children}</span>
}

function VisibilityLabel({ isPublic }) {
  const Icon = isPublic ? Globe2 : LockKeyhole

  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-950">
      <Icon className="h-3.5 w-3.5 text-slate-900" aria-hidden="true" />
      {isPublic ? 'Public' : 'Private'}
    </span>
  )
}
