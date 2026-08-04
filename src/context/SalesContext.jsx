import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const SalesContext = createContext(null)
export const useSales = () => useContext(SalesContext)
export const pkr = n => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

export function SalesProvider({ profile, children }) {
  const [records, setRecords] = useState([])
  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState({ gst_rate: 18, wht_rate: 5 })
  const [loading, setLoading] = useState(true)

  const calc = record => {
    const sales = Number(record.sales_value_ex_gst || 0)
    const purchase = Number(record.purchase_value || 0)
    const gst = sales * Number(settings.gst_rate || 0) / 100
    const incl = sales + gst
    const wht = sales * Number(settings.wht_rate || 0) / 100
    const net = incl - wht
    const gp = sales - purchase
    const age = record.quotation_date
      ? Math.max(0, Math.floor((new Date().setHours(0,0,0,0) - new Date(`${record.quotation_date}T00:00:00`)) / 86400000))
      : 0
    return { gst, incl, wht, net, gp, age }
  }

  async function load() {
    setLoading(true)
    const [{ data, error }, { data: settingRows }] = await Promise.all([
      supabase.from('sales_records').select('*, profiles!sales_records_user_id_fkey(full_name)').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('gst_rate,wht_rate').eq('id', 1).single()
    ])
    if (error) alert(error.message)
    setRecords(data || [])
    if (settingRows) setSettings(settingRows)
    if (profile.role === 'admin') {
      const { data: people } = await supabase.from('profiles').select('id,full_name,role,active').order('full_name')
      setUsers(people || [])
    } else {
      setUsers([{ id: profile.id, full_name: profile.full_name, role: profile.role, active: profile.active }])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [profile.id])

  async function saveRecord(form, editingId) {
    const payload = {
      customer_name: form.customer_name.trim(), quotation_date: form.quotation_date,
      purchase_value: Number(form.purchase_value || 0), item: form.item.trim(),
      sales_value_ex_gst: Number(form.sales_value_ex_gst || 0), vendor: form.vendor?.trim() || '',
      vendor_terms: form.vendor_terms?.trim() || '', quotation_status: form.quotation_status,
      probability: Math.max(0, Math.min(100, Number(form.probability || 0))), remarks: form.remarks?.trim() || '',
      user_id: profile.role === 'admin' ? form.user_id : profile.id
    }
    if (!payload.user_id) throw new Error('Please select a salesperson.')
    const query = editingId ? supabase.from('sales_records').update(payload).eq('id', editingId) : supabase.from('sales_records').insert(payload)
    const { error } = await query
    if (error) throw error
    await load()
  }

  async function deleteRecord(id) {
    const { error } = await supabase.from('sales_records').delete().eq('id', id)
    if (error) throw error
    await load()
  }

  const value = useMemo(() => ({ profile, records, users, settings, setSettings, loading, load, calc, saveRecord, deleteRecord }), [profile, records, users, settings, loading])
  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>
}
