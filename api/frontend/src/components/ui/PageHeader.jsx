export function PageHeader({ eyebrow, title, description, action, compact = false }) {
  return (
    <div className={`${compact ? 'mb-2' : 'mb-6'} flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`}>
      <div>
        {eyebrow ? <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">{eyebrow}</p> : null}
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-slate-950">{title}</h1>
        {description ? <p className={`${compact ? 'mt-1' : 'mt-2'} max-w-2xl text-sm leading-6 text-muted`}>{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  )
}
