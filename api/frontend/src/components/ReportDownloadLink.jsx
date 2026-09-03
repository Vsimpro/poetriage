import { buttonStyles } from './ui/Button.jsx'

export function ReportDownloadLink({ href, enabled }) {
  return (
    <a
      className={buttonStyles({
        variant: 'secondary',
        polished: true,
        className: `!h-8 px-3 text-xs ${enabled ? '' : 'pointer-events-none opacity-55'}`,
      })}
      href={href}
      aria-disabled={!enabled}
      tabIndex={enabled ? undefined : -1}
      onClick={(event) => {
        if (!enabled) event.preventDefault()
      }}
    >
      Download .md
    </a>
  )
}
