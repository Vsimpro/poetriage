import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { cx } from '../../lib/cx.js'

const ToastContext = createContext(null)

const durations = {
  neutral: 3500,
  success: 3500,
  warning: 5000,
  danger: 6000,
}

const tones = {
  neutral: {
    icon: Info,
    iconClass: 'text-white',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-white',
  },
  warning: {
    icon: TriangleAlert,
    iconClass: 'text-white',
  },
  danger: {
    icon: AlertCircle,
    iconClass: 'text-white',
  },
}

function createToastId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  function dismiss(id) {
    window.clearTimeout(timersRef.current.get(id))
    timersRef.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  function toast({ tone = 'neutral', title, description, duration }) {
    if (!title && !description) return null

    const id = createToastId()
    const nextToast = { id, tone, title, description }
    const timeout = window.setTimeout(() => dismiss(id), duration ?? durations[tone] ?? durations.neutral)

    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.clear()
    timersRef.current.set(id, timeout)
    setToasts([nextToast])
    return id
  }

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-50 grid w-[calc(100%-2rem)] -translate-x-1/2 justify-items-center gap-2" aria-live="polite" aria-relevant="additions">
        {toasts.map((item) => <ToastItem key={item.id} toast={item} onDismiss={() => dismiss(item.id)} />)}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

function ToastItem({ toast, onDismiss }) {
  const tone = tones[toast.tone] || tones.neutral
  const Icon = tone.icon

  return (
    <div
      className="toast-enter pointer-events-auto inline-grid w-fit max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-md bg-blue-500 px-2.5 py-1.5 text-sm text-white shadow-[0_16px_34px_rgba(59,130,246,0.24)]"
      role={toast.tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon className={cx('mt-1 h-3.5 w-3.5 shrink-0', tone.iconClass)} aria-hidden="true" />
      <div className="min-w-0 text-center">
        <p className="font-semibold leading-5">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 break-words text-sm leading-5 text-blue-50">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        className="-mr-1 -mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-blue-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  )
}
