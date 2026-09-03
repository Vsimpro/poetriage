import { Loader2 } from 'lucide-react'

export function LoadingPanel({ label = 'Loading console state' }) {
  return (
    <div className="grid min-h-[50vh] place-items-center px-4">
      <div className="flex items-center gap-3 rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  )
}
