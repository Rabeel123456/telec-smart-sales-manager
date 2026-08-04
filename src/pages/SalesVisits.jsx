import { useEffect, useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSales } from '../context/SalesContext'

const blank = { visit_date:new Date().toISOString().slice(0,10), person_id:'', client:'', city:'', mode:'', location:'', objective:'', status:'', remarks:'' }

export default function SalesVisits() {
  const { profile, users } = useSales()
  const [rows,setRows]=useState([]), [form,setForm]=useState(blank), [editingId,setEditingId]=useState(null), [showForm,setShowForm]=useState(false), [search,setSearch]=useState('')
  async function load(){const {data,error}=await supabase.from('sales_visit_reports').select('*').order('visit_date',{ascending:false});if(error)alert(error.message);else setRows(data||[])}
  useEffect(()=>{load()},[])
  function name(id){return users.find(u=>u.id===id)?.full_name || (id===profile.id?profile.full_name:'')}
  function add(){setForm({...blank,person_id:profile.role==='admin'?'':profile.id});setEditingId(null);setShowForm(true)}
  function edit(r){setForm({visit_date:r.visit_date,person_id:r.person_id,client:r.client,city:r.city,mode:r.mode,location:r.location,objective:r.objective,status:r.status,remarks:r.remarks||''});setEditingId(r.id);setShowForm(true)}
  async function save(e){e.preventDefault();const payload={...form,person_id:profile.role==='admin'?form.person_id:profile.id};if(!payload.person_id)return alert('Please select Person.');const q=editingId?supabase.from('sales_visit_reports').update(payload).eq('id',editingId):supabase.from('sales_visit_reports').insert(payload);const {error}=await q;if(error)alert(error.message);else{setShowForm(false);load()}}
  async function remove(id){if(!confirm('Delete this visit report?'))return;const {error}=await supabase.from('sales_visit_reports').delete().eq('id',id);if(error)alert(error.message);else load()}
  const filtered=rows.filter(r=>`${name(r.person_id)} ${r.client} ${r.city} ${r.mode} ${r.location} ${r.objective} ${r.status} ${r.remarks}`.toLowerCase().includes(search.toLowerCase()))
  return <div><div className="topbar"><div><h1>Sales Visit Report</h1><p>Salesperson visit records</p></div><div className="actions"><button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button><button className="primary" onClick={add}><Plus size={16}/> Add Visit</button></div></div><section className="panel"><div className="filters"><input placeholder="Search visit reports..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Person</th><th>Client</th><th>City</th><th>Mode</th><th>Location</th><th>Objective</th><th>Status</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>{filtered.length?filtered.map(r=><tr key={r.id}><td>{r.visit_date}</td><td>{name(r.person_id)}</td><td>{r.client}</td><td>{r.city}</td><td>{r.mode}</td><td>{r.location}</td><td>{r.objective}</td><td>{r.status}</td><td>{r.remarks}</td><td><button className="icon" onClick={()=>edit(r)}><Pencil size={15}/></button><button className="icon danger" onClick={()=>remove(r.id)}><Trash2 size={15}/></button></td></tr>):<tr><td colSpan="10" className="empty">No visit reports available.</td></tr>}</tbody></table></div></section>
  {showForm&&<div className="modal"><form className="modal-card" onSubmit={save}><div className="modal-head"><h2>{editingId?'Edit':'Add'} Sales Visit</h2><button type="button" onClick={()=>setShowForm(false)}>×</button></div><div className="form-grid">
    <label>Date<input type="date" required value={form.visit_date} onChange={e=>setForm({...form,visit_date:e.target.value})}/></label>
    {profile.role==='admin'?<label>Person<select required value={form.person_id} onChange={e=>setForm({...form,person_id:e.target.value})}><option value="">Select Person</option>{users.filter(u=>u.active!==false).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>:<label>Person<input value={profile.full_name} disabled/></label>}
    <label>Client<input required value={form.client} onChange={e=>setForm({...form,client:e.target.value})}/></label>
    <label>City<input required value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label>
    <label>Mode<input required value={form.mode} onChange={e=>setForm({...form,mode:e.target.value})}/></label>
    <label>Location<input required value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
    <label>Objective<input required value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})}/></label>
    <label>Status<input required value={form.status} onChange={e=>setForm({...form,status:e.target.value})}/></label>
    <label className="wide">Remarks<textarea rows="3" value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label>
  </div><div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary">Save Visit</button></div></form></div>}
  </div>
}
