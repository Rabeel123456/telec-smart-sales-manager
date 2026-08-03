import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet, Plus, RefreshCw, Trash2, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'

const blank = {
  customer_name: '', quotation_date: new Date().toISOString().slice(0,10),
  purchase_value: '', item: '', sales_value_ex_gst: '', vendor: '',
  vendor_terms: '', quotation_status: 'Pending', probability: 75, remarks: ''
}

const pkr = n => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

export default function Dashboard({ profile }) {
  const [records, setRecords] = useState([])
  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState({ gst_rate: 18, wht_rate: 5 })
  const [selectedUser, setSelectedUser] = useState('')
  const [status, setStatus] = useState('')
  const [probabilityBand, setProbabilityBand] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [{ data, error }, { data: settingRows }] = await Promise.all([
      supabase.from('sales_records').select('*, profiles!sales_records_user_id_fkey(full_name)').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('gst_rate,wht_rate').eq('id',1).single()
    ])
    if (error) alert(error.message)
    setRecords(data || [])
    if (settingRows) setSettings(settingRows)

    if (profile.role === 'admin') {
      const { data: people } = await supabase.from('profiles').select('id,full_name,role,active').eq('role','sales').eq('active',true).order('full_name')
      setUsers(people || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const calc = r => {
    const sales = Number(r.sales_value_ex_gst || 0)
    const purchase = Number(r.purchase_value || 0)
    const gst = sales * Number(settings.gst_rate || 0) / 100
    const incl = sales + gst
    const wht = sales * Number(settings.wht_rate || 0) / 100
    const net = incl - wht
    const gp = sales - purchase
    const age = r.quotation_date ? Math.max(0, Math.floor((Date.now() - new Date(`${r.quotation_date}T00:00:00`)) / 86400000)) : 0
    return { gst, incl, wht, net, gp, age }
  }

  const filtered = useMemo(() => records.filter(r => {
    const matchesUser = !selectedUser || r.user_id === selectedUser
    const matchesStatus = !status || r.quotation_status === status
    const p = Number(r.probability)
    const matchesProb = !probabilityBand ||
      (probabilityBand === 'high' && p >= 67) ||
      (probabilityBand === 'medium' && p >= 34 && p <= 66) ||
      (probabilityBand === 'low' && p <= 33)
    const text = `${r.customer_name} ${r.item} ${r.vendor || ''} ${r.profiles?.full_name || ''}`.toLowerCase()
    return matchesUser && matchesStatus && matchesProb && text.includes(search.toLowerCase())
  }), [records, selectedUser, status, probabilityBand, search])

  const enriched = filtered.map(r => ({ ...r, ...calc(r) }))
  const totalPipeline = enriched.reduce((a,r)=>a+Number(r.sales_value_ex_gst||0),0)
  const totalGP = enriched.reduce((a,r)=>a+r.gp,0)
  const high = enriched.filter(r=>Number(r.probability)>=67).reduce((a,r)=>a+Number(r.sales_value_ex_gst||0),0)
  const medium = enriched.filter(r=>Number(r.probability)>=34&&Number(r.probability)<=66).reduce((a,r)=>a+Number(r.sales_value_ex_gst||0),0)
  const low = enriched.filter(r=>Number(r.probability)<=33).reduce((a,r)=>a+Number(r.sales_value_ex_gst||0),0)
  const pending = enriched.filter(r=>['Pending','Submitted'].includes(r.quotation_status)).length

  async function save(e) {
    e.preventDefault()
    const payload = {
      ...form,
      purchase_value: Number(form.purchase_value || 0),
      sales_value_ex_gst: Number(form.sales_value_ex_gst || 0),
      probability: Math.max(0, Math.min(100, Number(form.probability || 0))),
      user_id: profile.role === 'admin' ? form.user_id : profile.id
    }
    if (!payload.user_id) return alert('Please select a salesperson.')
    const query = editingId
      ? supabase.from('sales_records').update(payload).eq('id', editingId)
      : supabase.from('sales_records').insert(payload)
    const { error } = await query
    if (error) return alert(error.message)
    setForm(blank); setEditingId(null); setShowForm(false); load()
  }

  function edit(r) {
    setForm({
      user_id:r.user_id, customer_name:r.customer_name, quotation_date:r.quotation_date,
      purchase_value:r.purchase_value, item:r.item, sales_value_ex_gst:r.sales_value_ex_gst,
      vendor:r.vendor||'', vendor_terms:r.vendor_terms||'', quotation_status:r.quotation_status,
      probability:r.probability, remarks:r.remarks||''
    })
    setEditingId(r.id); setShowForm(true)
  }

  async function remove(id) {
    if (!confirm('Delete this entry permanently?')) return
    const { error } = await supabase.from('sales_records').delete().eq('id',id)
    if (error) return alert(error.message)
    load()
  }

  function exportPdf() {
    if (!enriched.length) return alert('No records available.')
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
    doc.setFontSize(17); doc.text('TELEC Smart Sales Manager',14,14)
    doc.setFontSize(10); doc.text(`Total Pipeline: ${pkr(totalPipeline)}`,14,22)
    doc.text(`Total GP: ${pkr(totalGP)}`,14,28)
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`,210,14)
    autoTable(doc,{
      startY:35,
      head:[['#','Salesperson','Customer','Date','Item','Purchase','Sales Excl GST','GST','Incl GST','WHT','Net','GP','Prob.','Status','Ageing']],
      body:enriched.map((r,i)=>[
        i+1,r.profiles?.full_name||'',r.customer_name,r.quotation_date,r.item,
        Number(r.purchase_value).toLocaleString(),Number(r.sales_value_ex_gst).toLocaleString(),
        r.gst.toLocaleString(),r.incl.toLocaleString(),r.wht.toLocaleString(),r.net.toLocaleString(),
        r.gp.toLocaleString(),`${r.probability}%`,r.quotation_status,`${r.age} days`
      ]),
      styles:{fontSize:6.2,cellPadding:1.3}
    })
    doc.save('TELEC-Sales-Pipeline.pdf')
  }

  function exportExcel() {
    const rows = enriched.map((r,i)=>({
      'S.No.':i+1,'Salesperson':r.profiles?.full_name||'','Customer Name':r.customer_name,
      'Quotation Date':r.quotation_date,'Purchase Value':r.purchase_value,'Item':r.item,
      'Sales Value Excluding GST':r.sales_value_ex_gst,'GST':r.gst,'Sales Value Including GST':r.incl,
      'WHT':r.wht,'Net Total':r.net,'GP':r.gp,'Vendor':r.vendor,'Vendor Terms':r.vendor_terms,
      'Quotation Status':r.quotation_status,'Probability':r.probability,'Ageing':r.age,'Remarks':r.remarks
    }))
    const wb=XLSX.utils.book_new(), ws=XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb,ws,'Sales Pipeline')
    XLSX.writeFile(wb,'TELEC-Sales-Pipeline.xlsx')
  }

  return (
    <div>
      <div className="topbar">
        <div><h1>Sales Dashboard</h1><p>Live pipeline, calculations and reports</p></div>
        <div className="actions">
          <button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button>
          <button className="secondary" onClick={exportPdf}><Download size={16}/> Export PDF</button>
          {profile.role==='admin' && <button className="secondary" onClick={exportExcel}><FileSpreadsheet size={16}/> Export Excel</button>}
          <button className="primary" onClick={()=>{setForm(blank);setEditingId(null);setShowForm(true)}}><Plus size={16}/> Add Opportunity</button>
        </div>
      </div>

      <div className="cards six">
        <div className="card"><span>Total Pipeline</span><strong>{pkr(totalPipeline)}</strong></div>
        <div className="card"><span>Total Gross Profit</span><strong>{pkr(totalGP)}</strong></div>
        <div className="card"><span>High Probability</span><strong>{pkr(high)}</strong></div>
        <div className="card"><span>Medium Probability</span><strong>{pkr(medium)}</strong></div>
        <div className="card"><span>Low Probability</span><strong>{pkr(low)}</strong></div>
        <div className="card"><span>Pending / Submitted</span><strong>{pending}</strong></div>
      </div>

      <section className="panel">
        <div className="filters four">
          <input placeholder="Search customer, item, vendor..." value={search} onChange={e=>setSearch(e.target.value)}/>
          {profile.role==='admin' && <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)}><option value="">All Salespersons</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select>}
          <select value={probabilityBand} onChange={e=>setProbabilityBand(e.target.value)}><option value="">All Probabilities</option><option value="high">High 67–100%</option><option value="medium">Medium 34–66%</option><option value="low">Low 0–33%</option></select>
          <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All Statuses</option><option>Pending</option><option>Submitted</option><option>Won</option><option>Lost</option><option>On Hold</option></select>
        </div>
        <div className="table-wrap">
          <table className="wide-table">
            <thead><tr>
              <th>#</th><th>Salesperson</th><th>Customer</th><th>Date</th><th>Item</th><th>Purchase</th>
              <th>Sales Excl GST</th><th>GST</th><th>Incl GST</th><th>WHT</th><th>Net Total</th><th>GP</th>
              <th>Vendor</th><th>Terms</th><th>Probability</th><th>Status</th><th>Ageing</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="18">Loading...</td></tr> :
              enriched.map((r,i)=><tr key={r.id}>
                <td>{i+1}</td><td>{r.profiles?.full_name}</td><td>{r.customer_name}</td><td>{r.quotation_date}</td><td>{r.item}</td>
                <td>{pkr(r.purchase_value)}</td><td>{pkr(r.sales_value_ex_gst)}</td><td>{pkr(r.gst)}</td><td>{pkr(r.incl)}</td>
                <td>{pkr(r.wht)}</td><td>{pkr(r.net)}</td><td>{pkr(r.gp)}</td><td>{r.vendor}</td><td>{r.vendor_terms}</td>
                <td>{r.probability}%</td><td>{r.quotation_status}</td><td>{r.age} days</td>
                <td><button className="icon" onClick={()=>edit(r)}><Pencil size={15}/></button><button className="icon danger" onClick={()=>remove(r.id)}><Trash2 size={15}/></button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && <div className="modal"><form className="modal-card" onSubmit={save}>
        <div className="modal-head"><h2>{editingId?'Edit Opportunity':'Add Opportunity'}</h2><button type="button" onClick={()=>setShowForm(false)}>×</button></div>
        <div className="form-grid">
          {profile.role==='admin' && <label>Salesperson<select required value={form.user_id||''} onChange={e=>setForm({...form,user_id:e.target.value})}><option value="">Select</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>}
          <label>Customer Name<input required value={form.customer_name} onChange={e=>setForm({...form,customer_name:e.target.value})}/></label>
          <label>Quotation Date<input type="date" required value={form.quotation_date} onChange={e=>setForm({...form,quotation_date:e.target.value})}/></label>
          <label>Item / Solution<input required value={form.item} onChange={e=>setForm({...form,item:e.target.value})}/></label>
          <label>Purchase Value<input type="number" min="0" step="0.01" value={form.purchase_value} onChange={e=>setForm({...form,purchase_value:e.target.value})}/></label>
          <label>Sales Value Excl. GST<input type="number" min="0" step="0.01" required value={form.sales_value_ex_gst} onChange={e=>setForm({...form,sales_value_ex_gst:e.target.value})}/></label>
          <label>Vendor<input value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})}/></label>
          <label>Vendor Terms<input value={form.vendor_terms} onChange={e=>setForm({...form,vendor_terms:e.target.value})}/></label>
          <label>Status<select value={form.quotation_status} onChange={e=>setForm({...form,quotation_status:e.target.value})}><option>Pending</option><option>Submitted</option><option>Won</option><option>Lost</option><option>On Hold</option></select></label>
          <label>Probability (%)<input type="number" min="0" max="100" required value={form.probability} onChange={e=>setForm({...form,probability:e.target.value})}/></label>
          <label className="wide">Remarks<textarea rows="3" value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label>
        </div>
        <div className="calc-preview">
          {Object.entries(calc(form)).map(([k,v])=><div key={k}><span>{({gst:'GST',incl:'Including GST',wht:'WHT',net:'Net Total',gp:'Gross Profit',age:'Ageing'})[k]}</span><strong>{k==='age'?`${v} days`:pkr(v)}</strong></div>)}
        </div>
        <div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary">Save Opportunity</button></div>
      </form></div>}
    </div>
  )
}