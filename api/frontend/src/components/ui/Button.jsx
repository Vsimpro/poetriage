import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cx } from '../../lib/cx.js'

export function buttonStyles({ variant = 'neutral', className, polished = false } = {}) {
  const variants = polished ? {
    primary: 'border-blue-600 bg-blue-600 text-white shadow-[0_1px_1px_rgba(15,23,42,0.08)] hover:border-blue-700 hover:bg-blue-700 active:border-blue-800 active:bg-blue-800',
    secondary: 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100',
    neutral: 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100',
    danger: 'border-red-600 bg-red-600 text-white shadow-sm hover:border-red-700 hover:bg-red-700 active:bg-red-800',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200',
  } : {
    primary: 'border-accent bg-accent text-white shadow-sm hover:border-blue-700 hover:bg-blue-700 active:border-blue-800 active:bg-blue-800',
    secondary: 'border-blue-200 bg-blue-50 text-accent shadow-sm hover:border-blue-300 hover:bg-blue-100 active:bg-blue-200',
    neutral: 'border-border bg-white text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100',
    danger: 'border-red-600 bg-red-600 text-white shadow-sm hover:border-red-700 hover:bg-red-700 active:bg-red-800',
    ghost: 'border-transparent bg-transparent text-muted hover:bg-subtle hover:text-foreground active:bg-slate-200',
  }

  return cx(
    polished
      ? 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-55'
      : 'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55',
    variants[variant],
    className,
  )
}

export const Button = forwardRef(function Button({ children, className, variant = 'neutral', loading = false, disabled = false, polished = false, ...props }, ref) {
  return (
    <button
      className={buttonStyles({ variant, className, polished })}
      disabled={disabled || loading}
      ref={ref}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  )
})
