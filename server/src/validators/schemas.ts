import { z } from 'zod';
import { LEAD_STATUS_VALUES } from '@lie/shared';

export const LeadStatusEnum = z.enum([
  'NEW', 'QUALIFIED', 'CONTACTED', 'REPLIED',
  'MEETING', 'PROPOSAL', 'WON', 'LOST', 'DISQUALIFIED',
]);

export const CreateLeadSchema = z.object({
  business_name: z.string().min(1, 'Business name is required').max(500),
  category: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email('Invalid email').max(500).optional().or(z.literal('')),
  website: z.string().max(2000).optional(),
  instagram: z.string().max(500).optional(),
  facebook: z.string().max(500).optional(),
  linkedin: z.string().max(500).optional(),
  source: z.string().max(200).optional(),
  source_url: z.string().max(2000).optional(),
  notes: z.string().max(10000).optional(),
  lead_status: LeadStatusEnum.optional().default('NEW'),
});

export const UpdateLeadSchema = z.object({
  business_name: z.string().min(1).max(500).optional(),
  category: z.string().max(200).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(500).nullable().optional().or(z.literal('')),
  website: z.string().max(2000).nullable().optional(),
  instagram: z.string().max(500).nullable().optional(),
  facebook: z.string().max(500).nullable().optional(),
  linkedin: z.string().max(500).nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  source_url: z.string().max(2000).nullable().optional(),
  lead_status: LeadStatusEnum.optional(),
  notes: z.string().max(10000).nullable().optional(),
});

export const AddNoteSchema = z.object({
  note: z.string().min(1, 'Note cannot be empty').max(10000),
});

export const LeadFiltersSchema = z.object({
  search: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  lead_status: LeadStatusEnum.optional(),
  website_status: z.enum(['UNCHECKED', 'REACHABLE', 'UNREACHABLE', 'ERROR', 'REDIRECT']).optional(),
  min_score: z.coerce.number().min(0).max(100).optional(),
  max_score: z.coerce.number().min(0).max(100).optional(),
  has_email: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  has_phone: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  has_instagram: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  sort_by: z.enum(['lead_score', 'business_name', 'created_at', 'last_audited_at']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
});

export const CsvRowSchema = z.object({
  business_name: z.string().min(1, 'business_name is required'),
  category: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  linkedin: z.string().optional(),
  source: z.string().optional(),
  source_url: z.string().optional(),
});

export const BatchAuditSchema = z.object({
  lead_ids: z.array(z.number().int().positive()).min(1).max(50),
});

export const SettingsUpdateSchema = z.object({
  audit_timeout_ms: z.number().int().min(5000).max(60000).optional(),
  max_concurrent_audits: z.number().int().min(1).max(10).optional(),
  default_country: z.string().max(100).optional(),
  default_lead_status: LeadStatusEnum.optional(),
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
export type LeadFiltersInput = z.infer<typeof LeadFiltersSchema>;
export type CsvRowInput = z.infer<typeof CsvRowSchema>;
