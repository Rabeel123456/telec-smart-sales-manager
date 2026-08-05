import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Download, Eye, MessageCircle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { pkr, useSales } from '../context/SalesContext'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', qty: 1, rate: '', gst_rate: 18, purchase_rate: '' })

const CONFIG = {
  quotation: { title:'Quotations', singular:'Quotation', table:'quotations', prefixKey:'quotation_prefix', footerKey:'quotation_footer', statuses:['Draft','Submitted','Approved','Rejected','Cancelled'] },
  delivery: { title:'Delivery Challans', singular:'Delivery Challan', table:'delivery_challans', prefixKey:'delivery_prefix', footerKey:'delivery_footer', statuses:['Draft','Pending','Delivered','Cancelled'] },
  invoice: { title:'Invoices', singular:'Invoice', table:'invoices', prefixKey:'invoice_prefix', footerKey:'invoice_footer', statuses:['Draft','Issued','Paid','Cancelled'] }
}

const sumItems = items => {
  const normalized = (items || []).map(x => {
    const qty = Number(x.qty || 0), rate = Number(x.rate || 0), gstRate = Number(x.gst_rate || 0)
    const line = qty * rate, gst = line * gstRate / 100
    return { ...x, qty, rate, gst_rate: gstRate, purchase_rate: Number(x.purchase_rate || 0), gst_amount: gst, total: line + gst }
  })
  return {
    items: normalized,
    subtotal: normalized.reduce((a,x)=>a+x.qty*x.rate,0),
    gst: normalized.reduce((a,x)=>a+x.gst_amount,0),
    grand: normalized.reduce((a,x)=>a+x.total,0),
    purchase: normalized.reduce((a,x)=>a+x.qty*x.purchase_rate,0)
  }
}

