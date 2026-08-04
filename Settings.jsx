import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSales } from '../context/SalesContext'

export default function Settings({profile}) {
  const {settings,setSettings,load}=useSales()
  const [form,setForm]=useState(settings)
  useEffect(()=>setForm(settings),[settings])
  async function save(e){e.preventDefault();if(profile.role!=='admin')return;const payload={...form,gst_rate:Number(form.gst_rate),wht_rate:Number(form.wht_rate)};const {error}=await supabase.from('app_settings').update(payload).eq('id',1);if(error)alert(error.message);else{setSettings(payload);await load();alert('Settings saved.')}}
  return <div><div className="topbar"><div><h1>Settings</h1><p>Company and document settings</p></div></div><section className="panel settings-panel wide-settings"><form onSubmit={save}>
    <div className="note">Quotation, Delivery Challan and Invoice PDFs are printed without a logo, company name, address or branded footer so they can be printed directly on the company’s pre-printed A4 letterhead.</div>
    <h2>Calculation Settings</h2><div className="settings-grid"><label>GST Rate (%)<input type="number" step="0.01" value={form.gst_rate} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,gst_rate:e.target.value})}/></label><label>WHT Rate (%)<input type="number" step="0.01" value={form.wht_rate} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,wht_rate:e.target.value})}/></label></div>
    <h2>Quotation Settings</h2><div className="settings-grid"><label>Quotation Prefix<input value={form.quotation_prefix||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,quotation_prefix:e.target.value})}/></label><label>Default Validity<input value={form.quotation_default_validity||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,quotation_default_validity:e.target.value})}/></label><label>Default Payment Terms<input value={form.quotation_default_payment_terms||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,quotation_default_payment_terms:e.target.value})}/></label><label className="wide-setting">Quotation Intro Text<textarea rows="2" value={form.quotation_intro_text||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,quotation_intro_text:e.target.value})}/></label><label className="wide-setting">Quotation Footer / Terms<textarea rows="3" value={form.quotation_footer||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,quotation_footer:e.target.value})}/></label></div>
    <h2>Delivery Challan Settings</h2><div className="settings-grid"><label>Delivery Challan Prefix<input value={form.delivery_prefix||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,delivery_prefix:e.target.value})}/></label><label className="wide-setting">Delivery Challan Footer / Terms<textarea rows="3" value={form.delivery_footer||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,delivery_footer:e.target.value})}/></label></div>
    <h2>Invoice Settings</h2><div className="settings-grid"><label>Invoice Prefix<input value={form.invoice_prefix||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,invoice_prefix:e.target.value})}/></label><label className="wide-setting">Invoice Footer / Terms<textarea rows="3" value={form.invoice_footer||''} disabled={profile.role!=='admin'} onChange={e=>setForm({...form,invoice_footer:e.target.value})}/></label></div>
    {profile.role==='admin'&&<button className="primary">Save Settings</button>}
  </form></section></div>
}
