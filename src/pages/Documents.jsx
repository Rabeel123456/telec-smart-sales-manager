import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Download, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { pkr, useSales } from '../context/SalesContext'

const CONFIG = {
  quotation: { title: 'Quotations', singular: 'Quotation', table: 'quotations', prefixKey: 'quotation_prefix', footerKey: 'quotation_footer' },
  delivery: { title: 'Delivery Challans', singular: 'Delivery Challan', table: 'delivery_challans', prefixKey: 'delivery_prefix', footerKey: 'delivery_footer' },
  invoice: { title: 'Invoices', singular: 'Invoice', table: 'invoices', prefixKey: 'invoice_prefix', footerKey: 'invoice_footer' }
}

export default function Documents({ type }) {
  const cfg = CONFIG[type]
  const { profile, records, users, settings, calc } = useSales()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ opportunity_id:'', document_no:'', document_date:new Date().toISOString().slice(0,10), status:'Draft', remarks:'' })

  async function load() {
    const { data, error } = await supabase.from(cfg.table).select('*').order('created_at', { ascending:false })
    if (error) return alert(error.message)
    setRows(data || [])
  }
  useEffect(() => { load(); setShowForm(false); setEditingId(null) }, [type])

  const opportunityMap = useMemo(() => Object.fromEntries(records.map(r => [r.id, r])), [records])
  const filtered = rows.filter(row => {
    const opportunity = opportunityMap[row.opportunity_id]
    const text = `${row.document_no} ${row.status} ${opportunity?.customer_name || ''} ${opportunity?.item || ''}`.toLowerCase()
    return text.includes(search.toLowerCase())
  })

  function reset() {
    const prefix = settings?.[cfg.prefixKey] || ({quotation:'QT',delivery:'DC',invoice:'INV'})[type]
    setForm({ opportunity_id:'', document_no:`${prefix}-${new Date().getFullYear()}-`, document_date:new Date().toISOString().slice(0,10), status:'Draft', remarks:'' })
    setEditingId(null); setShowForm(true)
  }

  function edit(row) { setForm({ opportunity_id:row.opportunity_id, document_no:row.document_no, document_date:row.document_date, status:row.status, remarks:row.remarks || '' }); setEditingId(row.id); setShowForm(true) }

  async function save(e) {
    e.preventDefault()
    const opportunity = opportunityMap[form.opportunity_id]
    if (!opportunity) return alert('Please select a related Sales Opportunity.')
    const payload = { ...form, user_id: opportunity.user_id }
    const query = editingId ? supabase.from(cfg.table).update(payload).eq('id', editingId) : supabase.from(cfg.table).insert(payload)
    const { error } = await query
    if (error) return alert(error.message)
    setShowForm(false); await load()
  }

  async function remove(id) { if (!confirm(`Delete this ${cfg.singular}?`)) return; const { error } = await supabase.from(cfg.table).delete().eq('id', id); if (error) alert(error.message); else load() }

  function exportPdf(row) {
    const opportunity = opportunityMap[row.opportunity_id]
    if (!opportunity) return alert('Related opportunity was not found.')
    const c = calc(opportunity)
    const doc = new jsPDF()
    const companyName = settings.company_name || 'TELEC GROUP'
    if (settings.company_logo_url) {
      try { doc.addImage(settings.company_logo_url, 'PNG', 14, 10, 25, 20) } catch (_) {}
    }
    doc.setFontSize(18); doc.text(companyName, settings.company_logo_url ? 45 : 14, 18)
    doc.setFontSize(13); doc.text(cfg.singular.toUpperCase(), 14, 34)
    doc.setFontSize(9)
    doc.text(`No: ${row.document_no}`, 14, 42)
    doc.text(`Date: ${row.document_date}`, 145, 42)
    doc.text(`Customer: ${opportunity.customer_name}`, 14, 49)
    doc.text(`Salesperson: ${opportunity.profiles?.full_name || users.find(u=>u.id===opportunity.user_id)?.full_name || ''}`, 14, 56)
    autoTable(doc, {
      startY: 64,
      head: [['Item / Description','Purchase Value','Sales Excl. GST','GST','Including GST','WHT','Net Total','GP']],
      body: [[opportunity.item, pkr(opportunity.purchase_value), pkr(opportunity.sales_value_ex_gst), pkr(c.gst), pkr(c.incl), pkr(c.wht), pkr(c.net), pkr(c.gp)]],
      styles:{fontSize:7}
    })
    doc.setFontSize(9)
    doc.text(`Status: ${row.status}`, 14, doc.lastAutoTable.finalY + 12)
    doc.text(`Remarks: ${row.remarks || '-'}`, 14, doc.lastAutoTable.finalY + 19)
    const footer = settings?.[cfg.footerKey]
    if (footer) doc.text(footer, 14, 280, { maxWidth:180 })
    doc.save(`${row.document_no}.pdf`)
  }

  const allowedRecords = profile.role === 'admin' ? records : records.filter(r => r.user_id === profile.id)

  return <div>
    <div className="topbar"><div><h1>{cfg.title}</h1><p>Linked with existing Sales Opportunities</p></div><div className="actions"><button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button><button className="primary" onClick={reset}><Plus size={16}/> Add {cfg.singular}</button></div></div>
    <section className="panel">
      <div className="filters"><input placeholder={`Search ${cfg.title.toLowerCase()}...`} value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="table-wrap"><table><thead><tr><th>#</th><th>{cfg.singular} No.</th><th>Date</th><th>Salesperson</th><th>Customer</th><th>Item</th><th>Sales Value</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {filtered.length ? filtered.map((row,i)=>{const o=opportunityMap[row.opportunity_id];return <tr key={row.id}><td>{i+1}</td><td>{row.document_no}</td><td>{row.document_date}</td><td>{o?.profiles?.full_name || users.find(u=>u.id===o?.user_id)?.full_name || ''}</td><td>{o?.customer_name || ''}</td><td>{o?.item || ''}</td><td>{pkr(o?.sales_value_ex_gst)}</td><td>{row.status}</td><td><button className="icon" onClick={()=>edit(row)}><Pencil size={15}/></button><button className="icon" onClick={()=>exportPdf(row)}><Download size={15}/></button><button className="icon danger" onClick={()=>remove(row.id)}><Trash2 size={15}/></button></td></tr>}) : <tr><td colSpan="9" className="empty">No records available.</td></tr>}
      </tbody></table></div>
    </section>
    {showForm && <div className="modal"><form className="modal-card document-modal" onSubmit={save}><div className="modal-head"><h2>{editingId?'Edit':'Add'} {cfg.singular}</h2><button type="button" onClick={()=>setShowForm(false)}>×</button></div><div className="form-grid">
      <label>Related Sales Opportunity<select required value={form.opportunity_id} onChange={e=>setForm({...form,opportunity_id:e.target.value})}><option value="">Select Opportunity</option>{allowedRecords.map(r=><option key={r.id} value={r.id}>{r.customer_name} | {r.item} | {pkr(r.sales_value_ex_gst)}</option>)}</select></label>
      <label>{cfg.singular} No.<input required value={form.document_no} onChange={e=>setForm({...form,document_no:e.target.value})}/></label>
      <label>Date<input type="date" required value={form.document_date} onChange={e=>setForm({...form,document_date:e.target.value})}/></label>
      <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Draft</option><option>Submitted</option><option>Approved</option><option>Completed</option><option>Cancelled</option></select></label>
      <label className="wide">Remarks<textarea rows="3" value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label>
    </div><div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary">Save {cfg.singular}</button></div></form></div>}
  </div>
}
