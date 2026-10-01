import { useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search, Filter, Download, Plus, Globe, Phone, Mail,
  Instagram, ChevronUp, ChevronDown, MoreVertical, Trash2, Play
} from 'lucide-react'
import { useLeads, useDeleteLead, useRunAudit } from '../hooks/useApi'
import { leadsApi } from '../lib/api'
import type { Lead, LeadStatus, WebsiteStatus } from '@lie/shared'
import {
  getLeadStatusBadgeClass, getWebsiteStatusBadgeClass,
  getScoreClass, formatDate, truncate, getDomainFromUrl
} from '../lib/utils'
import { LEAD_STATUS_VALUES } from '@lie/shared'

type SortField = 'lead_score' | 'business_name' | 'created_at' | 'last_audited_at'

export default function LeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [sortBy, setSortBy] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  const filters = {
    search: search || undefined,
    lead_status: (searchParams.get('lead_status') as LeadStatus) || undefined,
    website_status: (searchParams.get('website_status') as WebsiteStatus) || undefined,
    country: searchParams.get('country') || undefined,
    has_email: searchParams.get('has_email') === 'true' ? true : undefined,
    has_phone: searchParams.get('has_phone') === 'true' ? true : undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
  }

  const { data, isLoading } = useLeads(filters)
  const deleteMutation = useDeleteLead()
  const auditMutation = useRunAudit()

  const leads = data?.leads ?? []
  const total = data?.total ?? 0

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleExport = () => {
    const url = leadsApi.exportCsvUrl(filters)
    window.open(url, '_blank')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this lead? This cannot be undone.')) return
    await deleteMutation.mutateAsync(id)
  }

  return (
    <div className="p-8 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-sm text-slate-400 mt-1">{total.toLocaleString()} total leads</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="btn-secondary btn-sm">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <Link to="/leads/new" className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
            Add Lead
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search business name, city, website, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={showFilters ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-700/50 animate-fade-in">
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={searchParams.get('lead_status') ?? ''}
                onChange={e => {
                  const p = new URLSearchParams(searchParams)
                  e.target.value ? p.set('lead_status', e.target.value) : p.delete('lead_status')
                  setSearchParams(p)
                }}
              >
                <option value="">All Statuses</option>
                {LEAD_STATUS_VALUES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Website Status</label>
              <select
                className="input"
                value={searchParams.get('website_status') ?? ''}
                onChange={e => {
                  const p = new URLSearchParams(searchParams)
                  e.target.value ? p.set('website_status', e.target.value) : p.delete('website_status')
                  setSearchParams(p)
                }}
              >
                <option value="">All</option>
                <option value="REACHABLE">Reachable</option>
                <option value="UNREACHABLE">Unreachable</option>
                <option value="UNCHECKED">Unchecked</option>
                <option value="ERROR">Error</option>
              </select>
            </div>
            <div>
              <label className="label">Contact Info</label>
              <div className="flex gap-2">
                <label className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox"
                    checked={searchParams.get('has_email') === 'true'}
                    onChange={e => {
                      const p = new URLSearchParams(searchParams)
                      e.target.checked ? p.set('has_email', 'true') : p.delete('has_email')
                      setSearchParams(p)
                    }}
                    className="rounded"
                  />
                  Has Email
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox"
                    checked={searchParams.get('has_phone') === 'true'}
                    onChange={e => {
                      const p = new URLSearchParams(searchParams)
                      e.target.checked ? p.set('has_phone', 'true') : p.delete('has_phone')
                      setSearchParams(p)
                    }}
                    className="rounded"
                  />
                  Has Phone
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-lg animate-fade-in">
          <span className="text-sm text-brand-300">{selectedIds.size} selected</span>
          <button
            onClick={() => {
              leadsApi.batchAudit(Array.from(selectedIds))
              setSelectedIds(new Set())
            }}
            className="btn-primary btn-sm"
          >
            <Play className="w-3.5 h-3.5" />
            Audit Selected
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="btn-ghost btn-sm">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No leads found</p>
            <p className="text-slate-600 text-sm mt-1">Try importing a CSV or adding leads manually</p>
            <Link to="/import" className="btn-primary mt-4 inline-flex">Import CSV</Link>
          </div>
        ) : (
          <div className="table-container scrollbar-thin">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === leads.length && leads.length > 0}
                      onChange={e => setSelectedIds(e.target.checked ? new Set(leads.map(l => l.id)) : new Set())}
                      className="rounded"
                    />
                  </th>
                  <th>
                    <button onClick={() => handleSort('business_name')} className="flex items-center gap-1 hover:text-white">
                      Business <SortIcon field="business_name" />
                    </button>
                  </th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Website</th>
                  <th>Status</th>
                  <th>
                    <button onClick={() => handleSort('lead_score')} className="flex items-center gap-1 hover:text-white">
                      Score <SortIcon field="lead_score" />
                    </button>
                  </th>
                  <th>Contact</th>
                  <th>
                    <button onClick={() => handleSort('last_audited_at')} className="flex items-center gap-1 hover:text-white">
                      Audited <SortIcon field="last_audited_at" />
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    selected={selectedIds.has(lead.id)}
                    onSelect={() => toggleSelect(lead.id)}
                    onDelete={() => handleDelete(lead.id)}
                    onAudit={() => auditMutation.mutate(lead.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function LeadRow({
  lead, selected, onSelect, onDelete, onAudit
}: {
  lead: Lead
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  onAudit: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const domain = getDomainFromUrl(lead.website)

  return (
    <tr className="group">
      <td>
        <input type="checkbox" checked={selected} onChange={onSelect} className="rounded" />
      </td>
      <td>
        <Link to={`/leads/${lead.id}`} className="font-medium text-white hover:text-brand-400 transition-colors">
          {lead.business_name}
        </Link>
        {lead.notes && <div className="text-xs text-slate-500 mt-0.5">{truncate(lead.notes, 40)}</div>}
      </td>
      <td>
        <span className="text-slate-400 text-xs">{lead.category ?? '—'}</span>
      </td>
      <td>
        <div className="text-sm">{lead.city ?? '—'}</div>
        <div className="text-xs text-slate-500">{lead.country ?? ''}</div>
      </td>
      <td>
        {domain ? (
          <a href={lead.website!} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
            <Globe className="w-3 h-3" />
            {truncate(domain, 25)}
          </a>
        ) : (
          <span className="text-xs text-slate-600">No website</span>
        )}
        <div className="mt-1">
          <span className={getWebsiteStatusBadgeClass(lead.website_status)}>
            {lead.website_status}
          </span>
        </div>
      </td>
      <td>
        <span className={getLeadStatusBadgeClass(lead.lead_status)}>
          {lead.lead_status}
        </span>
      </td>
      <td>
        {lead.lead_score !== null ? (
          <span className={`text-lg font-bold ${getScoreClass(lead.lead_score)}`}>
            {lead.lead_score}
          </span>
        ) : (
          <span className="text-slate-600 text-sm">—</span>
        )}
      </td>
      <td>
        <div className="flex items-center gap-2">
          {lead.email && <span title={lead.email}><Mail className="w-3.5 h-3.5 text-slate-400" /></span>}
          {lead.phone && <span title={lead.phone}><Phone className="w-3.5 h-3.5 text-slate-400" /></span>}
          {lead.instagram && <span title="Instagram"><Instagram className="w-3.5 h-3.5 text-pink-400" /></span>}
        </div>
      </td>
      <td>
        <span className="text-xs text-slate-500">
          {lead.last_audited_at ? formatDate(lead.last_audited_at) : 'Never'}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-1">
          <Link to={`/leads/${lead.id}`} className="btn-ghost btn-sm px-2">View</Link>
          <button onClick={onAudit} className="btn-ghost btn-sm px-2" title="Run Audit">
            <Play className="w-3.5 h-3.5 text-brand-400" />
          </button>
          <button onClick={onDelete} className="btn-ghost btn-sm px-2" title="Delete">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// Needed for Users icon in empty state
function Users({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}
