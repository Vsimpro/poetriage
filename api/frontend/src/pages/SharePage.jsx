import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { fetchJson } from '../lib/api.js'
import { formatBytes, formatDate } from '../lib/format.js'
import { displayStatus, statusTone } from '../lib/status.js'
import { ReportDownloadLink } from '../components/ReportDownloadLink.jsx'
import { ReportMarkdown } from '../components/ReportMarkdown.jsx'
import { AnalysisMetricsRows, RiskScoreRow } from '../components/ReportMetadata.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { buttonStyles } from '../components/ui/Button.jsx'
import { Card } from '../components/ui/Card.jsx'
import { LoadingPanel } from '../components/ui/LoadingPanel.jsx'
import { MetaRow } from '../components/ui/MetaRow.jsx'

export function SharePage() {
  const { publicToken = '' } = useParams()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchJson(`/api/public/file/${encodeURIComponent(publicToken)}`)
        setFile(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [publicToken])

  if (loading) return <LoadingPanel label="Loading public report" />

  const canDownloadReport = Boolean(file?.analysis?.trim())
  const reportDownloadHref = `/api/public/file/${encodeURIComponent(publicToken)}/report.md`
  const visibleStatus = displayStatus(file)

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto min-h-dvh max-w-5xl px-4 py-6 outline-none sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Poetriage</h1>
          <p className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Public Report</p>
        </div>
        <Link className={buttonStyles({ variant: 'secondary', polished: true, className: '!h-8 px-3 text-xs' })} to="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Link>
      </div>
      {error ? (
        <Card polished><Alert tone="danger">{error}</Alert></Card>
      ) : (
        <div className="grid gap-4">
          <Card polished>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="break-words text-xl font-semibold text-slate-950">{file.filename}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ReportDownloadLink href={reportDownloadHref} enabled={canDownloadReport} />
              </div>
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card compact polished>
              <h2 className="text-base font-semibold text-slate-950">File Metadata</h2>
              <dl className="mt-2">
                <MetaRow label="Filename" value={file.filename} compact polished />
                <RiskScoreRow file={file} />
                <MetaRow label="Size" value={formatBytes(file.size)} compact polished />
                <MetaRow label="Uploaded" value={formatDate(file.uploaded_at)} compact polished />
              </dl>
            </Card>
            <Card compact polished>
              <h2 className="text-base font-semibold text-slate-950">Hashes</h2>
              <dl className="mt-2">
                <MetaRow label="MD5" value={file.md5} mono compact polished />
                <MetaRow label="SHA256" value={file.sha256} mono compact polished />
              </dl>
            </Card>
            <Card compact polished>
              <h2 className="text-base font-semibold text-slate-950">Analysis Metadata</h2>
              <dl className="mt-2">
                <MetaRow label="Status" value={<Badge tone={statusTone(visibleStatus)} polished className="!rounded-md">{visibleStatus}</Badge>} compact polished />
                <AnalysisMetricsRows file={file} showCost={false} />
              </dl>
            </Card>
          </div>
          <Card polished className="shared-report-card p-6"><ReportMarkdown text={file.analysis} polished /></Card>
        </div>
      )}
    </main>
  )
}
