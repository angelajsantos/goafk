export const ENDING_REASON_LABELS = {
  manual_end: 'Manual end',
  limit_reached: 'Limit reached',
  inactive_timeout: 'Inactive timeout',
  continued_after_reminder: 'Kept playing after reminder',
}

export function formatDuration(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

export function formatDateTime(value) {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleString()
}

export function formatShortDate(value) {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTimeOnly(value) {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function getEndingReasonLabel(reason) {
  return ENDING_REASON_LABELS[reason] || 'Manual end'
}
