import { Badge } from './ui/Badge.jsx'
import { MetaRow } from './ui/MetaRow.jsx'
import { formatDuration } from '../lib/format.js'

function formatTokenCount(value) {
  return Number(value || 0).toLocaleString()
}

function formatFinalConversationTokens(value) {
  return value === null || value === undefined ? 'N/A' : Number(value).toLocaleString()
}

export function RiskScoreRow({ file }) {
  const riskScore = file.risk_score !== null && file.risk_score !== undefined ? `${file.risk_score}/100` : 'N/A'
  return <MetaRow label="Risk Score" value={riskScore} compact polished />
}

export function AnalysisMetricsRows({ file, showCost = true }) {
  const integrityBadge = file.analysis_context_rot
    ? <Badge tone="warning" polished>Possible context rot</Badge>
    : <Badge tone="success" polished>No issues detected</Badge>

  return (
    <>
      <MetaRow label="Provider" value={file.provider || 'N/A'} compact polished />
      <MetaRow label="Model" value={file.model || 'N/A'} compact polished />
      <MetaRow label="Analysis Duration" value={formatDuration(file.analysis_duration_seconds)} compact polished />
      <MetaRow label="Cumulative Tokens" value={formatTokenCount(file.token_count || file.analysis_token_count)} compact polished />
      <MetaRow label="Final Conversation Tokens" value={formatFinalConversationTokens(file.final_conversation_token_count)} compact polished />
      {showCost ? <MetaRow label="Approximate OpenRouter Cost" value={`$${Number(file.estimated_cost || 0).toFixed(4)}`} compact polished /> : null}
      <MetaRow label="Context Rot" value={integrityBadge} compact polished />
    </>
  )
}
