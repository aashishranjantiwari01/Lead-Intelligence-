import {
  Users, Globe, TrendingUp, Zap, AlertTriangle, CheckCircle,
  ArrowUpRight, Clock, BarChart3
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDashboardStats } from '../hooks/useApi'
import type { LeadStatus } from '@lie/shared'

const PIPELINE_STAGES: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'NEW', label: 'New', color: 'bg-blue-500' },
  { status: 'QUALIFIED', label: 'Qualified', color: 'bg-violet-500' },
  { status: 'CONTACTED', label: 'Contacted', color: 'bg-amber-500' },
  { status: 'REPLIED', label: 'Replied', color: 'bg-orange-500' },
  { status: 'MEETING', label: 'Meeting', color: 'bg-cyan-500' },
  { status: 'PROPOSAL', label: 'Proposal', color: 'bg-indigo-500' },
  { status: 'WON', label: 'Won', color: 'bg-green-500' },
]

interface StatCardProps {
  title: string
  value: number | string
  icon: React.FC<{ className?: string }>
  iconColor: string
  description?: string
  link?: string
  change?: number
}

function StatCard({ title, value, icon: Icon, iconColor, description, link, change }: StatCardProps) {
  const content = (
    <div className="card p-5 flex items-start gap-4 group">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm font-medium text-slate-400 mt-0.5">{title}</div>
        {description && <div className="text-xs text-slate-500 mt-1">{description}</div>}
      </div>
      {link && (
        <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-brand-400 transition-colors shrink-0" />
      )}
    </div>
  )

  if (link) {
    return <Link to={link} className="block hover:opacity-90 transition-opacity">{content}</Link>
  }
  return content
}

function PipelineSummary({ pipeline }: { pipeline: Record<LeadStatus, number> }) {
  const total = Object.values(pipeline).reduce((a, b) => a + b, 0)

  return (
    <div className="card p-5">
      <div className="section-title mb-4">
        <BarChart3 className="w-5 h-5 text-brand-400" />
        Lead Pipeline
      </div>
      <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-4 bg-slate-800">
        {PIPELINE_STAGES.map(({ status, color }) => {
          const count = pipeline[status] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          if (pct === 0) return null
          return (
            <div
              key={status}
              className={`${color} h-full transition-all`}
              style={{ width: `${pct}%` }}
              title={`${status}: ${count}`}
            />
          )
        })}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PIPELINE_STAGES.map(({ status, label, color }) => {
          const count = pipeline[status] ?? 0
          return (
            <Link
              key={status}
              to={`/leads?lead_status=${status}`}
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <div className="text-lg font-bold text-white">{count}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </Link>
          )
        })}
        <Link
          to="/leads?lead_status=LOST"
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <div className="text-lg font-bold text-white">{pipeline['LOST'] ?? 0}</div>
          <div className="text-xs text-slate-500">Lost</div>
        </Link>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats()

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-28 bg-slate-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Lead Intelligence Engine — Overview</p>
        </div>
        <Link to="/leads/new" className="btn-primary">
          <Users className="w-4 h-4" />
          Add Lead
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={stats.total_leads}
          icon={Users}
          iconColor="bg-brand-500/20 text-brand-400"
          link="/leads"
        />
        <StatCard
          title="New Leads"
          value={stats.new_leads}
          icon={Zap}
          iconColor="bg-blue-500/20 text-blue-400"
          link="/leads?lead_status=NEW"
        />
        <StatCard
          title="Qualified"
          value={stats.qualified_leads}
          icon={CheckCircle}
          iconColor="bg-violet-500/20 text-violet-400"
          link="/leads?lead_status=QUALIFIED"
        />
        <StatCard
          title="Contacted"
          value={stats.contacted_leads}
          icon={TrendingUp}
          iconColor="bg-amber-500/20 text-amber-400"
          link="/leads?lead_status=CONTACTED"
        />
        <StatCard
          title="Missing Website"
          value={stats.websites_missing}
          icon={Globe}
          iconColor="bg-red-500/20 text-red-400"
          description="High opportunity leads"
          link="/leads?website_status=UNCHECKED"
        />
        <StatCard
          title="Unreachable Sites"
          value={stats.websites_unreachable}
          icon={AlertTriangle}
          iconColor="bg-orange-500/20 text-orange-400"
          link="/leads?website_status=UNREACHABLE"
        />
        <StatCard
          title="Website Opps"
          value={stats.website_opportunities}
          icon={Globe}
          iconColor="bg-cyan-500/20 text-cyan-400"
          description="Leads with audit opportunities"
        />
        <StatCard
          title="Recent Audits"
          value={stats.recent_audits}
          icon={Clock}
          iconColor="bg-green-500/20 text-green-400"
          description="Last 7 days"
          link="/audit-queue"
        />
      </div>

      {/* Pipeline */}
      <PipelineSummary pipeline={stats.pipeline} />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="section-title mb-3">
            <Upload className="w-5 h-5 text-brand-400" />
            Quick Import
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Import business leads from a CSV file to get started.
          </p>
          <Link to="/import" className="btn-primary w-full justify-center">
            Import CSV File
          </Link>
        </div>
        <div className="card p-5">
          <h2 className="section-title mb-3">
            <Zap className="w-5 h-5 text-amber-400" />
            Run Audits
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Analyze websites and identify sales opportunities for your leads.
          </p>
          <Link to="/audit-queue" className="btn-secondary w-full justify-center">
            View Audit Queue
          </Link>
        </div>
      </div>
    </div>
  )
}

// Needed for import in Dashboard
function Upload({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}
