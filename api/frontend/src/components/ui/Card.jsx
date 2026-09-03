import { cx } from '../../lib/cx.js'

export function Card({ children, className, compact = false, polished = false, ...props }) {
  return (
    <section
      className={cx(
        polished
          ? 'rounded border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
          : 'rounded border border-slate-400 bg-white',
        compact ? (polished ? 'p-4' : 'p-3') : (polished ? 'p-5' : 'p-4'),
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}
