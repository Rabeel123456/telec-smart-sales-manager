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
  const errorShown = useRef('')

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

    // IMPORTANT:
    // Load sales independently. A missing/duplicate app_settings row or a
    // temporary profiles error must NEVER erase sales records from the UI.
    try {
      const { data: salesRows, error: salesError } = await supabase
        .from('sales_records')
        .select('*')
        .order('created_at', { ascending: false })

      if (salesError) throw salesError

      const { data: people, error: peopleError } = await supabase
        .from('profiles')
        .select('id,full_name,role,active')
        .order('full_name')

      const profileMap = Object.fromEntries((people || []).map(person => [person.id, person]))

      // Only replace records after a successful sales_records query.
      // Never use setRecords([]) for a secondary query failure.
      setRecords((salesRows || []).map(row => ({
        ...row,
        profiles: profileMap[row.user_id] || { full_name: 'Unknown' }
      })))

      if (!peopleError) {
        setUsers(
          profile.role === 'admin'
            ? (people || [])
            : (people || []).filter(person => person.id === profile.id)
        )
      }

      // Settings are optional for loading sales. maybeSingle() avoids the
      // "JSON object requested, multiple/no rows returned" error from .single().
      const { data: settingRow, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()

      if (!settingsError && settingRow) {
        setSettings(settingRow)
      }

      errorShown.current = ''
    } catch (error) {
      console.error('SalesContext load error:', error)

      // CRITICAL: do not clear records here.
      // If Supabase temporarily fails, the last known records stay visible.
      if (!silent && errorShown.current !== error.message) {
        errorShown.current = error.message
        alert(error.message || 'Sales data could not be loaded.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!profile?.id) return

    load()

    // When returning to this tab/window, refresh from Supabase.
    // This does not clear the current state if the refresh fails.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load({ silent: true })
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Keep multiple browser tabs/windows synchronized.
    const channel = supabase
      .channel(`telec-sales-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_records' },
        () => load({ silent: true })
      )
      .subscribe()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
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

    let result
    if (editingId) {
      result = await supabase
        .from('sales_records')
        .update(payload)
        .eq('id', editingId)
        .select('*')
        .single()
    } else {
      result = await supabase
        .from('sales_records')
        .insert(payload)
        .select('*')
        .single()
    }

    if (result.error) throw result.error
    if (!result.data?.id) throw new Error('The database did not confirm the saved record.')

    // Verify the record is readable immediately after saving.
    const { data: verified, error: verifyError } = await supabase
      .from('sales_records')
      .select('id')
      .eq('id', result.data.id)
      .maybeSingle()

    if (verifyError) throw new Error(`Saved, but verification failed: ${verifyError.message}`)
    if (!verified) throw new Error('Saved, but the record is not readable under the current Supabase RLS policy.')

    await load({ silent: true })
    return result.data
  }

  async function deleteRecord(id) {
    const { error } = await supabase
      .from('sales_records')
      .delete()
      .eq('id', id)

    if (error) throw error
    await load({ silent: true })
  }

  const value = useMemo(
    () => ({ profile, records, users, settings, setSettings, loading, load, calc, saveRecord, deleteRecord }),
    [profile, records, users, settings, loading]
  )

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>
}
