import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Globe, Phone, Mail, Instagram, Facebook, Linkedin,
  Play, RefreshCw, Edit3, MessageSquare, ChevronDown, CheckCircle,
  XCircle, AlertCircle, Clock, ExternalLink, Zap, TrendingUp, Target
} from 'lucide-react'
import { useLead, useLeadAudits, useRunAudit, useActivities, useUpdateLead, useAddNote } from '../hooks/useApi'
import type { ParsedAudit, Opportunity, Activity, LeadStatus } from '@lie/shared'
import {
  getLeadStatusBadgeClass, getWebsiteStatusBadgeClass,
  getScoreClass, formatDateTime, timeAgo, getDomainFromUrl
} from '../lib/utils'
import { LEAD_STATUS_VALUES } from '@lie/shared'

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const leadId = parseInt(id ?? '', 10)
  const navigate = useNavigate()

  const { data: lead, isLoading: leadLoading } = useLead(leadId)
  const { data: audits = [], isLoading: auditLoading, refetch: refetchAudits } = useLeadAudits(leadId)
  const { data: activities = [] } = useActivities(leadId)
  const auditMutation = useRunAudit()
  const updateMutation = useUpdateLead()
  const addNoteMutation = useAddNote()

  const [note, setNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const latestAudit = audits[0] ?? null

  const handleRunAudit = async () => {
    await auditMutation.mutateAsync(leadId)
    // Refetch after delay for audit to complete
    setTimeout(() => refetchAudits(), 3000)
  }

  const handleStatusChange = async (status: LeadStatus) => {
    await updateMutation.mutateAsync({ id: leadId, data: { lead_status: status } })
  }

  const handleAddNote = async () => {
    if (!note.trim()) return
    await addNoteMutation.mutateAsync({ id: leadId, note })
    setNote('')
    setAddingNote(false)
  }

  if (leadLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-64" />
          <div className="h-48 bg-slate-800 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400">Lead not found</p>
        <Link to="/leads" className="btn-primary mt-4 inline-flex">Back to Leads</Link>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/leads')} className="btn-ghost btn-sm p-2 mt-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{lead.business_name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={getLeadStatusBadgeClass(lead.lead_status)}>{lead.lead_status}</span>
              <span className={getWebsiteStatusBadgeClass(lead.website_status)}>{lead.website_status}</span>
              {lead.category && <span className="text-sm text-slate-400">{lead.category}</span>}
              {lead.city && <span className="text-sm text-slate-500">{lead.city}, {lead.country}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRunAudit}
            disabled={auditMutation.isPending}
            className="btn-primary btn-sm"
          >
            {auditMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {latestAudit ? 'Re-Audit' : 'Run Audit'}
          </button>
          <Link to={`/leads/${leadId}/edit`} className="btn-secondary btn-sm">
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </Link>
          <div className="relative">
            <select
              className="input text-sm pr-8 py-1.5 cursor-pointer"
              value={lead.lead_status}
              onChange={e => handleStatusChange(e.target.value as LeadStatus)}
            >
              {LEAD_STATUS_VALUES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-2 space-y-5">
          {/* Business Info */}
          <div className="card p-5">
            <h2 className="section-title mb-4">
              <Target className="w-4 h-4 text-brand-400" />
              Business Information
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="Business Name" value={lead.business_name} />
              <InfoRow label="Category" value={lead.category} />
              <InfoRow label="Country" value={lead.country} />
              <InfoRow label="City" value={lead.city} />
              <InfoRow label="Address" value={lead.address} full />
              <InfoRow label="Source" value={lead.source} />
            </div>
          </div>

          {/* Contact */}
          <div className="card p-5">
            <h2 className="section-title mb-4">
              <Phone className="w-4 h-4 text-brand-400" />
              Contact Details
            </h2>
            <div className="space-y-3 text-sm">
              {lead.phone && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <a href={`tel:${lead.phone}`} className="hover:text-brand-400">{lead.phone}</a>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <a href={`mailto:${lead.email}`} className="hover:text-brand-400">{lead.email}</a>
                </div>
              )}
              {lead.website && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Globe className="w-4 h-4 text-slate-500" />
                  <a href={lead.website} target="_blank" rel="noopener noreferrer"
                    className="hover:text-brand-400 flex items-center gap-1">
                    {getDomainFromUrl(lead.website)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {lead.instagram && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Instagram className="w-4 h-4 text-pink-400" />
                  <a href={lead.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-pink-400">
                    Instagram
                  </a>
                </div>
              )}
              {lead.facebook && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Facebook className="w-4 h-4 text-blue-400" />
                  <a href={lead.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                    Facebook
                  </a>
                </div>
              )}
              {lead.linkedin && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Linkedin className="w-4 h-4 text-sky-400" />
                  <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-sky-400">
                    LinkedIn
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Audit Results */}
          {latestAudit && <AuditResults audit={latestAudit} />}
          {!latestAudit && !auditLoading && (
            <div className="card p-8 text-center">
              <Zap className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No audit data yet</p>
              <p className="text-slate-600 text-sm mt-1">Click "Run Audit" to analyze this website</p>
            </div>
          )}

          {/* Notes */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">
                <MessageSquare className="w-4 h-4 text-brand-400" />
                Notes
              </h2>
              <button onClick={() => setAddingNote(true)} className="btn-ghost btn-sm">
                + Add Note
              </button>
            </div>
            {lead.notes ? (
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{lead.notes}</p>
            ) : (
              <p className="text-sm text-slate-600">No notes yet</p>
            )}
            {addingNote && (
              <div className="mt-4 space-y-2 animate-fade-in">
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Add a note..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNote}
                    disabled={addNoteMutation.isPending}
                    className="btn-primary btn-sm"
                  >
                    Save Note
                  </button>
                  <button onClick={() => { setAddingNote(false); setNote('') }} className="btn-ghost btn-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Score */}
          <div className="card p-5">
            <h2 className="section-title mb-4">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              Lead Score
            </h2>
            <div className="text-center py-3">
              <div className={`text-5xl font-black ${getScoreClass(lead.lead_score)}`}>
                {lead.lead_score ?? '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">out of 100</div>
              <div className="text-xs text-slate-600 mt-2">Internal sales-prioritization score</div>
            </div>

            {latestAudit?.opportunities && latestAudit.opportunities.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Opportunities ({latestAudit.opportunities.length})
                </div>
                {latestAudit.opportunities.map((opp, i) => (
                  <OpportunityBadge key={i} opportunity={opp} />
                ))}
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="card p-5">
            <h2 className="section-title mb-4">
              <Clock className="w-4 h-4 text-brand-400" />
              Activity Timeline
            </h2>
            {activities.length === 0 ? (
              <p className="text-sm text-slate-600">No activity yet</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
                {activities.map(activity => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, full }: { label: string; value: string | null; full?: boolean }) {
  if (!value) return null
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  )
}

function AuditResults({ audit }: { audit: ParsedAudit }) {
  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title">
          <Globe className="w-4 h-4 text-brand-400" />
          Website Audit
        </h2>
        <span className="text-xs text-slate-500">
          {new Date(audit.audited_at).toLocaleString()}
        </span>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-4 gap-3">
        <ScoreCard label="Internal Perf." score={audit.performance_score} note="Not Google PageSpeed" />
        <ScoreCard label="SEO" score={audit.seo_score} />
        <ScoreCard label="Accessibility" score={audit.accessibility_score} note="Automated check only" />
        <div className="card p-3 text-center">
          <div className="text-xs text-slate-500 mb-1">Load Time</div>
          <div className={`text-lg font-bold ${(audit.load_time_ms ?? 0) > 4000 ? 'text-red-400' : 'text-green-400'}`}>
            {audit.load_time_ms ? `${(audit.load_time_ms / 1000).toFixed(1)}s` : '—'}
          </div>
        </div>
      </div>

      {/* Feature Matrix */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Detected Features</h3>
        <div className="grid grid-cols-3 gap-2">
          <Feature label="HTTPS" value={audit.https_enabled} />
          <Feature label="Contact Form" value={audit.has_contact_form} />
          <Feature label="Booking" value={audit.has_booking} />
          <Feature label="WhatsApp" value={audit.has_whatsapp} />
          <Feature label="Clear CTA" value={audit.has_clear_cta} />
          <Feature label="Analytics" value={audit.analytics_detected} />
          <Feature label="Mobile-Friendly" value={audit.mobile_friendly ?? false} note="Heuristic" />
          <Feature label="Meta Pixel" value={audit.meta_pixel_detected} />
          <Feature label="Chat Widget" value={audit.has_chat} />
        </div>
      </div>

      {/* CMS */}
      {audit.cms_detected && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Platform detected:</span>
          <span className="badge bg-brand-500/15 text-brand-400 border border-brand-500/20">
            {audit.cms_detected}
          </span>
        </div>
      )}

      {/* Issues */}
      {audit.issues.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Issues ({audit.issues.length})
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
            {audit.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`shrink-0 mt-0.5 ${
                  issue.severity === 'HIGH' ? 'text-red-400' :
                  issue.severity === 'MEDIUM' ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {issue.severity === 'HIGH' ? '●' : issue.severity === 'MEDIUM' ? '●' : '○'}
                </span>
                <span className="text-slate-300">{issue.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreCard({ label, score, note }: { label: string; score: number | null; note?: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${getScoreClass(score)}`}>
        {score ?? '—'}
      </div>
      {note && <div className="text-xs text-slate-600 mt-0.5">{note}</div>}
    </div>
  )
}

function Feature({ label, value, note }: { label: string; value: boolean; note?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {value ? (
        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-slate-600 shrink-0" />
      )}
      <span className={value ? 'text-slate-300' : 'text-slate-500'}>
        {label}
        {note && <span className="text-slate-600 text-xs"> ({note})</span>}
      </span>
    </div>
  )
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-500/10 text-red-400 border-red-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

function OpportunityBadge({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className={`rounded-lg p-2.5 border text-xs ${PRIORITY_COLORS[opportunity.priority]}`}>
      <div className="font-semibold">{opportunity.title}</div>
      <div className="text-xs opacity-80 mt-0.5">{opportunity.reason}</div>
    </div>
  )
}

const ACTIVITY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  LEAD_IMPORTED: ({ className }) => <Zap className={className} />,
  WEBSITE_AUDITED: ({ className }) => <Globe className={className} />,
  STATUS_CHANGED: ({ className }) => <RefreshCw className={className} />,
  NOTE_ADDED: ({ className }) => <MessageSquare className={className} />,
  AUDIT_FAILED: ({ className }) => <AlertCircle className={className} />,
  MANUAL_ACTION: ({ className }) => <Target className={className} />,
  CONTACT_FOUND: ({ className }) => <Phone className={className} />,
}

function ActivityItem({ activity }: { activity: Activity }) {
  const Icon = ACTIVITY_ICONS[activity.type] ?? Clock
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-brand-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 leading-relaxed">{activity.description}</p>
        <p className="text-xs text-slate-600 mt-0.5">{timeAgo(activity.created_at)}</p>
      </div>
    </div>
  )
}
