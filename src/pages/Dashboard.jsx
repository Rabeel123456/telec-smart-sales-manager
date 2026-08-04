import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { pkr, useSales } from '../context/SalesContext'

export default function Dashboard() {
  const { profile, records, users, loading, load, calc } = useSales()
  const [person, setPerson] = useState('')
  const rows = useMemo(() => records.filter(r => !person || r.user_id === person).map(r => ({...r,...calc(r)})), [records,person,calc])
  const sum = key => rows.reduce((a,r)=>a+Number(r[key]||0),0)
  const band = (min,max) => rows.filter(r=>Number(r.probability)>=min&&Number(r.probability)<=max).reduce((a,r)=>a+Number(r.sales_value_ex_gst||0),0)
  const statuses=['Pending','Submitted','Won','Lost','On Hold']
  return <div>
    <div className="topbar"><div><h1>Sales Dashboard</h1><p>Live overview of quotations and probability pipeline</p></div><div className="actions"><button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button><Link className="primary button-link" to="/opportunity"><Plus size={16}/> Add Opportunity</Link></div></div>
    {profile.role==='admin'&&<div className="scope"><label>View salesperson <select value={person} onChange={e=>setPerson(e.target.value)}><option value="">All Salespersons</option>{users.filter(u=>u.role==='sales'&&u.active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label></div>}
    <div className="cards six">
      <div className="card"><span>Total Pipeline</span><strong>{pkr(sum('sales_value_ex_gst'))}</strong></div>
      <div className="card"><span>Total Gross Profit</span><strong>{pkr(sum('gp'))}</strong></div>
      <div className="card"><span>High Probability 67–100%</span><strong>{pkr(band(67,100))}</strong></div>
      <div className="card"><span>Medium Probability 34–66%</span><strong>{pkr(band(34,66))}</strong></div>
      <div className="card"><span>Low Probability 0–33%</span><strong>{pkr(band(0,33))}</strong></div>
      <div className="card"><span>Pending Quotations</span><strong>{rows.filter(r=>['Pending','Submitted'].includes(r.quotation_status)).length}</strong></div>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><h2>Probability Summary</h2>{[[67,100,'High'],[34,66,'Medium'],[0,33,'Low']].map(([min,max,label])=>{const v=band(min,max),total=Math.max(sum('sales_value_ex_gst'),1);return <div className="bar-row" key={label}><strong>{label}</strong><div className="bar-track"><div className="bar-fill" style={{width:`${v/total*100}%`}}/></div><span>{pkr(v)}</span></div>})}</section>
      <section className="panel"><h2>Quotation Status</h2>{statuses.map(s=><div className="status-row" key={s}><span>{s}</span><strong>{rows.filter(r=>r.quotation_status===s).length}</strong></div>)}</section>
    </div>
    <section className="panel"><div className="panel-head"><h2>Recent Opportunities</h2><Link to="/pipeline">View complete pipeline</Link></div><div className="table-wrap"><table><thead><tr><th>Salesperson</th><th>Customer</th><th>Date</th><th>Item</th><th>Sales</th><th>GP</th><th>Probability</th><th>Status</th></tr></thead><tbody>{loading?<tr><td colSpan="8">Loading...</td></tr>:rows.slice(0,8).map(r=><tr key={r.id}><td>{r.profiles?.full_name}</td><td>{r.customer_name}</td><td>{r.quotation_date}</td><td>{r.item}</td><td>{pkr(r.sales_value_ex_gst)}</td><td>{pkr(r.gp)}</td><td>{r.probability}%</td><td>{r.quotation_status}</td></tr>)}</tbody></table></div></section>
  </div>
}
