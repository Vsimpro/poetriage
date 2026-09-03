import { cx } from '../../lib/cx.js'

export function Badge({ children, tone = 'neutral', polished = false, className }) {
  const tones = polished ? {
    neutral: 'border-slate-300 bg-slate-50 text-slate-700',
    success: 'border-green-200 bg-green-100 text-green-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-100 text-red-800',
    primary: 'border-blue-200 bg-blue-50 text-blue-700',
  } : {
    neutral: 'border-slate-300 bg-slate-100 text-slate-700',
    success: 'border-green-200 bg-green-50 text-green-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-red-200 bg-red-50 text-red-700',
    primary: 'border-blue-200 bg-blue-50 text-accent',
  }

  return <span className={cx(polished ? 'inline-flex min-h-5 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none' : 'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none', tones[tone], className)}>{children}</span>
}
