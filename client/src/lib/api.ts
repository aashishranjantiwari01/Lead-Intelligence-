import type {
  Lead,
  PaginatedLeads,
  LeadFilters,
  ParsedAudit,
  Activity,
  DashboardStats,
  ImportPreview,
  ImportResult,
} from '@lie/shared'

const BASE_URL = '/api'

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  const json = await res.json()

  if (!json.success) {
    throw new ApiError(
      json.error?.code ?? 'UNKNOWN_ERROR',
      json.error?.message ?? 'An error occurred',
      res.status
    )
  }

  return json.data as T
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: () => request<DashboardStats>('/dashboard/stats'),
}

// ── Leads ────────────────────────────────────────────────────────────────────

export const leadsApi = {
  list: (filters?: LeadFilters & { page?: number; limit?: number }) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.set(key, String(val))
        }
      })
    }
    const query = params.toString()
    return request<PaginatedLeads>(`/leads${query ? `?${query}` : ''}`)
  },

  get: (id: number) => request<Lead>(`/leads/${id}`),

  create: (data: Partial<Lead>) =>
    request<Lead>('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Lead>) =>
    request<Lead>(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<{ deleted: boolean }>(`/leads/${id}`, { method: 'DELETE' }),

  addNote: (id: number, note: string) =>
    request<{ note_added: boolean }>(`/leads/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  runAudit: (id: number) =>
    request<{ job_id: number; message: string }>(`/leads/${id}/audit`, {
      method: 'POST',
    }),

  getAudits: (id: number) => request<ParsedAudit[]>(`/leads/${id}/audit`),

  batchAudit: (lead_ids: number[]) =>
    request<{ enqueued: number[]; skipped: number[] }>('/leads/audit-batch', {
      method: 'POST',
      body: JSON.stringify({ lead_ids }),
    }),

  // CSV Export — returns a URL to trigger browser download
  exportCsvUrl: (filters?: LeadFilters) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.set(key, String(val))
        }
      })
    }
    const query = params.toString()
    return `${BASE_URL}/leads/export/csv${query ? `?${query}` : ''}`
  },
}

// ── CSV Import ───────────────────────────────────────────────────────────────

export const importApi = {
  preview: async (file: File): Promise<ImportPreview> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${BASE_URL}/leads/import?action=preview`, {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    if (!json.success) {
      throw new ApiError(json.error?.code, json.error?.message, res.status)
    }
    return json.data
  },

  import: async (file: File): Promise<ImportResult> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${BASE_URL}/leads/import?action=import`, {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    if (!json.success) {
      throw new ApiError(json.error?.code, json.error?.message, res.status)
    }
    return json.data
  },
}

// ── Activities ───────────────────────────────────────────────────────────────

export const activitiesApi = {
  list: (leadId: number) => request<Activity[]>(`/activities/${leadId}`),
}

// ── Audit Queue ──────────────────────────────────────────────────────────────

export interface AuditQueueResponse {
  jobs: Array<{
    id: number
    lead_id: number
    status: string
    started_at: string | null
    completed_at: string | null
    error_message: string | null
  }>
  stats: Record<string, number>
}

export const auditQueueApi = {
  getAll: () => request<AuditQueueResponse>('/audit-queue'),
  getStats: () => request<Record<string, number>>('/audit-queue/stats'),
  retry: (jobId: number) =>
    request<{ job_id: number; message: string }>(`/audit-queue/${jobId}/retry`, {
      method: 'POST',
    }),
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  audit_timeout_ms: number
  max_concurrent_audits: number
  default_country: string
  default_lead_status: string
}

export const settingsApi = {
  get: () => request<AppSettings>('/settings'),
  update: (data: Partial<AppSettings>) =>
    request<{ updated: boolean }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

export { ApiError }
