import { cx } from '../../lib/cx.js'

export function Alert({ children, tone = 'neutral' }) {
  if (!children) return null
  const tones = {
    neutral: 'border-slate-200 bg-slate-50 text-muted',
    success: 'border-green-200 bg-green-50 text-green-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <p className={cx('rounded-sm border px-3 py-2 text-sm leading-6', tones[tone])} role={tone === 'danger' ? 'alert' : undefined} aria-live={tone === 'danger' ? undefined : 'polite'}>
      {children}
    </p>
  )
}
