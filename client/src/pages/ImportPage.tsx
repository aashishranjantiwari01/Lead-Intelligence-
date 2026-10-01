import { useState, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Info, ArrowRight, RefreshCw } from 'lucide-react'
import { importApi } from '../lib/api'
import type { ImportPreview } from '@lie/shared'
import { useQueryClient } from '@tanstack/react-query'

type Phase = 'upload' | 'preview' | 'importing' | 'done'

export default function ImportPage() {
  const [phase, setPhase] = useState<Phase>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped_duplicates: number; skipped_invalid: number; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const qc = useQueryClient()

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file')
      return
    }
    setFile(f)
    setError(null)
    setPhase('preview')

    try {
      const prev = await importApi.preview(f)
      setPreview(prev)
    } catch (err: unknown) {
      setError(`Preview failed: ${err instanceof Error ? err.message : String(err)}`)
      setPhase('upload')
    }
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleImport = async () => {
    if (!file) return
    setPhase('importing')
    try {
      const res = await importApi.import(file)
      setResult(res)
      setPhase('done')
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err: unknown) {
      setError(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
      setPhase('preview')
    }
  }

  const reset = () => {
    setPhase('upload')
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  return (
    <div className="p-8 max-w-4xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Import Leads</h1>
        <p className="text-slate-400 text-sm mt-1">Upload a CSV file to import business leads</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {['Upload', 'Preview', 'Import'].map((step, i) => {
          const stepPhases: Phase[] = ['upload', 'preview', 'done']
          const current = ['upload', 'preview', 'importing', 'done'].indexOf(phase)
          const stepIndex = i
          const active = current >= stepIndex
          return (
            <div key={step} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                active ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-500'
              }`}>
                {i + 1}
              </div>
              <span className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-600'}`}>{step}</span>
              {i < 2 && <ArrowRight className="w-3.5 h-3.5 text-slate-600" />}
            </div>
          )
        })}
      </div>

      {/* Upload Phase */}
      {phase === 'upload' && (
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-16 text-center transition-all cursor-pointer ${
              dragging
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-slate-700 hover:border-slate-500 bg-slate-900'
            }`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('csv-input')?.click()}
          >
            <Upload className={`w-12 h-12 mx-auto mb-4 ${dragging ? 'text-brand-400' : 'text-slate-600'}`} />
            <p className="text-lg font-medium text-white">Drop your CSV here</p>
            <p className="text-slate-500 text-sm mt-2">or click to browse files</p>
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-brand-400" />
              CSV Format
            </h3>
            <p className="text-xs text-slate-500 mb-2">Your CSV should include these columns (case-insensitive):</p>
            <div className="flex flex-wrap gap-2">
              {['business_name', 'category', 'country', 'city', 'address', 'phone', 'email', 'website', 'instagram', 'facebook', 'linkedin', 'source', 'source_url'].map(col => (
                <code key={col} className="text-xs bg-slate-800 px-2 py-0.5 rounded text-brand-300">{col}</code>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-3">Only <code className="text-brand-300">business_name</code> is required. All other columns are optional.</p>
          </div>
        </div>
      )}

      {/* Preview Phase */}
      {(phase === 'preview' || phase === 'importing') && preview && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary */}
          <div className="grid grid-cols-5 gap-3">
            <StatBox label="Total Rows" value={preview.total_rows} />
            <StatBox label="Valid" value={preview.valid_rows} color="text-green-400" />
            <StatBox label="Duplicates" value={preview.duplicate_rows} color="text-amber-400" />
            <StatBox label="Invalid" value={preview.invalid_rows} color="text-red-400" />
            <StatBox label="Ready to Import" value={preview.ready_to_import} color="text-brand-400" />
          </div>

          {/* Row preview */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Row Preview</h3>
              <span className="text-xs text-slate-500">{preview.rows.slice(0, 20).length} of {preview.total_rows} rows</span>
            </div>
            <div className="overflow-x-auto max-h-80 scrollbar-thin">
              <table className="table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Business</th>
                    <th>City</th>
                    <th>Website</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 20).map(row => (
                    <tr key={row.row_number}>
                      <td className="text-slate-500">{row.row_number}</td>
                      <td className="font-medium">{String(row.data.business_name ?? '—')}</td>
                      <td className="text-slate-400">{String(row.data.city ?? '—')}</td>
                      <td className="text-slate-400 text-xs">{String(row.data.website ?? '—').slice(0, 30)}</td>
                      <td>
                        <span className={
                          row.status === 'VALID' ? 'badge-reachable' :
                          row.status === 'DUPLICATE' ? 'badge-unchecked' : 'badge-error'
                        }>
                          {row.status}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500">{row.reason ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={reset} className="btn-secondary">
              Change File
            </button>
            <button
              onClick={handleImport}
              disabled={phase === 'importing' || preview.ready_to_import === 0}
              className="btn-primary"
            >
              {phase === 'importing' ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Importing...</>
              ) : (
                <><FileText className="w-4 h-4" /> Import {preview.ready_to_import} Leads</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Done Phase */}
      {phase === 'done' && result && (
        <div className="animate-fade-in space-y-4">
          <div className="card p-8 text-center">
            <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Import Complete!</h2>
            <div className="grid grid-cols-3 gap-4 mt-6 max-w-sm mx-auto">
              <StatBox label="Imported" value={result.imported} color="text-green-400" />
              <StatBox label="Duplicates" value={result.skipped_duplicates} color="text-amber-400" />
              <StatBox label="Invalid" value={result.skipped_invalid} color="text-red-400" />
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4 text-left text-xs text-red-400 bg-red-500/10 rounded-lg p-3 space-y-1">
                {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="btn-secondary">Import More</button>
            <a href="/leads" className="btn-primary">View Leads →</a>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="card p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}
