import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Building2 } from 'lucide-react'
import { useCreateLead } from '../hooks/useApi'
import { LEAD_STATUS_VALUES } from '@lie/shared'

export default function NewLeadPage() {
  const navigate = useNavigate()
  const createMutation = useCreateLead()

  const [form, setForm] = useState({
    business_name: '',
    category: '',
    country: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    instagram: '',
    facebook: '',
    linkedin: '',
    source: 'MANUAL',
    source_url: '',
    notes: '',
    lead_status: 'NEW' as const,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.business_name.trim()) {
      setErrors({ business_name: 'Business name is required' })
      return
    }

    try {
      const lead = await createMutation.mutateAsync({
        ...form,
        business_name: form.business_name.trim(),
      } as Parameters<typeof createMutation.mutateAsync>[0])
      navigate(`/leads/${lead.id}`)
    } catch (err: unknown) {
      console.error(err)
    }
  }

  return (
    <div className="p-8 max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/leads')} className="btn-ghost btn-sm p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-400" />
            Add New Lead
          </h1>
          <p className="text-sm text-slate-400">Manually enter business information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Info */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title text-base">Business Information</h2>

          <div>
            <label className="label">Business Name *</label>
            <input
              type="text"
              className={`input ${errors.business_name ? 'border-red-500' : ''}`}
              placeholder="e.g. ABC Dental GmbH"
              value={form.business_name}
              onChange={e => handleChange('business_name', e.target.value)}
            />
            {errors.business_name && <p className="text-red-400 text-xs mt-1">{errors.business_name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Dentist, Restaurant"
                value={form.category}
                onChange={e => handleChange('category', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.lead_status}
                onChange={e => handleChange('lead_status', e.target.value)}
              >
                {LEAD_STATUS_VALUES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Country</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Switzerland"
                value={form.country}
                onChange={e => handleChange('country', e.target.value)}
              />
            </div>
            <div>
              <label className="label">City</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Zurich"
                value={form.city}
                onChange={e => handleChange('city', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Address</label>
            <input
              type="text"
              className="input"
              placeholder="Street address"
              value={form.address}
              onChange={e => handleChange('address', e.target.value)}
            />
          </div>
        </div>

        {/* Contact */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title text-base">Contact Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input
                type="tel"
                className="input"
                placeholder="+41 44 123 45 67"
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="info@example.com"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Web Presence */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title text-base">Web Presence</h2>
          <div>
            <label className="label">Website</label>
            <input
              type="url"
              className="input"
              placeholder="https://example.com"
              value={form.website}
              onChange={e => handleChange('website', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Instagram</label>
              <input
                type="text"
                className="input"
                placeholder="https://instagram.com/..."
                value={form.instagram}
                onChange={e => handleChange('instagram', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Facebook</label>
              <input
                type="text"
                className="input"
                placeholder="https://facebook.com/..."
                value={form.facebook}
                onChange={e => handleChange('facebook', e.target.value)}
              />
            </div>
            <div>
              <label className="label">LinkedIn</label>
              <input
                type="text"
                className="input"
                placeholder="https://linkedin.com/..."
                value={form.linkedin}
                onChange={e => handleChange('linkedin', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Source & Notes */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title text-base">Source & Notes</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Source</label>
              <select
                className="input"
                value={form.source}
                onChange={e => handleChange('source', e.target.value)}
              >
                <option value="MANUAL">Manual Entry</option>
                <option value="CSV_IMPORT">CSV Import</option>
                <option value="REFERRAL">Referral</option>
                <option value="WEBSITE">Website</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Source URL</label>
              <input
                type="text"
                className="input"
                placeholder="Optional reference URL"
                value={form.source_url}
                onChange={e => handleChange('source_url', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Any notes about this lead..."
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate('/leads')} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={createMutation.isPending}
          >
            <Save className="w-4 h-4" />
            {createMutation.isPending ? 'Saving...' : 'Save Lead'}
          </button>
        </div>

        {createMutation.isError && (
          <p className="text-red-400 text-sm text-center">
            Failed to save lead. Please check your input and try again.
          </p>
        )}
      </form>
    </div>
  )
}
