import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { pkr, useSales } from '../context/SalesContext'

const blank={customer_name:'',quotation_date:new Date().toISOString().slice(0,10),purchase_value:'',item:'',sales_value_ex_gst:'',vendor:'',vendor_terms:'',quotation_status:'Pending',probability:75,remarks:'',user_id:''}
export default function Opportunity(){
  const {id}=useParams(),navigate=useNavigate()
  const {profile,records,users,calc,saveRecord,deleteRecord}=useSales()
  const [form,setForm]=useState(blank),[busy,setBusy]=useState(false)
  useEffect(()=>{if(id){const r=records.find(x=>x.id===id);if(r)setForm({user_id:r.user_id,customer_name:r.customer_name,quotation_date:r.quotation_date,purchase_value:r.purchase_value,item:r.item,sales_value_ex_gst:r.sales_value_ex_gst,vendor:r.vendor||'',vendor_terms:r.vendor_terms||'',quotation_status:r.quotation_status,probability:r.probability,remarks:r.remarks||''})}else setForm({...blank,user_id:profile.role==='admin'?'':profile.id})},[id,records,profile])
  const c=calc(form)
  async function submit(e){e.preventDefault();setBusy(true);try{await saveRecord(form,id);navigate('/pipeline')}catch(err){alert(err.message)}finally{setBusy(false)}}
  async function remove(){if(!confirm('Delete this entry permanently?'))return;try{await deleteRecord(id);navigate('/pipeline')}catch(e){alert(e.message)}}
  return <div><div className="topbar"><div><h1>{id?'Edit Sales Opportunity':'Add Sales Opportunity'}</h1><p>All financial calculations update automatically</p></div></div><section className="panel form-panel"><form onSubmit={submit}><div className="form-grid">
    {profile.role==='admin'&&<label>Salesperson<select required value={form.user_id} onChange={e=>setForm({...form,user_id:e.target.value})}><option value="">Select salesperson</option>{users.filter(u=>u.role==='sales'&&u.active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>}
    <label>Customer Name<input required value={form.customer_name} onChange={e=>setForm({...form,customer_name:e.target.value})}/></label>
    <label>Quotation Submitted Date<input type="date" required value={form.quotation_date} onChange={e=>setForm({...form,quotation_date:e.target.value})}/></label>
    <label>Item / Solution<input required value={form.item} onChange={e=>setForm({...form,item:e.target.value})}/></label>
    <label>Purchase Value (PKR)<input type="number" min="0" step="0.01" value={form.purchase_value} onChange={e=>setForm({...form,purchase_value:e.target.value})}/></label>
    <label>Sales Value Excluding GST (PKR)<input type="number" min="0" step="0.01" required value={form.sales_value_ex_gst} onChange={e=>setForm({...form,sales_value_ex_gst:e.target.value})}/></label>
    <label>Vendor<input value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})}/></label>
    <label>Vendor Terms<input value={form.vendor_terms} onChange={e=>setForm({...form,vendor_terms:e.target.value})}/></label>
    <label>Quotation Status<select value={form.quotation_status} onChange={e=>setForm({...form,quotation_status:e.target.value})}><option>Pending</option><option>Submitted</option><option>Won</option><option>Lost</option><option>On Hold</option></select></label>
    <label>Probability (%)<input type="number" min="0" max="100" required value={form.probability} onChange={e=>setForm({...form,probability:e.target.value})}/></label>
    <label className="wide">Remarks<textarea rows="3" value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label>
  </div><div className="calc-preview">{[['GST',c.gst],['Including GST',c.incl],['WHT',c.wht],['Net Total',c.net],['Gross Profit',c.gp],['Ageing',`${c.age} days`]].map(([k,v])=><div key={k}><span>{k}</span><strong>{k==='Ageing'?v:pkr(v)}</strong></div>)}</div><div className="form-actions">{id&&<button type="button" className="danger-button" onClick={remove}>Delete Entry</button>}<button type="button" className="secondary" onClick={()=>navigate('/pipeline')}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving...':'Save Opportunity'}</button></div></form></section></div>
}
