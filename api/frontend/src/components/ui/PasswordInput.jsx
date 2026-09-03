import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cx } from '../../lib/cx.js'

export const PasswordInput = forwardRef(function PasswordInput({ label, hint, error, id, className, polished = false, ...props }, ref) {
  const [visible, setVisible] = useState(false)
  const helpId = hint || error ? `${id}-help` : undefined

  return (
    <label className={cx('grid gap-1.5 text-sm font-medium text-foreground', className)} htmlFor={id}>
      <span>{label}</span>
      <span className="relative block">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={cx(
            polished
              ? 'min-h-10 w-full rounded-md border bg-white py-2 pl-3 pr-12 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 sm:text-sm'
              : 'min-h-11 w-full rounded-sm border bg-white py-2 pl-3 pr-12 text-base text-foreground outline-none transition-colors placeholder:text-slate-500 focus:border-accent focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-70 sm:text-sm',
            error ? 'border-danger' : polished ? 'border-slate-300' : 'border-border',
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={helpId}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          className={cx('absolute right-1 top-1/2 inline-flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center text-muted transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent', polished ? 'rounded-md' : 'rounded-sm')}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </span>
      {hint || error ? (
        <span id={helpId} className={cx('text-xs font-normal', error ? 'text-danger' : 'text-muted')}>
          {error || hint}
        </span>
      ) : null}
    </label>
  )
})
