import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const markdownComponents = {
  h1: ({ children, ...props }) => <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground" {...props}>{children}</h1>,
  h2: ({ children, ...props }) => <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground" {...props}>{children}</h2>,
  h3: ({ children, ...props }) => <h3 className="text-lg font-semibold text-foreground" {...props}>{children}</h3>,
  h4: ({ children, ...props }) => <h4 className="text-base font-semibold text-foreground" {...props}>{children}</h4>,
  a: ({ children, ...props }) => <a className="font-medium text-foreground underline underline-offset-4" {...props}>{children}</a>,
  blockquote: ({ children, ...props }) => <blockquote className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800" {...props}>{children}</blockquote>,
  pre: ({ children, ...props }) => (
    <pre className="max-w-full overflow-x-auto rounded-sm border border-slate-800 bg-slate-950 p-4 text-slate-100" {...props}>{children}</pre>
  ),
  code: ({ children, className, ...props }) => {
    const isBlockCode = /language-/.test(className || '')
    return (
      <code
        className={isBlockCode ? className : 'rounded-md border border-border bg-subtle px-1.5 py-0.5 font-mono text-[0.88em] text-foreground'}
        {...props}
      >
        {children}
      </code>
    )
  },
  table: ({ children, ...props }) => (
    <div className="my-4 max-w-full overflow-x-auto rounded-sm border border-slate-300 bg-white">
      <table className="min-w-full border-collapse text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => <thead className="bg-slate-50" {...props}>{children}</thead>,
  th: ({ children, ...props }) => <th className="border-b border-r border-border px-3 py-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.04em] text-slate-600 last:border-r-0" {...props}>{children}</th>,
  td: ({ children, ...props }) => <td className="border-b border-r border-border px-3 py-2 align-top tabular-nums last:border-r-0" {...props}>{children}</td>,
}

function PolishedHeading({ level, children, ...props }) {
  const Heading = `h${level}`

  return (
    <Heading className="rounded-r-md border-l-[3px] border-blue-600 bg-blue-50/80 px-3 py-2 text-sm font-bold tracking-normal text-slate-950" {...props}>
      <span className="mr-1.5 font-mono text-blue-700" aria-hidden="true">{'#'.repeat(level)}</span>
      {children}
    </Heading>
  )
}

const polishedMarkdownComponents = {
  ...markdownComponents,
  h1: ({ children, ...props }) => <PolishedHeading level={1} {...props}>{children}</PolishedHeading>,
  h2: ({ children, ...props }) => <PolishedHeading level={2} {...props}>{children}</PolishedHeading>,
  h3: ({ children, ...props }) => <PolishedHeading level={3} {...props}>{children}</PolishedHeading>,
  h4: ({ children, ...props }) => <PolishedHeading level={4} {...props}>{children}</PolishedHeading>,
  blockquote: ({ children, ...props }) => <blockquote className="rounded-md border border-blue-300 bg-blue-50/70 px-4 py-3 text-blue-950" {...props}>{children}</blockquote>,
  pre: ({ children, ...props }) => (
    <pre className="max-w-full overflow-x-auto rounded-md border border-slate-800 bg-slate-950 p-4 text-slate-100" {...props}>{children}</pre>
  ),
  code: ({ children, className, ...props }) => {
    const isBlockCode = /language-/.test(className || '')
    return (
      <code
        className={isBlockCode ? className : 'rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[0.88em] text-slate-800'}
        {...props}
      >
        {children}
      </code>
    )
  },
  table: ({ children, ...props }) => (
    <div className="my-5 max-w-full overflow-x-auto rounded-lg border border-slate-300 bg-white">
      <table className="min-w-full border-separate border-spacing-0 text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => <thead className="bg-slate-50" {...props}>{children}</thead>,
  th: ({ children, ...props }) => <th className="border-b border-slate-300 bg-slate-50 px-3 py-2.5 text-left font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-slate-600 first:w-[32%]" {...props}>{children}</th>,
  td: ({ children, ...props }) => <td className="border-b border-slate-200 px-3 py-2.5 align-top leading-6 text-slate-700 tabular-nums last:border-r-0" {...props}>{children}</td>,
}

export function ReportMarkdown({ text, polished = false }) {
  if (!text) {
    return <div className={polished ? 'rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600' : 'rounded-sm border border-dashed border-slate-400 bg-subtle p-8 text-center text-sm text-muted'}>No analysis report is available yet.</div>
  }
  return (
    <div className={polished ? 'report-markdown report-markdown-polished min-w-0 text-sm leading-7 text-slate-700' : 'report-markdown min-w-0 text-sm text-slate-700'}>
      <ReactMarkdown components={polished ? polishedMarkdownComponents : markdownComponents} remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}
