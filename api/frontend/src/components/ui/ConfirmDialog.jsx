import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onClose,
  returnFocusRef,
}) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previousActive = document.activeElement
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(focusTimer)
      const target = returnFocusRef?.current || previousActive
      if (target && typeof target.focus === 'function') target.focus()
    }
  }, [open, returnFocusRef])

  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape' && !loading) onClose?.()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [loading, onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !loading && onClose?.()}>
      <div className="w-full max-w-md rounded-md border border-slate-300 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)] sm:p-5" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-foreground">{title}</h2>
            <p id={descriptionId} className="mt-2 break-words text-sm leading-6 text-muted">{description}</p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55"
            aria-label="Close dialog"
            disabled={loading}
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} type="button" variant="secondary" disabled={loading} onClick={onClose}>{cancelLabel}</Button>
          <Button type="button" variant={confirmVariant} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
