import { BarChart3, LogOut, Users, FileBarChart, Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Layout({ profile, children }) {
  const location = useLocation()
  async function logout() { await supabase.auth.signOut() }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">T</div>
          <div><strong>TELEC</strong><span>Smart Sales Manager</span></div>
        </div>
        <nav>
          <Link className={location.pathname === '/' ? 'active' : ''} to="/"><BarChart3 size={18}/> Dashboard</Link>
          {profile.role === 'admin' && <Link className={location.pathname === '/reports' ? 'active' : ''} to="/reports"><FileBarChart size={18}/> Team Reports</Link>}
          {profile.role === 'admin' && <Link className={location.pathname === '/users' ? 'active' : ''} to="/users"><Users size={18}/> Users</Link>}
          <Link className={location.pathname === '/settings' ? 'active' : ''} to="/settings"><Settings size={18}/> Settings</Link>
        </nav>
        <div className="sidebar-footer">
          <div>{profile.full_name}</div><small>{profile.role}</small>
          <button onClick={logout}><LogOut size={16}/> Logout</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}