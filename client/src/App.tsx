import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import LeadsPage from './pages/LeadsPage'
import LeadDetailPage from './pages/LeadDetailPage'
import NewLeadPage from './pages/NewLeadPage'
import ImportPage from './pages/ImportPage'
import AuditQueuePage from './pages/AuditQueuePage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/new" element={<NewLeadPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="leads/:id/edit" element={<NewLeadPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="audit-queue" element={<AuditQueuePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
