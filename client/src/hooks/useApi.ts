import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leadsApi, dashboardApi, activitiesApi, auditQueueApi, settingsApi } from '../lib/api'
import type { LeadFilters } from '@lie/shared'

// ── Dashboard ─────────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 30_000,
  })
}

// ── Leads ─────────────────────────────────────────────────────────────────

export function useLeads(filters?: LeadFilters & { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: () => leadsApi.list(filters),
    placeholderData: prev => prev,
  })
}

export function useLead(id: number | null) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.get(id!),
    enabled: id !== null,
  })
}

export function useLeadAudits(leadId: number | null) {
  return useQuery({
    queryKey: ['audits', leadId],
    queryFn: () => leadsApi.getAudits(leadId!),
    enabled: leadId !== null,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof leadsApi.update>[1] }) =>
      leadsApi.update(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead', vars.id] })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leadsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useRunAudit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leadsApi.runAudit,
    onSuccess: (_, leadId) => {
      // Poll for audit completion
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['lead', leadId] })
        qc.invalidateQueries({ queryKey: ['audits', leadId] })
        qc.invalidateQueries({ queryKey: ['audit-queue'] })
      }, 2000)
    },
  })
}

export function useAddNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => leadsApi.addNote(id, note),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead', vars.id] })
      qc.invalidateQueries({ queryKey: ['activities', vars.id] })
    },
  })
}

// ── Activities ────────────────────────────────────────────────────────────

export function useActivities(leadId: number | null) {
  return useQuery({
    queryKey: ['activities', leadId],
    queryFn: () => activitiesApi.list(leadId!),
    enabled: leadId !== null,
    refetchInterval: 10_000,
  })
}

// ── Audit Queue ───────────────────────────────────────────────────────────

export function useAuditQueue() {
  return useQuery({
    queryKey: ['audit-queue'],
    queryFn: auditQueueApi.getAll,
    refetchInterval: 3_000, // Poll every 3s to show live updates
  })
}

export function useRetryAudit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: auditQueueApi.retry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-queue'] })
    },
  })
}

export function useBatchAudit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leadsApi.batchAudit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-queue'] })
    },
  })
}

// ── Settings ──────────────────────────────────────────────────────────────

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}
