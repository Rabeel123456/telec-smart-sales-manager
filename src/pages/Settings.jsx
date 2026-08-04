import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSales } from '../context/SalesContext'

const blankCompany = () => ({
  id: '',
  company_name: '',
  short_name: '',
  letterhead_url: '',
  quotation_prefix: 'QT',
  delivery_prefix: 'DC',
  invoice_prefix: 'INV',
  top_margin_mm: 55,
  bottom_margin_mm: 18,
  active: true
})

export default function Settings({profile}) {
  const {settings,setSettings,load}=useSales()
  const [form,setForm]=useState(settings)
  const [companies,setCompanies]=useState([])
  const [companyForm,setCompanyForm]=useState(blankCompany())
  const [letterheadFile,setLetterheadFile]=useState(null)
  const [savingCompany,setSavingCompany]=useState(false)

  useEffect(()=>setForm(settings),[settings])
  useEffect(()=>{loadCompanies()},[])

  async function loadCompanies(){
    const {data,error}=await supabase.from('companies').select('*').order('company_name')
    if(error) alert(error.message)
    else setCompanies(data||[])
  }

  async function save(e){
    e.preventDefault()
    if(profile.role!=='admin')return
    const payload={...form,gst_rate:Number(form.gst_rate),wht_rate:Number(form.wht_rate)}
    const {error}=await supabase.from('app_settings').update(payload).eq('id',1)
    if(error)alert(error.message)
    else{setSettings(payload);await load();alert('Settings saved.')}
  }

  function editCompany(company){
    setCompanyForm({...blankCompany(),...company})
    setLetterheadFile(null)
    window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})
  }

  function newCompany(){
    setCompanyForm(blankCompany())
    setLetterheadFile(null)
  }

  async function uploadLetterhead(companyId){
    if(!letterheadFile) return companyForm.letterhead_url || ''
    if(!['image/jpeg','image/png','image/webp'].includes(letterheadFile.type)){
      throw new Error('Letterhead scan JPG, PNG ya WEBP image format mein upload karein.')
    }
    const ext=(letterheadFile.name.split('.').pop()||'jpg').toLowerCase()
    const path=`${companyId}/${Date.now()}.${ext}`
    const {error}=await supabase.storage.from('company-letterheads').upload(path,letterheadFile,{upsert:true,contentType:letterheadFile.type})
    if(error) throw error
    const {data}=supabase.storage.from('company-letterheads').getPublicUrl(path)
    return data.publicUrl
  }

  async function saveCompany(e){
    e.preventDefault()
    if(profile.role!=='admin') return
    setSavingCompany(true)
    try{
      const companyId=companyForm.id || crypto.randomUUID()
      const letterheadUrl=await uploadLetterhead(companyId)
      const payload={
        id:companyId,
        company_name:companyForm.company_name.trim(),
        short_name:companyForm.short_name.trim(),
        letterhead_url:letterheadUrl,
        quotation_prefix:(companyForm.quotation_prefix||'QT').trim(),
        delivery_prefix:(companyForm.delivery_prefix||'DC').trim(),
        invoice_prefix:(companyForm.invoice_prefix||'INV').trim(),
        top_margin_mm:Number(companyForm.top_margin_mm||55),
        bottom_margin_mm:Number(companyForm.bottom_margin_mm||18),
        active:Boolean(companyForm.active)
      }
      const {error}=await supabase.from('companies').upsert(payload)
      if(error) throw error
      await loadCompanies()
      newCompany()
      alert('Company and letterhead saved successfully.')
    }catch(error){alert(error.message)}finally{setSavingCompany(false)}
  }

  async function deleteCompany(id){
    if(!confirm('Delete this company? Existing documents will keep their saved company reference.')) return
    const {error}=await supabase.from('companies').delete().eq('id',id)
    if(error) alert(error.message)
    else loadCompanies()
  }

  return <div>
    <div className="topbar"><div><h1>Settings</h1><p>Company, letterhead and document settings</p></div></div>

    <section className="panel settings-panel wide-settings">
      <h2>Companies & Letterheads</h2>
      <div className="note">Scanned A4 letterhead JPG/PNG upload karein. Quotation, Delivery Challan aur Invoice banate waqt company select hogi aur selected letterhead PDF ke background par print hoga.</div>
      <div className="table-wrap"><table><thead><tr><th>Company</th><th>Short Name</th><th>Letterhead</th><th>Quotation Prefix</th><th>DO Prefix</th><th>Invoice Prefix</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{companies.length?companies.map(c=><tr key={c.id}><td>{c.company_name}</td><td>{c.short_name}</td><td>{c.letterhead_url?<a href={c.letterhead_url} target="_blank" rel="noreferrer">View</a>:'Not uploaded'}</td><td>{c.quotation_prefix}</td><td>{c.delivery_prefix}</td><td>{c.invoice_prefix}</td><td>{c.active?'Active':'Inactive'}</td><td><button className="icon" onClick={()=>editCompany(c)}><Pencil size={15}/></button><button className="icon danger" onClick={()=>deleteCompany(c.id)}><Trash2 size={15}/></button></td></tr>):<tr><td colSpan="8" className="empty">No companies added.</td></tr>}</tbody></table></div>

      {profile.role==='admin'&&<form onSubmit={saveCompany} className="company-form">
        <div className="panel-title"><h2>{companyForm.id?'Edit Company':'Add Company'}</h2><button type="button" className="secondary" onClick={newCompany}><Plus size={15}/> New</button></div>
        <div className="settings-grid">
          <label>Company Name<input required value={companyForm.company_name} onChange={e=>setCompanyForm({...companyForm,company_name:e.target.value})}/></label>
          <label>Short Name<input required value={companyForm.short_name} onChange={e=>setCompanyForm({...companyForm,short_name:e.target.value})}/></label>
          <label>Quotation Prefix<input value={companyForm.quotation_prefix} onChange={e=>setCompanyForm({...companyForm,quotation_prefix:e.target.value})}/></label>
          <label>Delivery Challan Prefix<input value={companyForm.delivery_prefix} onChange={e=>setCompanyForm({...companyForm,delivery_prefix:e.target.value})}/></label>
          <label>Invoice Prefix<input value={companyForm.invoice_prefix} onChange={e=>setCompanyForm({...companyForm,invoice_prefix:e.target.value})}/></label>
          <label>Top Blank Area (mm)<input type="number" min="0" max="100" value={companyForm.top_margin_mm} onChange={e=>setCompanyForm({...companyForm,top_margin_mm:e.target.value})}/></label>
          <label>Bottom Blank Area (mm)<input type="number" min="0" max="60" value={companyForm.bottom_margin_mm} onChange={e=>setCompanyForm({...companyForm,bottom_margin_mm:e.target.value})}/></label>
          <label>Active<select value={String(companyForm.active)} onChange={e=>setCompanyForm({...companyForm,active:e.target.value==='true'})}><option value="true">Active</option><option value="false">Inactive</option></select></label>
          <label className="wide-setting">Upload Scanned A4 Letterhead (JPG/PNG/WEBP)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setLetterheadFile(e.target.files?.[0]||null)}/>{companyForm.letterhead_url&&<small>Current letterhead saved. Select a new scan only when replacing it.</small>}</label>
        </div>
        <button className="primary" disabled={savingCompany}><Upload size={16}/>{savingCompany?'Uploading...':'Save Company & Letterhead'}</button>
      </form>}
    </section>

    <section className="panel settings-panel wide-settings"><form onSubmit={save}>
      <h2>Calculation Settings</h2><div className="settings-grid"><label>GST Rate (%)<input type="number" step="0.01" value={form.gst_rate} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,gst_rate:e.target.value})}/></label><label>WHT Rate (%)<input type="number" step="0.01" value={form.wht_rate} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,wht_rate:e.target.value})}/></label></div>
      <h2>Default Document Settings</h2><div className="settings-grid"><label>Default Validity<input value={form.quotation_default_validity||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,quotation_default_validity:e.target.value})}/></label><label>Default Payment Terms<input value={form.quotation_default_payment_terms||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,quotation_default_payment_terms:e.target.value})}/></label><label className="wide-setting">Quotation Intro Text<textarea rows="2" value={form.quotation_intro_text||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,quotation_intro_text:e.target.value})}/></label><label className="wide-setting">Quotation Footer / Terms<textarea rows="3" value={form.quotation_footer||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,quotation_footer:e.target.value})}/></label><label className="wide-setting">Delivery Challan Footer / Terms<textarea rows="3" value={form.delivery_footer||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,delivery_footer:e.target.value})}/></label><label className="wide-setting">Invoice Footer / Terms<textarea rows="3" value={form.invoice_footer||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,invoice_footer:e.target.value})}/></label></div>
      {profile.role==='admin'&&<button className="primary">Save Default Settings</button>}
    </form></section>
  </div>
}
