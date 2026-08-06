import { BarChart3, FileBarChart, FileText, List, LogOut, MapPin, PackageCheck, PlusCircle, ReceiptText, Settings, Users } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Layout({ profile, children }) {
  const location = useLocation()
  const active = path => location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-logo">T</div><div><strong>TELEC</strong><span>Smart Sales Manager</span></div></div>
      <nav>
        <Link className={active('/') ? 'active' : ''} to="/"><BarChart3 size={18}/> Dashboard</Link>
        <Link className={active('/pipeline') ? 'active' : ''} to="/pipeline"><List size={18}/> Sales Pipeline</Link>
        <Link className={active('/opportunity') ? 'active' : ''} to="/opportunity"><PlusCircle size={18}/> Add Opportunity</Link>
        <Link className={active('/quotations') ? 'active' : ''} to="/quotations"><FileText size={18}/> Quotations</Link>
        <Link className={active('/delivery-challans') ? 'active' : ''} to="/delivery-challans"><PackageCheck size={18}/> Delivery Challans</Link>
        <Link className={active('/invoices') ? 'active' : ''} to="/invoices"><ReceiptText size={18}/> Invoices</Link>
        <Link className={active('/sales-visits') ? 'active' : ''} to="/sales-visits"><MapPin size={18}/> Sales Visit Report</Link>
        {profile.role === 'admin' && <Link className={active('/users') ? 'active' : ''} to="/users"><Users size={18}/> Users</Link>}
        {profile.role === 'admin' && <Link className={active('/reports') ? 'active' : ''} to="/reports"><FileBarChart size={18}/> Team Reports</Link>}
        <Link className={active('/settings') ? 'active' : ''} to="/settings"><Settings size={18}/> Settings</Link>
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user-label">{profile.role === 'admin' ? 'System Administrator' : profile.full_name}</div>
        <div className="sidebar-role">{profile.role === 'admin' ? 'Administrator Access' : 'Sales User'}</div>
        <button onClick={() => supabase.auth.signOut()}><LogOut size={16}/> Logout</button>
        <small>Final Version 2.0</small>
        <div className="sidebar-developer">Developed by<br/><strong>Rabeel Ahmed Siddiqui</strong></div>
      </div>
    </aside>
    <main className="main">
      <div className="main-content">{children}</div>
      <footer className="app-footer">TELEC Smart Sales Manager <span>•</span> Developed by <strong>Rabeel Ahmed Siddiqui</strong></footer>
    </main>
  </div>
}
