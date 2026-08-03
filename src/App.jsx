import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import TeamReports from './pages/TeamReports'
import Settings from './pages/Settings'
import Layout from './components/Layout'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, active')
      .eq('id', userId)
      .single()
    if (error) throw error
    setProfile(data)
  }

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session) {
        try { await loadProfile(data.session.user.id) } catch (error) { console.error(error) }
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) {
        try { await loadProfile(nextSession.user.id) } catch (error) { console.error(error) }
      } else setProfile(null)
      setLoading(false)
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  if (loading) return <div className="center">Loading...</div>
  if (!session) return <Routes><Route path="*" element={<Login />} /></Routes>
  if (!profile?.active) return <div className="center">Your account is inactive. Please contact Admin.</div>

  return (
    <Layout profile={profile}>
      <Routes>
        <Route path="/" element={<Dashboard profile={profile} />} />
        <Route path="/reports" element={profile.role === 'admin' ? <TeamReports /> : <Navigate to="/" />} />
        <Route path="/users" element={profile.role === 'admin' ? <Users /> : <Navigate to="/" />} />
        <Route path="/settings" element={<Settings profile={profile} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}