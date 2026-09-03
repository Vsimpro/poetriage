import { forwardRef } from 'react'
import { cx } from '../../lib/cx.js'

export const Input = forwardRef(function Input({ label, hint, error, id, className, inputClassName, polished = false, ...props }, ref) {
  const helpId = hint || error ? `${id}-help` : undefined

  return (
    <label className={cx('grid gap-1.5 text-sm font-medium text-foreground', className)} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        className={cx(
          polished
            ? 'min-h-10 rounded-md border bg-white px-3 py-2 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 sm:text-sm'
            : 'min-h-11 rounded-sm border bg-white px-3 py-2 text-base text-foreground outline-none transition-colors placeholder:text-slate-500 focus:border-accent focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-70 sm:text-sm',
          error ? 'border-danger' : polished ? 'border-slate-300' : 'border-border',
          inputClassName,
        )}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={helpId}
        ref={ref}
        {...props}
      />
      {hint || error ? (
        <span id={helpId} className={cx('text-xs font-normal', error ? 'text-danger' : 'text-muted')}>
          {error || hint}
        </span>
      ) : null}
    </label>
  )
})
