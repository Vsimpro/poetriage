export function formatBytes(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Unknown size'
  const units = ['B', 'KB', 'MB', 'GB']
  let unitIndex = 0
  let size = number
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`
}

export function formatDate(value) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatDuration(seconds) {
  const totalSeconds = Math.round(Number(seconds))
  if (!Number.isFinite(totalSeconds)) return 'N/A'
  if (totalSeconds < 1) return '<1s'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60

  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m ${remainingSeconds}s`
  return `${remainingSeconds}s`
}

export function shortHash(value, chars = 12) {
  if (!value) return 'Unavailable'
  return `${value.slice(0, chars)}...${value.slice(-chars)}`
}
