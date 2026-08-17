import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const SalesContext = createContext(null)
export const useSales = () => useContext(SalesContext)
export const pkr = n => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

export function SalesProvider({ profile, children }) {
  const [records, setRecords] = useState([])
  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState({
    gst_rate:18, wht_rate:5, company_name:'TELEC GROUP', company_logo_url:'',
    company_address:'', company_phone:'', company_email:'', quotation_prefix:'QT',
    delivery_prefix:'DC', invoice_prefix:'INV', quotation_footer:'',
    delivery_footer:'', invoice_footer:'', company_ntn:'', company_strn:'',
    company_website:'', company_footer_left:'', company_footer_right:'',
    quotation_default_validity:'15 days from date of issue',
    quotation_default_payment_terms:'',
    quotation_intro_text:'In response to your request, we are pleased to submit our quotation as below.'
  })
  const [loading, setLoading] = useState(true)
  const lastErrorRef = useRef('')

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

  async function load({ silent = false } = {}) {
    if (!profile?.id) return
    if (!silent) setLoading(true)

    try {
      const [salesResult, peopleResult, settingsResult] = await Promise.all([
        supabase.from('sales_records').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id,full_name,role,active').order('full_name'),
        supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
      ])

      if (salesResult.error) throw new Error(`Sales data could not be loaded: ${salesResult.error.message}`)
      if (peopleResult.error) throw new Error(`User data could not be loaded: ${peopleResult.error.message}`)

      const people = peopleResult.data || []
      const profileMap = Object.fromEntries(people.map(person => [person.id, person]))

      // IMPORTANT: never clear existing records because of a transient reload error.
      // Only replace the state after a successful database read.
      const nextRecords = (salesResult.data || []).map(row => ({
        ...row,
        profiles: profileMap[row.user_id] || { full_name: 'Unknown' }
      }))
      setRecords(nextRecords)

      if (settingsResult.data) setSettings(settingsResult.data)
      setUsers(profile.role === 'admin' ? people : people.filter(person => person.id === profile.id))
      lastErrorRef.current = ''
    } catch (error) {
      console.error('SalesContext load failed:', error)
      // Do NOT do setRecords([]) here. Existing data must remain visible.
      if (lastErrorRef.current !== error.message) {
        lastErrorRef.current = error.message
        if (!silent) alert(error.message || 'Data could not be loaded.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!profile?.id) return

    load()

    // Keep multiple browser tabs/windows in sync when a sales record changes.
    const channel = supabase
      .channel(`sales-records-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_records' },
        () => load({ silent: true })
      )
      .subscribe()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') load({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  async function saveRecord(form, editingId) {
    const payload = {
      customer_name: form.customer_name.trim(),
      quotation_date: form.quotation_date,
      purchase_value: Number(form.purchase_value || 0),
      item: form.item.trim(),
      sales_value_ex_gst: Number(form.sales_value_ex_gst || 0),
      vendor: form.vendor?.trim() || '',
      vendor_terms: form.vendor_terms?.trim() || '',
      quotation_status: form.quotation_status,
      probability: Math.max(0, Math.min(100, Number(form.probability || 0))),
      remarks: form.remarks?.trim() || '',
      user_id: profile.role === 'admin' ? form.user_id : profile.id
    }

    if (!payload.user_id) throw new Error('Please select a salesperson.')

    const query = editingId
      ? supabase.from('sales_records').update(payload).eq('id', editingId).select('*').single()
      : supabase.from('sales_records').insert(payload).select('*').single()

    const { data, error } = await query
    if (error) throw error
    if (!data?.id) throw new Error('The record was not confirmed by the database.')

    // Confirm it is actually readable after the write before navigating away.
    const { data: confirmed, error: verifyError } = await supabase
      .from('sales_records')
      .select('id')
      .eq('id', data.id)
      .maybeSingle()

    if (verifyError) throw new Error(`Record saved but could not be verified: ${verifyError.message}`)
    if (!confirmed) throw new Error('Record was not readable after saving. Please check Supabase RLS policies.')

    await load({ silent: true })
    return data
  }

  async function deleteRecord(id) {
    const { error } = await supabase.from('sales_records').delete().eq('id', id)
    if (error) throw error
    await load({ silent: true })
  }

  const value = useMemo(
    () => ({ profile, records, users, settings, setSettings, loading, load, calc, saveRecord, deleteRecord }),
    [profile, records, users, settings, loading]
  )

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>
}
