import { cx } from '../../lib/cx.js'

export function MetaRow({ label, value, mono = false, compact = false, polished = false }) {
  return (
    <div className={cx('grid min-w-0 gap-1 border-b last:border-b-0', polished ? 'border-slate-300' : 'border-border', compact ? 'py-2' : 'py-3')}>
      <dt className={cx('font-mono text-[11px] uppercase text-slate-600', polished ? 'font-bold tracking-[0.04em]' : 'tracking-[0.08em]')}>{label}</dt>
      <dd className={cx('min-w-0 break-words text-sm text-foreground', polished && 'leading-5 text-slate-950', mono && 'break-all font-mono text-xs')}>{value ?? 'Unavailable'}</dd>
    </div>
  )
}
