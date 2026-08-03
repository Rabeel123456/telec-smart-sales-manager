import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Missing access token' })

  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !serviceRole) return res.status(500).json({ error: 'Server environment variables are missing' })

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData?.user) return res.status(401).json({ error: 'Invalid session' })

  const { data: profile } = await userClient
    .from('profiles')
    .select('role, active')
    .eq('id', userData.user.id)
    .single()

  if (profile?.role !== 'admin' || !profile?.active) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  const { email, password, full_name, role = 'sales' } = req.body || {}
  if (!email || !password || !full_name) return res.status(400).json({ error: 'Complete all user fields' })

  const admin = createClient(url, serviceRole)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role }
  })

  if (error) return res.status(400).json({ error: error.message })
  return res.status(200).json({ user: data.user })
}