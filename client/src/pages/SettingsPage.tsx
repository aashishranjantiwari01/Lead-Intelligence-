import { useState, useEffect } from 'react'
import { Save, Settings as SettingsIcon, RefreshCw } from 'lucide-react'
import { useSettings, useUpdateSettings } from '../hooks/useApi'
import { LEAD_STATUS_VALUES } from '@lie/shared'

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()

  const [form, setForm] = useState({
    audit_timeout_ms: 15000,
    max_concurrent_audits: 3,
    default_country: 'Switzerland',
    default_lead_status: 'NEW',
  })

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const handleSave = async () => {
    await updateMutation.mutateAsync(form)
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-32" />
          <div className="h-48 bg-slate-800 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-brand-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 text-sm">Configure audit behavior and defaults</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Audit Settings */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title text-base">Audit Configuration</h2>

          <div>
            <label className="label">Audit Timeout (ms)</label>
            <input
              type="number"
              className="input"
              min={5000}
              max={60000}
              step={1000}
              value={form.audit_timeout_ms}
              onChange={e => setForm(f => ({ ...f, audit_timeout_ms: parseInt(e.target.value) }))}
            />
            <p className="text-xs text-slate-500 mt-1">
              How long to wait for a website to load before timing out. Default: 15000ms (15 seconds).
            </p>
          </div>

          <div>
            <label className="label">Max Concurrent Audits</label>
            <input
              type="number"
              className="input"
              min={1}
              max={10}
              value={form.max_concurrent_audits}
              onChange={e => setForm(f => ({ ...f, max_concurrent_audits: parseInt(e.target.value) }))}
            />
            <p className="text-xs text-slate-500 mt-1">
              Maximum number of website audits to run simultaneously. Higher = faster but more resource usage.
            </p>
          </div>
        </div>

        {/* Default Values */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title text-base">Defaults</h2>

          <div>
            <label className="label">Default Country</label>
            <input
              type="text"
              className="input"
              value={form.default_country}
              onChange={e => setForm(f => ({ ...f, default_country: e.target.value }))}
              placeholder="e.g. Switzerland"
            />
          </div>

          <div>
            <label className="label">Default Lead Status</label>
            <select
              className="input"
              value={form.default_lead_status}
              onChange={e => setForm(f => ({ ...f, default_lead_status: e.target.value }))}
            >
              {LEAD_STATUS_VALUES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Info */}
        <div className="card p-4 bg-brand-500/5 border-brand-500/20">
          <p className="text-sm text-slate-400">
            <strong className="text-slate-300">Note:</strong> These settings are stored locally in SQLite.
            No cloud services or external APIs are required to run this application.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="btn-primary"
          >
            {updateMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
          {updateMutation.isSuccess && (
            <span className="text-green-400 text-sm animate-fade-in">Settings saved!</span>
          )}
        </div>
      </div>
    </div>
  )
}
