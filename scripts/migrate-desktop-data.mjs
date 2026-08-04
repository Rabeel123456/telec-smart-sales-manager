import fs from 'node:fs'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

function readEnvFile(path) {
  if (!fs.existsSync(path)) return {}
  return Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(line => line && !line.trim().startsWith('#')).map(line => {
    const index = line.indexOf('=')
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
  }))
}

const env = { ...readEnvFile('.env.migration'), ...process.env }
const required = ['OLD_WEB_APP_URL','OLD_SPREADSHEET_ID','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']
for (const key of required) if (!env[key]) throw new Error(`Missing ${key} in .env.migration`)

const oldRequest = async (action, extra = {}, token = '') => {
  const response = await fetch(env.OLD_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, spreadsheetId: env.OLD_SPREADSHEET_ID, sheetGid: Number(env.OLD_SHEET_GID || 523690415), token, ...extra })
  })
  const result = await response.json()
  if (!result.ok) throw new Error(result.error || `${action} failed`)
  return result
}

console.log('Logging into desktop Google Sheet backend...')
const login = await oldRequest('login', { username: env.OLD_ADMIN_USERNAME || 'admin', password: env.OLD_ADMIN_PASSWORD || 'Admin@123' })
const backup = await oldRequest('bootstrap', {}, login.session.token)
fs.writeFileSync('migration/desktop-backup.json', JSON.stringify(backup, null, 2))
console.log(`Backup saved: ${backup.records?.length || 0} records, ${backup.users?.length || 0} users.`)

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const emailFor = username => username === 'admin'
  ? (env.ADMIN_EMAIL || 'rabeel.ahmed@telec.com.pk')
  : `${String(username).toLowerCase().replace(/[^a-z0-9._-]/g,'')}@telec.local`

const userMap = new Map()
for (const oldUser of backup.users || []) {
  const email = emailFor(oldUser.username)
  let userId = null
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list.users.find(user => user.email?.toLowerCase() === email.toLowerCase())
  if (existing) userId = existing.id
  else {
    const password = oldUser.role === 'admin' ? (env.ADMIN_TEMP_PASSWORD || 'Admin@123') : (env.SALES_TEMP_PASSWORD || 'Sales@123')
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: oldUser.fullName, role: oldUser.role } })
    if (error) throw error
    userId = data.user.id
  }
  const { error: profileError } = await admin.from('profiles').upsert({ id: userId, full_name: oldUser.fullName, role: oldUser.role, active: oldUser.active !== false })
  if (profileError) throw profileError
  userMap.set(oldUser.username, userId)
  console.log(`User ready: ${oldUser.username} -> ${email}`)
}

for (const record of backup.records || []) {
  const userId = userMap.get(record.salesperson)
  if (!userId) { console.warn(`Skipped record ${record.id}: user ${record.salesperson} not found`); continue }
  const payload = {
    id: record.id,
    user_id: userId,
    customer_name: record.customer || '',
    quotation_date: record.quotationDate || new Date().toISOString().slice(0,10),
    purchase_value: Number(record.purchaseValue || 0),
    item: record.item || '',
    sales_value_ex_gst: Number(record.salesExGST || 0),
    vendor: record.vendor || '',
    vendor_terms: record.vendorTerms || '',
    quotation_status: record.status || 'Pending',
    probability: Number(record.probability ?? 75),
    remarks: record.remarks || '',
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: record.updatedAt || new Date().toISOString()
  }
  const { error } = await admin.from('sales_records').upsert(payload)
  if (error) throw error
}
console.log('Migration completed successfully.')
