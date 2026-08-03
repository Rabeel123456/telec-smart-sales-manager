import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const pkr=n=>`PKR ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`

export default function TeamReports(){
  const [rows,setRows]=useState([])
  const [settings,setSettings]=useState({gst_rate:18,wht_rate:5})

  useEffect(()=>{(async()=>{
    const [{data},{data:s}]=await Promise.all([
      supabase.from('sales_records').select('*,profiles!sales_records_user_id_fkey(full_name)'),
      supabase.from('app_settings').select('gst_rate,wht_rate').eq('id',1).single()
    ])
    setRows(data||[]); if(s)setSettings(s)
  })()},[])

  const groups={}
  rows.forEach(r=>{
    const name=r.profiles?.full_name||'Unknown'
    if(!groups[name])groups[name]={count:0,pipeline:0,gp:0,high:0,medium:0,low:0}
    const g=groups[name],sales=Number(r.sales_value_ex_gst||0),purchase=Number(r.purchase_value||0),p=Number(r.probability)
    g.count++;g.pipeline+=sales;g.gp+=sales-purchase
    if(p>=67)g.high+=sales;else if(p>=34)g.medium+=sales;else g.low+=sales
  })

  return <div>
    <div className="topbar"><div><h1>Team Reports</h1><p>Salesperson-wise management summary</p></div></div>
    <section className="panel"><div className="table-wrap"><table>
      <thead><tr><th>Salesperson</th><th>Opportunities</th><th>Total Pipeline</th><th>Gross Profit</th><th>High</th><th>Medium</th><th>Low</th></tr></thead>
      <tbody>{Object.entries(groups).map(([name,g])=><tr key={name}><td>{name}</td><td>{g.count}</td><td>{pkr(g.pipeline)}</td><td>{pkr(g.gp)}</td><td>{pkr(g.high)}</td><td>{pkr(g.medium)}</td><td>{pkr(g.low)}</td></tr>)}</tbody>
    </table></div></section>
  </div>
}