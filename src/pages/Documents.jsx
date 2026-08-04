import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Download, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { pkr, useSales } from '../context/SalesContext'

const today = () => new Date().toISOString().slice(0, 10)
const emptyCommercial = {
  customer_name: '', item: '', purchase_value: '', sales_value_ex_gst: '',
  vendor: '', vendor_terms: '', probability: 75, remarks: '', user_id: ''
}

const CONFIG = {
  quotation: {
    title: 'Quotations', singular: 'Quotation', table: 'quotations',
    prefixKey: 'quotation_prefix', footerKey: 'quotation_footer',
    statuses: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled']
  },
  delivery: {
    title: 'Delivery Challans', singular: 'Delivery Challan', table: 'delivery_challans',
    prefixKey: 'delivery_prefix', footerKey: 'delivery_footer',
    statuses: ['Draft', 'Pending', 'Delivered', 'Cancelled']
  },
  invoice: {
    title: 'Invoices', singular: 'Invoice', table: 'invoices',
    prefixKey: 'invoice_prefix', footerKey: 'invoice_footer',
    statuses: ['Draft', 'Issued', 'Paid', 'Cancelled']
  }
}

export default function Documents({ type }) {
  const cfg = CONFIG[type]
  const { profile, records, users, settings, calc, load: reloadSales } = useSales()
  const [rows, setRows] = useState([])
  const [quotations, setQuotations] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    ...emptyCommercial, opportunity_id: '', quotation_id: '', delivery_challan_id: '',
    document_no: '', document_date: today(), status: 'Draft'
  })

  const salesUsers = users.filter(u => u.role === 'sales' && u.active)
  const userName = id => users.find(u => u.id === id)?.full_name || ''

  async function load() {
    const [{ data, error }, { data: qs }, { data: ds }] = await Promise.all([
      supabase.from(cfg.table).select('*').order('created_at', { ascending: false }),
      supabase.from('quotations').select('*').order('created_at', { ascending: false }),
      supabase.from('delivery_challans').select('*').order('created_at', { ascending: false })
    ])
    if (error) return alert(error.message)
    setRows(data || [])
    setQuotations(qs || [])
    setDeliveries(ds || [])
  }

  useEffect(() => {
    load()
    setShowForm(false)
    setEditingId(null)
  }, [type])

  const opportunityMap = useMemo(() => Object.fromEntries(records.map(r => [r.id, r])), [records])

  const filtered = rows.filter(row => {
    const text = `${row.document_no || ''} ${row.status || ''} ${row.customer_name || ''} ${row.item || ''}`.toLowerCase()
    return text.includes(search.toLowerCase())
  })

  function nextNumber() {
    const prefix = settings?.[cfg.prefixKey] || ({ quotation: 'QT', delivery: 'DC', invoice: 'INV' })[type]
    const year = new Date().getFullYear()
    const next = String(rows.length + 1).padStart(4, '0')
    return `${prefix}-${year}-${next}`
  }

  function reset() {
    setForm({
      ...emptyCommercial,
      user_id: profile.role === 'admin' ? '' : profile.id,
      opportunity_id: '', quotation_id: '', delivery_challan_id: '',
      document_no: nextNumber(), document_date: today(), status: 'Draft'
    })
    setEditingId(null)
    setShowForm(true)
  }

  function copyCommercial(source, extra = {}) {
    return {
      ...form,
      user_id: source.user_id || '', opportunity_id: source.opportunity_id || source.id || '',
      customer_name: source.customer_name || '', item: source.item || '',
      purchase_value: source.purchase_value ?? '', sales_value_ex_gst: source.sales_value_ex_gst ?? '',
      vendor: source.vendor || '', vendor_terms: source.vendor_terms || '',
      probability: source.probability ?? 75, remarks: source.remarks || '', ...extra
    }
  }

  function chooseQuotation(id) {
    const q = quotations.find(x => x.id === id)
    if (!q) return setForm({ ...form, quotation_id: id })
    setForm(copyCommercial(q, { quotation_id: q.id, opportunity_id: q.opportunity_id, remarks: '' }))
  }

  function chooseDelivery(id) {
    const d = deliveries.find(x => x.id === id)
    if (!d) return setForm({ ...form, delivery_challan_id: id })
    setForm(copyCommercial(d, {
      delivery_challan_id: d.id, quotation_id: d.quotation_id,
      opportunity_id: d.opportunity_id, remarks: ''
    }))
  }

  function edit(row) {
    setForm({
      ...emptyCommercial, ...row,
      purchase_value: row.purchase_value ?? '', sales_value_ex_gst: row.sales_value_ex_gst ?? '',
      probability: row.probability ?? 75
    })
    setEditingId(row.id)
    setShowForm(true)
  }

  async function upsertOpportunity() {
    const payload = {
      user_id: profile.role === 'admin' ? form.user_id : profile.id,
      customer_name: form.customer_name.trim(), quotation_date: form.document_date,
      purchase_value: Number(form.purchase_value || 0), item: form.item.trim(),
      sales_value_ex_gst: Number(form.sales_value_ex_gst || 0),
      vendor: form.vendor?.trim() || '', vendor_terms: form.vendor_terms?.trim() || '',
      quotation_status: form.status === 'Draft' ? 'Pending' : 'Submitted',
      probability: Math.max(0, Math.min(100, Number(form.probability || 0))),
      remarks: form.remarks?.trim() || ''
    }
    if (!payload.user_id) throw new Error('Please select a salesperson.')

    if (form.opportunity_id) {
      const { error } = await supabase.from('sales_records').update(payload).eq('id', form.opportunity_id)
      if (error) throw error
      return form.opportunity_id
    }

    const { data, error } = await supabase.from('sales_records').insert(payload).select('id').single()
    if (error) throw error
    return data.id
  }

  async function save(e) {
    e.preventDefault()
    try {
      let opportunityId = form.opportunity_id

      if (type === 'quotation') {
        opportunityId = await upsertOpportunity()
      } else if (type === 'delivery' && !form.quotation_id) {
        throw new Error('First select a Quotation. Delivery Challan cannot be created before Quotation.')
      } else if (type === 'invoice' && !form.delivery_challan_id) {
        throw new Error('First select a Delivery Challan. Invoice cannot be created before Delivery Challan.')
      }

      const payload = {
        user_id: profile.role === 'admin' ? form.user_id : profile.id,
        opportunity_id: opportunityId,
        document_no: form.document_no.trim(), document_date: form.document_date,
        status: form.status, remarks: form.remarks?.trim() || '',
        customer_name: form.customer_name.trim(), item: form.item.trim(),
        purchase_value: Number(form.purchase_value || 0),
        sales_value_ex_gst: Number(form.sales_value_ex_gst || 0),
        vendor: form.vendor?.trim() || '', vendor_terms: form.vendor_terms?.trim() || '',
        probability: Math.max(0, Math.min(100, Number(form.probability || 0)))
      }
      if (type === 'delivery') payload.quotation_id = form.quotation_id
      if (type === 'invoice') {
        payload.quotation_id = form.quotation_id
        payload.delivery_challan_id = form.delivery_challan_id
      }

      const query = editingId
        ? supabase.from(cfg.table).update(payload).eq('id', editingId)
        : supabase.from(cfg.table).insert(payload)
      const { error } = await query
      if (error) throw error

      if (type === 'invoice') {
        const { error: closeError } = await supabase.from('sales_records').update({
          quotation_status: 'Won', probability: 100, closing_date: form.document_date
        }).eq('id', opportunityId)
        if (closeError) throw closeError
      }

      setShowForm(false)
      await Promise.all([load(), reloadSales()])
    } catch (error) {
      alert(error.message)
    }
  }

  async function remove(id) {
    if (!confirm(`Delete this ${cfg.singular}?`)) return
    const { error } = await supabase.from(cfg.table).delete().eq('id', id)
    if (error) alert(error.message)
    else load()
  }

  function documentCalc(row) {
    return calc({
      purchase_value: row.purchase_value,
      sales_value_ex_gst: row.sales_value_ex_gst,
      quotation_date: row.document_date
    })
  }

  function exportPdf(row) {
    const c = documentCalc(row)
    const doc = new jsPDF()
    const companyName = settings.company_name || 'TELEC GROUP'
    if (settings.company_logo_url) {
      try { doc.addImage(settings.company_logo_url, 'PNG', 14, 10, 25, 20) } catch (_) {}
    }
    doc.setFontSize(18)
    doc.text(companyName, settings.company_logo_url ? 45 : 14, 18)
    doc.setFontSize(9)
    if (settings.company_address) doc.text(settings.company_address, 14, 25)
    if (settings.company_phone || settings.company_email) doc.text(`${settings.company_phone || ''} ${settings.company_email || ''}`.trim(), 14, 30)
    doc.setFontSize(13)
    doc.text(cfg.singular.toUpperCase(), 14, 40)
    doc.setFontSize(9)
    doc.text(`No: ${row.document_no}`, 14, 48)
    doc.text(`Date: ${row.document_date}`, 145, 48)
    doc.text(`Customer: ${row.customer_name}`, 14, 55)
    doc.text(`Salesperson: ${userName(row.user_id)}`, 14, 62)
    autoTable(doc, {
      startY: 70,
      head: [['Item / Description', 'Purchase Value', 'Sales Excl. GST', 'GST', 'Including GST', 'WHT', 'Net Total', 'GP']],
      body: [[row.item, pkr(row.purchase_value), pkr(row.sales_value_ex_gst), pkr(c.gst), pkr(c.incl), pkr(c.wht), pkr(c.net), pkr(c.gp)]],
      styles: { fontSize: 7 }
    })
    doc.setFontSize(9)
    doc.text(`Status: ${row.status}`, 14, doc.lastAutoTable.finalY + 12)
    doc.text(`Remarks: ${row.remarks || '-'}`, 14, doc.lastAutoTable.finalY + 19)
    const footer = settings?.[cfg.footerKey]
    if (footer) doc.text(footer, 14, 280, { maxWidth: 180 })
    doc.save(`${row.document_no}.pdf`)
  }

  const sourceQuotations = profile.role === 'admin' ? quotations : quotations.filter(q => q.user_id === profile.id)
  const sourceDeliveries = profile.role === 'admin' ? deliveries : deliveries.filter(d => d.user_id === profile.id)
  const preview = documentCalc(form)

  return <div>
    <div className="topbar">
      <div><h1>{cfg.title}</h1><p>{type === 'quotation' ? 'Quotation creates the Sales Pipeline automatically' : type === 'delivery' ? 'Create Delivery Challan from an existing Quotation' : 'Create Invoice from an existing Delivery Challan'}</p></div>
      <div className="actions"><button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button><button className="primary" onClick={reset}><Plus size={16}/> Add {cfg.singular}</button></div>
    </div>

    <section className="panel">
      <div className="filters"><input placeholder={`Search ${cfg.title.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)}/></div>
      <div className="table-wrap"><table><thead><tr><th>#</th><th>{cfg.singular} No.</th><th>Date</th><th>Salesperson</th><th>Customer</th><th>Item</th><th>Sales Value</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {filtered.length ? filtered.map((row, i) => <tr key={row.id}><td>{i + 1}</td><td>{row.document_no}</td><td>{row.document_date}</td><td>{userName(row.user_id)}</td><td>{row.customer_name}</td><td>{row.item}</td><td>{pkr(row.sales_value_ex_gst)}</td><td>{row.status}</td><td><button className="icon" onClick={() => edit(row)}><Pencil size={15}/></button><button className="icon" onClick={() => exportPdf(row)}><Download size={15}/></button><button className="icon danger" onClick={() => remove(row.id)}><Trash2 size={15}/></button></td></tr>) : <tr><td colSpan="9" className="empty">No records available.</td></tr>}
      </tbody></table></div>
    </section>

    {showForm && <div className="modal"><form className="modal-card workflow-document-modal" onSubmit={save}>
      <div className="modal-head"><h2>{editingId ? 'Edit' : 'Add'} {cfg.singular}</h2><button type="button" onClick={() => setShowForm(false)}>×</button></div>
      <div className="form-grid">
        {type === 'delivery' && <label className="wide">Related Quotation<select required value={form.quotation_id} onChange={e => chooseQuotation(e.target.value)}><option value="">Select Quotation</option>{sourceQuotations.map(q => <option key={q.id} value={q.id}>{q.document_no} | {q.customer_name} | {q.item}</option>)}</select></label>}
        {type === 'invoice' && <label className="wide">Related Delivery Challan<select required value={form.delivery_challan_id} onChange={e => chooseDelivery(e.target.value)}><option value="">Select Delivery Challan</option>{sourceDeliveries.map(d => <option key={d.id} value={d.id}>{d.document_no} | {d.customer_name} | {d.item}</option>)}</select></label>}

        {profile.role === 'admin' && <label>Salesperson<select required value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })}><option value="">Select salesperson</option>{salesUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>}
        <label>{cfg.singular} No.<input required value={form.document_no} onChange={e => setForm({ ...form, document_no: e.target.value })}/></label>
        <label>Date<input type="date" required value={form.document_date} onChange={e => setForm({ ...form, document_date: e.target.value })}/></label>
        <label>Customer Name<input required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}/></label>
        <label>Item / Solution<input required value={form.item} onChange={e => setForm({ ...form, item: e.target.value })}/></label>
        <label>Purchase Value (PKR)<input type="number" min="0" step="0.01" value={form.purchase_value} onChange={e => setForm({ ...form, purchase_value: e.target.value })}/></label>
        <label>Sales Value Excluding GST (PKR)<input type="number" min="0" step="0.01" required value={form.sales_value_ex_gst} onChange={e => setForm({ ...form, sales_value_ex_gst: e.target.value })}/></label>
        <label>Vendor<input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })}/></label>
        <label>Vendor Terms<input value={form.vendor_terms} onChange={e => setForm({ ...form, vendor_terms: e.target.value })}/></label>
        <label>Probability (%)<input type="number" min="0" max="100" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })}/></label>
        <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{cfg.statuses.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="wide">Remarks<textarea rows="3" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}/></label>
      </div>

      <div className="calc-preview">
        {[['GST', preview.gst], ['Including GST', preview.incl], ['WHT', preview.wht], ['Net Total', preview.net], ['Gross Profit', preview.gp]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{pkr(value)}</strong></div>)}
      </div>
      {type === 'invoice' && <p className="workflow-note">Saving the Invoice will automatically close the linked Sales Opportunity as Won and set Probability to 100%.</p>}
      <div className="form-actions"><button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="primary">Save {cfg.singular}</button></div>
    </form></div>}
  </div>
}
