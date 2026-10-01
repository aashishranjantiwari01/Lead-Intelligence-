import { useState } from 'react'
import { Play, RefreshCw, CheckCircle, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react'
import { useAuditQueue, useRetryAudit, useBatchAudit, useLeads } from '../hooks/useApi'
import { formatDateTime } from '../lib/utils'

type Tab = 'ALL' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export default function AuditQueuePage() {
  const [tab, setTab] = useState<Tab>('ALL')
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([])

  const { data, isLoading, refetch } = useAuditQueue()
  const retryMutation = useRetryAudit()
  const batchMutation = useBatchAudit()
  const { data: leadsData } = useLeads({ limit: 100 } as Parameters<typeof useLeads>[0])

  const jobs = data?.jobs ?? []
  const stats = data?.stats ?? {}

  const filteredJobs = tab === 'ALL' ? jobs : jobs.filter(j => j.status === tab)

  const statusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="w-4 h-4 text-amber-400" />
      case 'RUNNING': return <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
      case 'COMPLETED': return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'FAILED': return <XCircle className="w-4 h-4 text-red-400" />
      default: return <AlertCircle className="w-4 h-4 text-slate-400" />
    }
  }

  const TABS: Tab[] = ['ALL', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED']

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Queue</h1>
          <p className="text-slate-400 text-sm mt-1">Monitor website audit jobs</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] as const).map(s => (
          <div key={s} className="card p-4 text-center">
            <div className={`text-2xl font-bold ${
              s === 'PENDING' ? 'text-amber-400' :
              s === 'RUNNING' ? 'text-brand-400' :
              s === 'COMPLETED' ? 'text-green-400' : 'text-red-400'
            }`}>
              {stats[s] ?? 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">{s}</div>
          </div>
        ))}
      </div>

      {/* Batch Audit Trigger */}
      <div className="card p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-sm font-medium text-white">Batch Audit Unaudited Leads</div>
          <div className="text-xs text-slate-500 mt-0.5">Queue audits for leads that haven't been audited yet</div>
        </div>
        <button
          onClick={() => {
            const unaudited = (leadsData?.leads ?? [])
              .filter(l => l.last_audited_at === null && l.website)
              .slice(0, 20)
              .map(l => l.id)
            if (unaudited.length === 0) return
            batchMutation.mutate(unaudited)
          }}
          disabled={batchMutation.isPending}
          className="btn-primary btn-sm"
        >
          {batchMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Audit Unaudited Leads
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === t
                ? 'bg-brand-500 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t}
            <span className="ml-1.5 text-xs opacity-70">
              {t === 'ALL' ? jobs.length : jobs.filter(j => j.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Jobs Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading jobs...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400">No {tab === 'ALL' ? '' : tab.toLowerCase()} audit jobs</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Lead ID</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Error</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(job => (
                  <tr key={job.id}>
                    <td className="text-slate-500 text-xs">#{job.id}</td>
                    <td>
                      <a href={`/leads/${job.lead_id}`} className="text-brand-400 hover:text-brand-300">
                        Lead #{job.lead_id}
                      </a>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {statusIcon(job.status)}
                        <span className="text-sm">{job.status}</span>
                      </div>
                    </td>
                    <td className="text-xs text-slate-500">{formatDateTime(job.started_at)}</td>
                    <td className="text-xs text-slate-500">{formatDateTime(job.completed_at)}</td>
                    <td className="text-xs text-red-400 max-w-48 truncate" title={job.error_message ?? undefined}>
                      {job.error_message ?? '—'}
                    </td>
                    <td>
                      {job.status === 'FAILED' && (
                        <button
                          onClick={() => retryMutation.mutate(job.id)}
                          disabled={retryMutation.isPending}
                          className="btn-secondary btn-sm"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
