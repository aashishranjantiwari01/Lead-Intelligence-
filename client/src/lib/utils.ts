import type { LeadStatus, WebsiteStatus } from '@lie/shared'

export function getLeadStatusBadgeClass(status: LeadStatus): string {
  const map: Record<LeadStatus, string> = {
    NEW: 'badge-new',
    QUALIFIED: 'badge-qualified',
    CONTACTED: 'badge-contacted',
    REPLIED: 'badge-replied',
    MEETING: 'badge-meeting',
    PROPOSAL: 'badge-proposal',
    WON: 'badge-won',
    LOST: 'badge-lost',
    DISQUALIFIED: 'badge-disqualified',
  }
  return map[status] ?? 'badge'
}

export function getWebsiteStatusBadgeClass(status: WebsiteStatus): string {
  const map: Record<WebsiteStatus, string> = {
    REACHABLE: 'badge-reachable',
    UNREACHABLE: 'badge-unreachable',
    UNCHECKED: 'badge-unchecked',
    ERROR: 'badge-error',
    REDIRECT: 'badge-reachable',
  }
  return map[status] ?? 'badge'
}

export function getScoreClass(score: number | null): string {
  if (score === null) return 'text-slate-400'
  if (score >= 70) return 'score-high'
  if (score >= 40) return 'score-medium'
  return 'score-low'
}

export function getScoreLabel(score: number | null): string {
  if (score === null) return 'N/A'
  if (score >= 70) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = now - d
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}

export function truncate(str: string | null, len: number): string {
  if (!str) return '—'
  if (str.length <= len) return str
  return `${str.slice(0, len)}...`
}

export function getDomainFromUrl(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
