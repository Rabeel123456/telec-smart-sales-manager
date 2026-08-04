import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SalesPipeline from './pages/SalesPipeline'
import Opportunity from './pages/Opportunity'
import Users from './pages/Users'
import TeamReports from './pages/TeamReports'
import Settings from './pages/Settings'
import Documents from './pages/Documents'
import SalesVisits from './pages/SalesVisits'
import Layout from './components/Layout'
import { SalesProvider } from './context/SalesContext'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('id,full_name,role,active').eq('id', userId).single()
    if (error) throw error
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) try { await loadProfile(data.session.user.id) } catch (e) { console.error(e) }
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) try { await loadProfile(nextSession.user.id) } catch (e) { console.error(e) }
      else setProfile(null)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="center">Loading...</div>
  if (!session) return <Routes><Route path="*" element={<Login />} /></Routes>
  if (!profile?.active) return <div className="center">Your account is inactive. Please contact Admin.</div>

  return <SalesProvider profile={profile}><Layout profile={profile}><Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/pipeline" element={<SalesPipeline />} />
    <Route path="/opportunity" element={<Opportunity />} />
    <Route path="/opportunity/:id" element={<Opportunity />} />
    <Route path="/quotations" element={<Documents type="quotation" />} />
    <Route path="/delivery-challans" element={<Documents type="delivery" />} />
    <Route path="/invoices" element={<Documents type="invoice" />} />
    <Route path="/sales-visits" element={<SalesVisits />} />
    <Route path="/reports" element={profile.role === 'admin' ? <TeamReports /> : <Navigate to="/" />} />
    <Route path="/users" element={profile.role === 'admin' ? <Users /> : <Navigate to="/" />} />
    <Route path="/settings" element={<Settings profile={profile} />} />
    <Route path="*" element={<Navigate to="/" />} />
  </Routes></Layout></SalesProvider>
}
