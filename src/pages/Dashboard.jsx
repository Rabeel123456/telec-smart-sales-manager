import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Eye, FileSpreadsheet, Maximize, Plus, RefreshCw, Search, Target, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { pkr, useSales } from '../context/SalesContext'
import '../dashboard-details.css'

const now = new Date()
const CURRENT_YEAR = now.getFullYear()
const CURRENT_MONTH = now.getMonth() + 1

export default function Dashboard() {
  const { profile, records, users, loading, load, calc } = useSales()
  const [person, setPerson] = useState('')
  const [invoices, setInvoices] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [target, setTarget] = useState({ monthly_target: 0, yearly_target: 0 })
  const [showTarget, setShowTarget] = useState(false)
  const [detailType, setDetailType] = useState(null)
  const [detailSearch, setDetailSearch] = useState('')
  const selectedUserId = profile.role === 'admin' ? (person || '') : profile.id

  const rows = useMemo(
    () => records.filter(r => !selectedUserId || r.user_id === selectedUserId).map(r => ({ ...r, ...calc(r) })),
    [records, selectedUserId, calc]
  )

  async function loadPerformance() {
    const [{ data: inv, error: invError }, { data: dos, error: doError }] = await Promise.all([
      supabase.from('invoices').select('id,user_id,document_date,grand_total,status'),
      supabase.from('delivery_challans').select('id,user_id,document_date,grand_total,status')
    ])
    if (invError) console.error(invError)
    if (doError) console.error(doError)
    setInvoices(inv || [])
    setDeliveries(dos || [])
  }

  async function loadTarget() {
    if (!selectedUserId) { setTarget({ monthly_target: 0, yearly_target: 0 }); return }
    const { data, error } = await supabase.from('sales_targets')
      .select('monthly_target,yearly_target')
      .eq('user_id', selectedUserId).eq('target_year', CURRENT_YEAR).eq('target_month', CURRENT_MONTH).maybeSingle()
    if (error) console.error(error)
    setTarget(data || { monthly_target: 0, yearly_target: 0 })
  }

  useEffect(() => { loadPerformance() }, [])
  useEffect(() => { loadTarget() }, [selectedUserId])

  const sum = key => rows.reduce((a, r) => a + Number(r[key] || 0), 0)
  const band = (min, max) => rows.filter(r => Number(r.probability) >= min && Number(r.probability) <= max).reduce((a, r) => a + Number(r.sales_value_ex_gst || 0), 0)
  const statuses = ['Pending', 'Submitted', 'Won', 'Lost', 'On Hold']
  const relevantInvoices = invoices.filter(r => !selectedUserId || r.user_id === selectedUserId)
  const relevantDeliveries = deliveries.filter(r => !selectedUserId || r.user_id === selectedUserId)
  const monthlyAchieved = relevantInvoices.filter(r => { const d=new Date(`${r.document_date}T00:00:00`); return d.getFullYear()===CURRENT_YEAR && d.getMonth()+1===CURRENT_MONTH && r.status!=='Cancelled' }).reduce((a,r)=>a+Number(r.grand_total||0),0)
  const yearlyAchieved = relevantInvoices.filter(r => { const d=new Date(`${r.document_date}T00:00:00`); return d.getFullYear()===CURRENT_YEAR && r.status!=='Cancelled' }).reduce((a,r)=>a+Number(r.grand_total||0),0)
  const closureRows = relevantDeliveries.filter(r => r.status === 'Delivered')
  const closureValue = closureRows.reduce((a,r)=>a+Number(r.grand_total||0),0)
  const monthlyRemaining = Math.max(Number(target.monthly_target||0)-monthlyAchieved,0)
  const monthlyPercent = Number(target.monthly_target||0)>0 ? monthlyAchieved/Number(target.monthly_target)*100 : 0


  const pendingRows = rows.filter(r => ['Pending', 'Submitted'].includes(r.quotation_status))

  const detailConfig = {
    pipeline: {
      title: 'Total Pipeline Details',
      subtitle: 'Complete breakdown of the selected sales pipeline.',
      rows,
      value: sum('sales_value_ex_gst')
    },
    gp: {
      title: 'Gross Profit Details',
      subtitle: 'Opportunity-wise gross profit contribution.',
      rows: [...rows].sort((a,b) => Number(b.gp||0) - Number(a.gp||0)),
      value: sum('gp')
    },
    high: {
      title: '67–100% Probability Details',
      subtitle: 'High-probability sales opportunities.',
      rows: rows.filter(r => Number(r.probability) >= 67 && Number(r.probability) <= 100),
      value: band(67,100)
    },
    medium: {
      title: '34–66% Probability Details',
      subtitle: 'Medium-probability sales opportunities.',
      rows: rows.filter(r => Number(r.probability) >= 34 && Number(r.probability) <= 66),
      value: band(34,66)
    },
    low: {
      title: '0–33% Probability Details',
      subtitle: 'Early-stage and low-probability sales opportunities.',
      rows: rows.filter(r => Number(r.probability) >= 0 && Number(r.probability) <= 33),
      value: band(0,33)
    },
    pending: {
      title: 'Pending Quotation Details',
      subtitle: 'Quotations currently pending or submitted.',
      rows: pendingRows,
      value: pendingRows.length
    }
  }

  const activeDetail = detailType ? detailConfig[detailType] : null
  const visibleDetailRows = activeDetail
    ? activeDetail.rows.filter(r => {
        const text = [
          r.profiles?.full_name,
          r.customer_name,
          r.item,
          r.quotation_status,
          r.quotation_date
        ].join(' ').toLowerCase()
        return text.includes(detailSearch.toLowerCase())
      })
    : []

  function openDetails(type) {
    setDetailSearch('')
    setDetailType(type)
  }

  function closeDetails() {
    setDetailType(null)
    setDetailSearch('')
  }

  async function saveTarget(e) {
    e.preventDefault()
    const userId = selectedUserId || profile.id
    const payload = { user_id:userId, target_year:CURRENT_YEAR, target_month:CURRENT_MONTH, monthly_target:Number(target.monthly_target||0), yearly_target:Number(target.yearly_target||0) }
    const { error } = await supabase.from('sales_targets').upsert(payload, { onConflict:'user_id,target_year,target_month' })
    if (error) return alert(error.message)
    setShowTarget(false)
    alert('Sales target saved.')
  }

  function exportPdf() {
    if (!rows.length) return alert('No records available to export.')
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(17); doc.text('TELEC Smart Sales Manager', 14, 14)
    doc.setFontSize(10); doc.text(`Total Pipeline: ${pkr(sum('sales_value_ex_gst'))}`, 14, 22); doc.text(`Total Gross Profit: ${pkr(sum('gp'))}`, 14, 28)
    autoTable(doc, { startY:35, head:[['#','Salesperson','Customer','Date','Item','Sales','GP','Probability','Status']], body:rows.map((r,i)=>[i+1,r.profiles?.full_name||'',r.customer_name,r.quotation_date,r.item,Number(r.sales_value_ex_gst||0).toLocaleString(),Number(r.gp||0).toLocaleString(),`${r.probability}%`,r.quotation_status]), styles:{fontSize:7} })
    doc.save('TELEC-Sales-Dashboard.pdf')
  }

  function exportExcel() {
    if (!rows.length) return alert('No records available to export.')
    const data=rows.map((r,i)=>({'S.No.':i+1,Salesperson:r.profiles?.full_name||'',Customer:r.customer_name,Date:r.quotation_date,Item:r.item,'Purchase Value':r.purchase_value,'Sales Excl. GST':r.sales_value_ex_gst,GST:r.gst,'Including GST':r.incl,WHT:r.wht,'Net Total':r.net,GP:r.gp,Probability:r.probability,Status:r.quotation_status,Ageing:r.age}))
    const workbook=XLSX.utils.book_new(), worksheet=XLSX.utils.json_to_sheet(data); XLSX.utils.book_append_sheet(workbook,worksheet,'Sales Dashboard'); XLSX.writeFile(workbook,'TELEC-Sales-Dashboard.xlsx')
  }

  async function toggleFullScreen(){ if(!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen() }
  async function refreshAll(){ await Promise.all([load(),loadPerformance(),loadTarget()]) }

  return <div>
    <div className="topbar"><div><h1>Sales Dashboard</h1><p>Live overview of sales pipeline</p></div><div className="actions">
      <button className="secondary" onClick={refreshAll}><RefreshCw size={16}/> Refresh</button><button className="secondary" onClick={exportPdf}><Download size={16}/> Export PDF</button>
      {profile.role==='admin'&&<button className="secondary" onClick={exportExcel}><FileSpreadsheet size={16}/> Export Excel</button>}
      <button className="secondary" onClick={toggleFullScreen}><Maximize size={16}/> Full Screen</button><Link className="primary button-link" to="/opportunity"><Plus size={16}/> Add Opportunity</Link>
    </div></div>

    {profile.role==='admin'&&<div className="scope"><label>View salesperson<select value={person} onChange={e=>setPerson(e.target.value)}><option value="">All Salespersons</option>{users.filter(u=>u.role==='sales'&&u.active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label></div>}

    <div className="cards six dashboard-clickable-cards">
      <button className="card dashboard-stat-card" onClick={()=>openDetails('pipeline')}>
        <span>Total Pipeline</span><strong>{pkr(sum('sales_value_ex_gst'))}</strong><small><Eye size={14}/> View details</small>
      </button>
      <button className="card dashboard-stat-card" onClick={()=>openDetails('gp')}>
        <span>Total Gross Profit</span><strong>{pkr(sum('gp'))}</strong><small><Eye size={14}/> View details</small>
      </button>
      <button className="card dashboard-stat-card" onClick={()=>openDetails('high')}>
        <span>75% Probability</span><strong>{pkr(band(67,100))}</strong><small><Eye size={14}/> View details</small>
      </button>
      <button className="card dashboard-stat-card" onClick={()=>openDetails('medium')}>
        <span>50% Probability</span><strong>{pkr(band(34,66))}</strong><small><Eye size={14}/> View details</small>
      </button>
      <button className="card dashboard-stat-card" onClick={()=>openDetails('low')}>
        <span>25% Probability</span><strong>{pkr(band(0,33))}</strong><small><Eye size={14}/> View details</small>
      </button>
      <button className="card dashboard-stat-card" onClick={()=>openDetails('pending')}>
        <span>Pending Quotations</span><strong>{pendingRows.length}</strong><small><Eye size={14}/> View details</small>
      </button>
    </div>

    <section className="panel target-panel"><div className="panel-head"><div><h2>Sales Target & Closure</h2><p className="muted">Current month: {now.toLocaleString('en-US',{month:'long'})} {CURRENT_YEAR}</p></div>{(profile.role!=='admin'||selectedUserId)&&<button className="secondary" onClick={()=>setShowTarget(true)}><Target size={16}/> Set Target</button>}</div>
      <div className="target-cards"><div><span>Monthly Target</span><strong>{pkr(target.monthly_target)}</strong></div><div><span>Monthly Achieved</span><strong>{pkr(monthlyAchieved)}</strong></div><div><span>Monthly Remaining</span><strong>{pkr(monthlyRemaining)}</strong></div><div><span>Achievement</span><strong>{monthlyPercent.toFixed(1)}%</strong></div><div><span>Yearly Target</span><strong>{pkr(target.yearly_target)}</strong></div><div><span>Yearly Achieved</span><strong>{pkr(yearlyAchieved)}</strong></div><div><span>Closure from DO</span><strong>{pkr(closureValue)}</strong><small>{closureRows.length} delivered</small></div></div>
    </section>

    <div className="dashboard-grid"><section className="panel"><h2>Probability Summary</h2>{[[67,100,'67–100%'],[34,66,'34–66%'],[0,33,'0–33%']].map(([min,max,label])=>{const value=band(min,max),total=Math.max(sum('sales_value_ex_gst'),1);return <div className="bar-row" key={label}><strong>{label}</strong><div className="bar-track"><div className="bar-fill" style={{width:`${value/total*100}%`}}/></div><span>{pkr(value)}</span></div>})}</section><section className="panel"><h2>Quotation Status</h2>{statuses.map(status=><div className="status-row" key={status}><span>{status}</span><strong>{rows.filter(r=>r.quotation_status===status).length}</strong></div>)}</section></div>
    <section className="panel"><div className="panel-head"><h2>Recent Opportunities</h2><Link to="/pipeline">View complete pipeline</Link></div><div className="table-wrap"><table><thead><tr><th>Salesperson</th><th>Customer</th><th>Date</th><th>Item</th><th>Sales</th><th>GP</th><th>Probability</th><th>Status</th></tr></thead><tbody>{loading?<tr><td colSpan="8">Loading...</td></tr>:rows.slice(0,8).map(r=><tr key={r.id}><td>{r.profiles?.full_name}</td><td>{r.customer_name}</td><td>{r.quotation_date}</td><td>{r.item}</td><td>{pkr(r.sales_value_ex_gst)}</td><td>{pkr(r.gp)}</td><td>{r.probability}%</td><td>{r.quotation_status}</td></tr>)}</tbody></table></div></section>


    {activeDetail&&<div className="dashboard-drawer-layer" onMouseDown={e=>{if(e.target===e.currentTarget)closeDetails()}}>
      <aside className="dashboard-detail-drawer">
        <div className="drawer-head">
          <div>
            <span className="drawer-kicker">DASHBOARD BREAKDOWN</span>
            <h2>{activeDetail.title}</h2>
            <p>{activeDetail.subtitle}</p>
          </div>
          <button className="drawer-close" type="button" onClick={closeDetails} aria-label="Close details"><X size={22}/></button>
        </div>

        <div className="drawer-summary">
          <div><span>Total Records</span><strong>{visibleDetailRows.length}</strong></div>
          <div><span>{detailType==='pending'?'Pending Count':detailType==='gp'?'Total Gross Profit':'Total Value'}</span><strong>{detailType==='pending'?visibleDetailRows.length:pkr(visibleDetailRows.reduce((a,r)=>a+Number(detailType==='gp'?r.gp:r.sales_value_ex_gst||0),0))}</strong></div>
          <div><span>Highest Opportunity</span><strong>{pkr(Math.max(0,...visibleDetailRows.map(r=>Number(r.sales_value_ex_gst||0))))}</strong></div>
        </div>

        <label className="drawer-search">
          <Search size={17}/>
          <input value={detailSearch} onChange={e=>setDetailSearch(e.target.value)} placeholder="Search customer, item, salesperson or status..."/>
        </label>

        <div className="drawer-table-wrap">
          <table className="drawer-table">
            <thead><tr><th>#</th><th>Salesperson</th><th>Customer</th><th>Date</th><th>Item</th><th>Sales Value</th><th>GP</th><th>Probability</th><th>Status</th></tr></thead>
            <tbody>
              {visibleDetailRows.length===0
                ? <tr><td colSpan="9" className="drawer-empty">No matching records available.</td></tr>
                : visibleDetailRows.map((r,i)=><tr key={r.id}>
                    <td>{i+1}</td>
                    <td>{r.profiles?.full_name||'-'}</td>
                    <td>{r.customer_name||'-'}</td>
                    <td>{r.quotation_date||'-'}</td>
                    <td className="drawer-item-cell">{r.item||'-'}</td>
                    <td>{pkr(r.sales_value_ex_gst)}</td>
                    <td>{pkr(r.gp)}</td>
                    <td><span className="drawer-probability">{r.probability}%</span></td>
                    <td><span className="drawer-status">{r.quotation_status||'-'}</span></td>
                  </tr>)}
            </tbody>
          </table>
        </div>

        <div className="drawer-footer">
          <span>Showing {visibleDetailRows.length} record{visibleDetailRows.length===1?'':'s'}</span>
          <button className="secondary" type="button" onClick={closeDetails}>Close</button>
        </div>
      </aside>
    </div>}

    {showTarget&&<div className="modal"><form className="modal-card target-modal" onSubmit={saveTarget}><div className="modal-head"><h2>Set Sales Target</h2><button type="button" onClick={()=>setShowTarget(false)}>×</button></div><p className="note">Target for {now.toLocaleString('en-US',{month:'long'})} {CURRENT_YEAR}.</p><div className="form-grid"><label>Monthly Target (PKR)<input type="number" min="0" step="0.01" value={target.monthly_target} onChange={e=>setTarget({...target,monthly_target:e.target.value})}/></label><label>Yearly Target (PKR)<input type="number" min="0" step="0.01" value={target.yearly_target} onChange={e=>setTarget({...target,yearly_target:e.target.value})}/></label></div><div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowTarget(false)}>Cancel</button><button className="primary">Save Target</button></div></form></div>}
  </div>
}
