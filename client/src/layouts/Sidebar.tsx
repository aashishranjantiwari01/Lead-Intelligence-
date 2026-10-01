import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Upload,
  ClipboardList,
  Settings,
  Zap,
  ChevronRight,
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/leads', icon: Users, label: 'Leads' },
  { path: '/import', icon: Upload, label: 'Import' },
  { path: '/audit-queue', icon: ClipboardList, label: 'Audit Queue' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-slate-900 border-r border-slate-700/50 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">Lead Intelligence</div>
            <div className="text-xs text-slate-500">Engine V1</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              isActive ? 'nav-item-active' : 'nav-item'
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="text-xs text-slate-600 text-center">
          Local App · No Cloud Required
        </div>
      </div>
    </aside>
  )
}