export default function Documents({ type }) {
  const cfg = CONFIG[type]
  const { profile, records, users, settings, load: reloadSales } = useSales()
  const [rows,setRows]=useState([]), [quotations,setQuotations]=useState([]), [deliveries,setDeliveries]=useState([]), [companies,setCompanies]=useState([]), [signatories,setSignatories]=useState([])
  const [search,setSearch]=useState(''), [showForm,setShowForm]=useState(false), [editingId,setEditingId]=useState(null)
  const [form,setForm]=useState({})
  const salesUsers=users.filter(u=>u.role==='sales'&&u.active)
  const userName=id=>users.find(u=>u.id===id)?.full_name||''
  const companyName=id=>companies.find(c=>c.id===id)?.company_name||''
  const companyById=id=>companies.find(c=>c.id===id)

  async function load(){
    const [{data,error},{data:qs},{data:ds},{data:cs},{data:ss}]=await Promise.all([
      supabase.from(cfg.table).select('*').order('created_at',{ascending:false}),
      supabase.from('quotations').select('*').order('created_at',{ascending:false}),
      supabase.from('delivery_challans').select('*').order('created_at',{ascending:false}),
      supabase.from('companies').select('*').eq('active',true).order('company_name'),
      supabase.from('authorized_signatories').select('*').eq('active',true).order('signatory_name')
    ])
    if(error)return alert(error.message);setRows(data||[]);setQuotations(qs||[]);setDeliveries(ds||[]);setCompanies(cs||[]);setSignatories(ss||[])
  }
  useEffect(()=>{load();setShowForm(false);setEditingId(null)},[type])

  const filtered=rows.filter(r=>`${r.document_no||''} ${r.customer_name||''} ${r.status||''}`.toLowerCase().includes(search.toLowerCase()))
  const prefixForCompany=id=>{const c=companyById(id);return type==='quotation'?c?.quotation_prefix:type==='delivery'?c?.delivery_prefix:c?.invoice_prefix}
  const nextNumber=(companyId='')=>`${prefixForCompany(companyId)||settings?.[cfg.prefixKey]||({quotation:'QT',delivery:'DC',invoice:'INV'})[type]}-${new Date().getFullYear()}-${String(rows.length+1).padStart(4,'0')}`
  const initialForm=()=>({
    user_id:profile.role==='admin'?'':profile.id, company_id:companies[0]?.id||'', opportunity_id:'', quotation_id:'', delivery_challan_id:'',
    document_no:nextNumber(companies[0]?.id||''), document_date:today(), status:'Draft', customer_name:'', contact_person:'', customer_address:'',
    subject:'', validity:settings.quotation_default_validity||'15 days from date of issue', payment_terms:settings.quotation_default_payment_terms||'',
    items:[blankItem()], remarks:'', authorized_signatory_id:'', receiver_name:'', receiver_designation:'', received_date:today(), receiver_contact:'', vendor:'', vendor_terms:'', probability:75, invoice_source:'delivery'
  })
  function reset(){setForm(initialForm());setEditingId(null);setShowForm(true)}
  function edit(r){setForm({...initialForm(),...r,items:Array.isArray(r.items)&&r.items.length?r.items:[blankItem()]});setEditingId(r.id);setShowForm(true)}
  function setItem(i,key,value){setForm(f=>({...f,items:f.items.map((x,n)=>n===i?{...x,[key]:value}:x)}))}
  function addItem(){setForm(f=>({...f,items:[...f.items,blankItem()]}))}
  function removeItem(i){setForm(f=>({...f,items:f.items.length===1?f.items:f.items.filter((_,n)=>n!==i)}))}

  function fromQuotation(id){
    const q=quotations.find(x=>x.id===id);if(!q)return
    setForm(f=>({...f,company_id:q.company_id||f.company_id,quotation_id:q.id,opportunity_id:q.opportunity_id,user_id:q.user_id,customer_name:q.customer_name,contact_person:q.contact_person||'',customer_address:q.customer_address||'',items:q.items||[blankItem()],vendor:q.vendor||'',vendor_terms:q.vendor_terms||'',probability:q.probability||75,remarks:''}))
  }
  function fromDelivery(id){
    const d=deliveries.find(x=>x.id===id);if(!d)return
    setForm(f=>({...f,company_id:d.company_id||f.company_id,delivery_challan_id:d.id,quotation_id:d.quotation_id,opportunity_id:d.opportunity_id,user_id:d.user_id,customer_name:d.customer_name,contact_person:d.contact_person||'',customer_address:d.customer_address||'',items:d.items||[blankItem()],vendor:d.vendor||'',vendor_terms:d.vendor_terms||'',probability:100,remarks:''}))
  }

  const totals=useMemo(()=>sumItems(form.items||[]),[form.items])
  async function save(e){
    e.preventDefault()
    try{
      if(!form.company_id)throw new Error('Please select a company.')
      if(!form.user_id&&profile.role==='admin')throw new Error('Please select a salesperson.')
      if(type==='delivery'&&!form.quotation_id)throw new Error('First select a Quotation.')
      if(type==='invoice'&&form.invoice_source==='delivery'&&!form.delivery_challan_id)throw new Error('First select a Delivery Challan, or choose Direct Invoice.')
      if(!form.items.some(x=>x.description.trim()&&Number(x.qty)>0))throw new Error('Please add at least one item.')

      const mainItem=form.items.map(x=>x.description).filter(Boolean).join(' | ')
      const opportunityPayload={
        user_id:profile.role==='admin'?form.user_id:profile.id, customer_name:form.customer_name.trim(), quotation_date:form.document_date,
        purchase_value:totals.purchase, item:mainItem, sales_value_ex_gst:totals.subtotal, vendor:form.vendor||'', vendor_terms:form.vendor_terms||'',
        quotation_status:type==='invoice'?'Won':type==='quotation'&&form.status==='Draft'?'Pending':'Submitted', probability:type==='invoice'?100:Number(form.probability||75), remarks:form.remarks||''
      }
      let opportunityId=form.opportunity_id
      if(type==='invoice'&&!opportunityId){
        const {data,error}=await supabase.from('sales_records').insert({...opportunityPayload,quotation_status:'Won',probability:100,closing_date:form.document_date}).select('id').single();if(error)throw error;opportunityId=data.id
      }
      if(type==='quotation'){
        if(opportunityId){const {error}=await supabase.from('sales_records').update(opportunityPayload).eq('id',opportunityId);if(error)throw error}
        else{const {data,error}=await supabase.from('sales_records').insert(opportunityPayload).select('id').single();if(error)throw error;opportunityId=data.id}
      }
      const payload={
        company_id:form.company_id, user_id:profile.role==='admin'?form.user_id:profile.id, opportunity_id:opportunityId, document_no:form.document_no.trim(), document_date:form.document_date,
        status:form.status, remarks:form.remarks||'', customer_name:form.customer_name.trim(), contact_person:form.contact_person||'', customer_address:form.customer_address||'',
        subject:form.subject||'', validity:form.validity||'', payment_terms:form.payment_terms||'', items:totals.items,
        subtotal:totals.subtotal, gst_amount:totals.gst, grand_total:totals.grand, item:mainItem, purchase_value:totals.purchase,
        sales_value_ex_gst:totals.subtotal, vendor:form.vendor||'', vendor_terms:form.vendor_terms||'', probability:type==='invoice'?100:Number(form.probability||75),
        authorized_signatory_id:form.authorized_signatory_id||null, receiver_name:form.receiver_name||'', receiver_designation:form.receiver_designation||'', received_date:form.received_date||null, receiver_contact:form.receiver_contact||''
      }
      if(type==='delivery')payload.quotation_id=form.quotation_id
      if(type==='invoice'){payload.quotation_id=form.quotation_id||null;payload.delivery_challan_id=form.invoice_source==='delivery'?(form.delivery_challan_id||null):null;payload.invoice_source=form.invoice_source||'delivery'}
      const allowed = type === 'quotation'
        ? ['company_id','user_id','opportunity_id','document_no','document_date','status','remarks','customer_name','contact_person','customer_address','subject','validity','payment_terms','items','subtotal','gst_amount','grand_total','item','purchase_value','sales_value_ex_gst','vendor','vendor_terms','probability','authorized_signatory_id','receiver_name','receiver_designation','received_date']
        : type === 'delivery'
          ? ['company_id','user_id','opportunity_id','quotation_id','document_no','document_date','status','remarks','customer_name','contact_person','customer_address','items','subtotal','gst_amount','grand_total','item','purchase_value','sales_value_ex_gst','vendor','vendor_terms','probability','authorized_signatory_id','receiver_name','receiver_designation','received_date','receiver_contact']
          : ['company_id','user_id','opportunity_id','quotation_id','delivery_challan_id','invoice_source','document_no','document_date','status','remarks','customer_name','contact_person','customer_address','items','subtotal','gst_amount','grand_total','item','purchase_value','sales_value_ex_gst','vendor','vendor_terms','probability','authorized_signatory_id','receiver_name','receiver_designation','received_date']
      const clean = Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)))
      const q=editingId?supabase.from(cfg.table).update(clean).eq('id',editingId):supabase.from(cfg.table).insert(clean)
      const {error}=await q;if(error)throw error
      if(type==='invoice'){
        const {error:closeError}=await supabase.from('sales_records').update({...opportunityPayload,closing_date:form.document_date}).eq('id',opportunityId);if(closeError)throw closeError
      }
      setShowForm(false);await Promise.all([load(),reloadSales()])
    }catch(err){alert(err.message)}
  }
  async function remove(id){if(!confirm(`Delete this ${cfg.singular}?`))return;const {error}=await supabase.from(cfg.table).delete().eq('id',id);if(error)alert(error.message);else load()}

  async function buildPdf(row){
    const t = sumItems(row.items || [])
    const company=companyById(row.company_id)
    const signatory=signatories.find(x=>x.id===row.authorized_signatory_id) || signatories.find(x=>x.company_id===row.company_id && x.is_default) || signatories.find(x=>!x.company_id && x.is_default) || signatories[0]
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

    const imageToDataUrl=async url=>{
      if(!url)return null
      const response=await fetch(url)
      if(!response.ok)throw new Error('Letterhead image could not be loaded.')
      const blob=await response.blob()
      return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})
    }
    let letterheadData=null, signatureData=null, stampData=null
    try{letterheadData=await imageToDataUrl(company?.letterhead_url)}catch(error){alert(error.message)}
    try{signatureData=await imageToDataUrl(signatory?.signature_url)}catch(error){console.warn(error)}
    try{stampData=await imageToDataUrl(signatory?.stamp_url)}catch(error){console.warn(error)}
    const drawLetterhead=()=>{if(letterheadData){const fmt=letterheadData.startsWith('data:image/png')?'PNG':letterheadData.startsWith('data:image/webp')?'WEBP':'JPEG';doc.addImage(letterheadData,fmt,0,0,210,297)}}
    drawLetterhead()
    const topMargin = Number(company?.top_margin_mm||55)
    const sideMargin = 14
    const bottomLimit = 297-Number(company?.bottom_margin_mm||18)

    doc.setTextColor(25, 25, 25)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(cfg.singular.toUpperCase(), 105, topMargin, { align: 'center' })
    doc.setDrawColor(80)
    doc.line(76, topMargin + 2, 134, topMargin + 2)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const meta = [
      [`${cfg.singular} No.`, row.document_no || '-'],
      ['Date', new Date(`${row.document_date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })],
      ['Customer / Prepared For', row.customer_name || '-'],
      ['Contact Person', row.contact_person || '-']
    ]
    if (row.customer_address) meta.push(['Address', row.customer_address])
    if (type === 'quotation') meta.push(['Validity', row.validity || '-'])

    autoTable(doc, {
      startY: topMargin + 7,
      margin: { left: sideMargin, right: sideMargin },
      body: meta,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 43 }, 1: { cellWidth: 139 } }
    })

    let y = doc.lastAutoTable.finalY + 6
    if (row.subject) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.text(row.subject, sideMargin, y, { maxWidth: 182 })
      y += 7
    }

    const head = type === 'delivery'
      ? [['SR#', 'ITEM DESCRIPTION / SPECIFICATIONS', 'QTY', 'DELIVERED QTY', 'REMARKS']]
      : [['SR#', 'ITEM DESCRIPTION / SPECIFICATIONS', 'QTY', 'RATE', 'GST %', 'GST AMOUNT', 'TOTAL AMOUNT']]

    const body = type === 'delivery'
      ? t.items.map((x, i) => [String(i + 1).padStart(2, '0'), x.description, x.qty, x.qty, ''])
      : t.items.map((x, i) => [String(i + 1).padStart(2, '0'), x.description, x.qty, pkr(x.rate), `${x.gst_rate}%`, pkr(x.gst_amount), pkr(x.total)])

    autoTable(doc, {
      startY: y,
      margin: { left: sideMargin, right: sideMargin, bottom: 28 },
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 7.2, cellPadding: 2, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: [235, 239, 242], textColor: [25, 25, 25], fontStyle: 'bold' },
      columnStyles: type === 'delivery'
        ? { 0: { cellWidth: 12 }, 1: { cellWidth: 104 }, 2: { cellWidth: 18 }, 3: { cellWidth: 23 }, 4: { cellWidth: 25 } }
        : { 0: { cellWidth: 11 }, 1: { cellWidth: 72 }, 2: { cellWidth: 12 }, 3: { cellWidth: 24 }, 4: { cellWidth: 16 }, 5: { cellWidth: 25 }, 6: { cellWidth: 28 } },
      willDrawPage: data => { if(data.pageNumber>1) drawLetterhead() },
      didDrawPage: data => {
        if (data.pageNumber > 1) {
          doc.setFontSize(7)
          doc.text(`${cfg.singular} ${row.document_no || ''} - Continued`, sideMargin, 14)
        }
      }
    })

    y = doc.lastAutoTable.finalY + 4
    if (type !== 'delivery') {
      autoTable(doc, {
        startY: y,
        margin: { left: 119, right: sideMargin },
        body: [['Sub Total', pkr(t.subtotal)], ['GST', pkr(t.gst)], ['Grand Total', pkr(t.grand)]],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 1: { halign: 'right', cellWidth: 42 } }
      })
      y = doc.lastAutoTable.finalY + 7
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    if (type === 'quotation' && row.payment_terms) {
      doc.text(`PAYMENT TERM: ${row.payment_terms}`, sideMargin, y, { maxWidth: 182 })
      y += 7
    }
    if (row.remarks) {
      doc.text(`Remarks: ${row.remarks}`, sideMargin, y, { maxWidth: 182 })
      y += 7
    }
    const footer = settings?.[cfg.footerKey]
    if (footer && y < bottomLimit) { doc.text(footer, sideMargin, y, { maxWidth: 182 }); y += 9 }

    // Authorization and customer acknowledgement block for all documents.
    const requiredHeight = 58
    if (y > bottomLimit - requiredHeight) {
      doc.addPage()
      drawLetterhead()
      y = Number(company?.top_margin_mm||55)
    } else {
      y += 5
    }

    doc.setDrawColor(155)
    doc.setLineWidth(0.25)
    doc.line(sideMargin, y, 196, y)
    y += 6
    doc.setFont('helvetica','bold')
    doc.setFontSize(8.5)
    doc.text('AUTHORIZED BY', sideMargin, y)
    doc.text('RECEIVED BY', 112, y)
    doc.setFont('helvetica','normal')
    doc.setFontSize(8)

    const authName = signatory?.signatory_name || 'Mirza Samad Saqlain'
    const authDesignation = signatory?.designation || 'CEO'
    doc.text(`Name: ${authName}`, sideMargin, y + 7)
    doc.text(`Designation: ${authDesignation}`, sideMargin, y + 13)
    if (signatureData) {
      const fmt=signatureData.startsWith('data:image/png')?'PNG':signatureData.startsWith('data:image/webp')?'WEBP':'JPEG'
      doc.addImage(signatureData,fmt,sideMargin,y+16,38,12,undefined,'FAST')
    } else doc.text('Signature: ______________________', sideMargin, y + 23)
    if (stampData) {
      const fmt=stampData.startsWith('data:image/png')?'PNG':stampData.startsWith('data:image/webp')?'WEBP':'JPEG'
      doc.addImage(stampData,fmt,58,y+15,32,20,undefined,'FAST')
    } else doc.text('Authorized Stamp', 58, y + 23)

    doc.text(`Customer Name: ${row.receiver_name || row.customer_name || '____________________'}`, 112, y + 7)
    doc.text(`Designation: ${row.receiver_designation || '____________________'}`, 112, y + 13)
    doc.text('Signature: __________________________', 112, y + 20)
    doc.text('Company Stamp:', 112, y + 27)
    doc.rect(145, y + 23, 38, 16)
    doc.text(`Date: ${row.received_date ? new Date(`${row.received_date}T00:00:00`).toLocaleDateString('en-GB') : '____ / ____ / ______'}`, 112, y + 46)

    return doc
  }

  async function exportPdf(row){
    try{
      const doc=await buildPdf(row)
      doc.save(`${row.document_no}.pdf`)
    }catch(error){alert(error.message)}
  }

  async function viewPdf(row){
    const previewWindow=window.open('', '_blank')
    if(!previewWindow){alert('Please allow pop-ups to view the document.');return}
    previewWindow.document.write('<title>Preparing document...</title><p style="font-family:Arial;padding:20px">Preparing document preview...</p>')
    try{
      const doc=await buildPdf(row)
      const blob=doc.output('blob')
      const url=URL.createObjectURL(blob)
      previewWindow.location.href=url
      setTimeout(()=>URL.revokeObjectURL(url),60000)
    }catch(error){previewWindow.close();alert(error.message)}
  }

  async function shareWhatsApp(row){
    try{
      const doc=await buildPdf(row)
      const blob=doc.output('blob')
      const fileName=`${row.document_no}.pdf`
      const file=new File([blob],fileName,{type:'application/pdf'})
      const message=`${cfg.singular} ${row.document_no} - ${row.customer_name || ''}`

      if(navigator.share && navigator.canShare?.({files:[file]})){
        await navigator.share({title:message,text:message,files:[file]})
        return
      }

      // Desktop browser fallback: download the PDF and open WhatsApp with a ready message.
      doc.save(fileName)
      window.open(`https://wa.me/?text=${encodeURIComponent(`${message}\nPDF has been downloaded. Please attach ${fileName} in WhatsApp.`)}`,'_blank','noopener,noreferrer')
    }catch(error){
      if(error?.name!=='AbortError')alert(error.message)
    }
  }

  const sourceQ=profile.role==='admin'?quotations:quotations.filter(q=>q.user_id===profile.id)
  const sourceD=profile.role==='admin'?deliveries:deliveries.filter(d=>d.user_id===profile.id)
  return <div>
    <div className="topbar"><div><h1>{cfg.title}</h1><p>{type==='quotation'?'Create professional quotations with multiple items':type==='delivery'?'Create Delivery Challan from a Quotation':'Create Invoice from Delivery Challan or create a Direct Invoice'}</p></div><div className="actions"><button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button><button className="primary" onClick={reset}><Plus size={16}/> Add {cfg.singular}</button></div></div>
    <section className="panel"><div className="filters"><input placeholder={`Search ${cfg.title.toLowerCase()}...`} value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="table-wrap"><table><thead><tr><th>#</th><th>No.</th><th>Date</th><th>Company</th><th>Salesperson</th><th>Customer</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.length?filtered.map((r,i)=><tr key={r.id}><td>{i+1}</td><td>{r.document_no}</td><td>{r.document_date}</td><td>{companyName(r.company_id)}</td><td>{userName(r.user_id)}</td><td>{r.customer_name}</td><td>{pkr(r.grand_total||r.sales_value_ex_gst)}</td><td>{r.status}</td><td className="document-actions"><button className="icon" title="Edit" onClick={()=>edit(r)}><Pencil size={15}/></button><button className="icon" title="View" onClick={()=>viewPdf(r)}><Eye size={15}/></button><button className="icon" title="Download PDF" onClick={()=>exportPdf(r)}><Download size={15}/></button><button className="icon whatsapp-action" title="Share on WhatsApp" onClick={()=>shareWhatsApp(r)}><MessageCircle size={15}/></button><button className="icon danger" title="Delete" onClick={()=>remove(r.id)}><Trash2 size={15}/></button></td></tr>):<tr><td colSpan="9" className="empty">No records available.</td></tr>}</tbody></table></div></section>
    {showForm&&<div className="modal"><form className="modal-card document-pro-modal" onSubmit={save}><div className="modal-head"><h2>{editingId?'Edit':'Add'} {cfg.singular}</h2><button type="button" onClick={()=>setShowForm(false)}>×</button></div>
      <div className="form-grid">
        {type==='delivery'&&<label className="wide">Related Quotation<select required value={form.quotation_id} onChange={e=>fromQuotation(e.target.value)}><option value="">Select Quotation</option>{sourceQ.map(q=><option key={q.id} value={q.id}>{q.document_no} | {q.customer_name}</option>)}</select></label>}
        {type==='invoice'&&<><label>Invoice Source<select value={form.invoice_source||'delivery'} onChange={e=>setForm({...form,invoice_source:e.target.value,delivery_challan_id:'',quotation_id:'',opportunity_id:'',customer_name:'',contact_person:'',customer_address:'',items:[blankItem()]})}><option value="delivery">From Delivery Challan</option><option value="direct">Direct Invoice (Without DO)</option></select></label>{form.invoice_source!=='direct'?<label className="wide">Related Delivery Challan<select required value={form.delivery_challan_id} onChange={e=>fromDelivery(e.target.value)}><option value="">Select Delivery Challan</option>{sourceD.map(d=><option key={d.id} value={d.id}>{d.document_no} | {d.customer_name}</option>)}</select></label>:<label className="wide">Related Quotation (Optional)<select value={form.quotation_id||''} onChange={e=>fromQuotation(e.target.value)}><option value="">No Quotation / Manual Invoice</option>{sourceQ.map(q=><option key={q.id} value={q.id}>{q.document_no} | {q.customer_name}</option>)}</select></label>}</>}
        <label>Company<select required value={form.company_id||''} onChange={e=>{const id=e.target.value;setForm({...form,company_id:id,document_no:editingId?form.document_no:nextNumber(id)})}}><option value="">Select company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select></label>
        {profile.role==='admin'&&<label>Salesperson<select required value={form.user_id} onChange={e=>setForm({...form,user_id:e.target.value})}><option value="">Select salesperson</option>{salesUsers.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>}
        <label>{cfg.singular} No.<input required value={form.document_no} onChange={e=>setForm({...form,document_no:e.target.value})}/></label><label>Date<input type="date" required value={form.document_date} onChange={e=>setForm({...form,document_date:e.target.value})}/></label>
        <label>Customer / Prepared For<input required value={form.customer_name} onChange={e=>setForm({...form,customer_name:e.target.value})}/></label><label>Contact Person<input value={form.contact_person} onChange={e=>setForm({...form,contact_person:e.target.value})}/></label><label>Customer Address<input value={form.customer_address} onChange={e=>setForm({...form,customer_address:e.target.value})}/></label>
        {type==='quotation'&&<><label className="wide">Subject / Configuration Title<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label><label>Validity<input value={form.validity} onChange={e=>setForm({...form,validity:e.target.value})}/></label><label>Payment Terms<input value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})}/></label></>}
        {type==='delivery'&&<label>Receiver Contact<input value={form.receiver_contact} onChange={e=>setForm({...form,receiver_contact:e.target.value})}/></label>}
        <label>Authorized By<select value={form.authorized_signatory_id||''} onChange={e=>setForm({...form,authorized_signatory_id:e.target.value})}><option value="">Default: Mirza Samad Saqlain - CEO</option>{signatories.filter(x=>!x.company_id||x.company_id===form.company_id).map(x=><option key={x.id} value={x.id}>{x.signatory_name} - {x.designation}</option>)}</select></label>
        <label>Received By / Customer Name<input value={form.receiver_name||''} onChange={e=>setForm({...form,receiver_name:e.target.value})}/></label>
        <label>Received By Designation<input value={form.receiver_designation||''} onChange={e=>setForm({...form,receiver_designation:e.target.value})}/></label>
        <label>Received Date<input type="date" value={form.received_date||''} onChange={e=>setForm({...form,received_date:e.target.value})}/></label>
      </div>
      <div className="document-items"><div className="document-items-head"><h3>Items</h3><button type="button" className="secondary" onClick={addItem}>+ Add Item</button></div><div className="table-wrap"><table><thead><tr><th>SR</th><th>Description / Specifications</th><th>Qty</th><th>Purchase Rate</th><th>Sale Rate</th><th>GST %</th><th>Total</th><th></th></tr></thead><tbody>{(form.items||[]).map((x,i)=>{const line=sumItems([x]).items[0];return <tr key={i}><td>{i+1}</td><td><textarea rows="3" required value={x.description} onChange={e=>setItem(i,'description',e.target.value)}/></td><td><input type="number" min="0.01" step="0.01" value={x.qty} onChange={e=>setItem(i,'qty',e.target.value)}/></td><td><input type="number" min="0" step="0.01" value={x.purchase_rate} onChange={e=>setItem(i,'purchase_rate',e.target.value)}/></td><td><input type="number" min="0" step="0.01" value={x.rate} onChange={e=>setItem(i,'rate',e.target.value)}/></td><td><input type="number" min="0" step="0.01" value={x.gst_rate} onChange={e=>setItem(i,'gst_rate',e.target.value)}/></td><td>{pkr(line.total)}</td><td><button type="button" className="icon danger" onClick={()=>removeItem(i)}>×</button></td></tr>})}</tbody></table></div></div>
      <div className="document-total-grid"><div><span>Sub Total</span><strong>{pkr(totals.subtotal)}</strong></div><div><span>GST</span><strong>{pkr(totals.gst)}</strong></div><div><span>Grand Total</span><strong>{pkr(totals.grand)}</strong></div><div><span>Gross Profit</span><strong>{pkr(totals.subtotal-totals.purchase)}</strong></div></div>
      <div className="form-grid"><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{cfg.statuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Probability (%)<input type="number" min="0" max="100" value={form.probability} onChange={e=>setForm({...form,probability:e.target.value})}/></label><label className="wide">Remarks<textarea rows="3" value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label></div>
      <div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary">Save {cfg.singular}</button></div></form></div>}
  </div>
}
