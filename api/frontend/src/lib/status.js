export function displayStatus(file) {
  if (file?.status === 'incomplete' && file?.analysis?.trim()) return 'done'
  return file?.status
}

export function statusTone(status) {
  if (status === 'done') return 'success'
  if (status === 'error') return 'danger'
  if (status === 'queued') return 'warning'
  if (status === 'analyzing') return 'warning'
  return 'neutral'
}
