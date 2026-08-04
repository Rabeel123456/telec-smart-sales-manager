import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileSpreadsheet, Maximize, Plus, RefreshCw } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { pkr, useSales } from '../context/SalesContext'

export default function Dashboard() {
  const { profile, records, users, loading, load, calc } = useSales()
  const [person, setPerson] = useState('')
  const rows = useMemo(
    () => records.filter(r => !person || r.user_id === person).map(r => ({ ...r, ...calc(r) })),
    [records, person, calc]
  )

  const sum = key => rows.reduce((a, r) => a + Number(r[key] || 0), 0)
  const band = (min, max) => rows
    .filter(r => Number(r.probability) >= min && Number(r.probability) <= max)
    .reduce((a, r) => a + Number(r.sales_value_ex_gst || 0), 0)
  const statuses = ['Pending', 'Submitted', 'Won', 'Lost', 'On Hold']

  function exportPdf() {
    if (!rows.length) return alert('No records available to export.')
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(17)
    doc.text('TELEC Smart Sales Manager', 14, 14)
    doc.setFontSize(10)
    doc.text(`Total Pipeline: ${pkr(sum('sales_value_ex_gst'))}`, 14, 22)
    doc.text(`Total Gross Profit: ${pkr(sum('gp'))}`, 14, 28)
    autoTable(doc, {
      startY: 35,
      head: [['#', 'Salesperson', 'Customer', 'Date', 'Item', 'Sales', 'GP', 'Probability', 'Status']],
      body: rows.map((r, i) => [
        i + 1,
        r.profiles?.full_name || '',
        r.customer_name,
        r.quotation_date,
        r.item,
        Number(r.sales_value_ex_gst || 0).toLocaleString(),
        Number(r.gp || 0).toLocaleString(),
        `${r.probability}%`,
        r.quotation_status
      ]),
      styles: { fontSize: 7 }
    })
    doc.save('TELEC-Sales-Dashboard.pdf')
  }

  function exportExcel() {
    if (!rows.length) return alert('No records available to export.')
    const data = rows.map((r, i) => ({
      'S.No.': i + 1,
      Salesperson: r.profiles?.full_name || '',
      Customer: r.customer_name,
      Date: r.quotation_date,
      Item: r.item,
      'Purchase Value': r.purchase_value,
      'Sales Excl. GST': r.sales_value_ex_gst,
      GST: r.gst,
      'Including GST': r.incl,
      WHT: r.wht,
      'Net Total': r.net,
      GP: r.gp,
      Probability: r.probability,
      Status: r.quotation_status,
      Ageing: r.age
    }))
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Dashboard')
    XLSX.writeFile(workbook, 'TELEC-Sales-Dashboard.xlsx')
  }

  async function toggleFullScreen() {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
    else await document.exitFullscreen()
  }

  return <div>
    <div className="topbar">
      <div>
        <h1>Sales Dashboard</h1>
        <p>Live overview of sales pipeline</p>
      </div>
      <div className="actions">
        <button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button>
        <button className="secondary" onClick={exportPdf}><Download size={16}/> Export PDF</button>
        {profile.role === 'admin' && <button className="secondary" onClick={exportExcel}><FileSpreadsheet size={16}/> Export Excel</button>}
        <button className="secondary" onClick={toggleFullScreen}><Maximize size={16}/> Full Screen</button>
        <Link className="primary button-link" to="/opportunity"><Plus size={16}/> Add Opportunity</Link>
      </div>
    </div>

    {profile.role === 'admin' && <div className="scope">
      <label>View salesperson
        <select value={person} onChange={e => setPerson(e.target.value)}>
          <option value="">All Salespersons</option>
          {users.filter(u => u.role === 'sales' && u.active).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      </label>
    </div>}

    <div className="cards six">
      <div className="card"><span>Total Pipeline</span><strong>{pkr(sum('sales_value_ex_gst'))}</strong></div>
      <div className="card"><span>Total Gross Profit</span><strong>{pkr(sum('gp'))}</strong></div>
      <div className="card"><span>75% Probability</span><strong>{pkr(band(67, 100))}</strong></div>
      <div className="card"><span>50% Probability</span><strong>{pkr(band(34, 66))}</strong></div>
      <div className="card"><span>25% Probability</span><strong>{pkr(band(0, 33))}</strong></div>
      <div className="card"><span>Pending Quotations</span><strong>{rows.filter(r => ['Pending', 'Submitted'].includes(r.quotation_status)).length}</strong></div>
    </div>

    <div className="dashboard-grid">
      <section className="panel">
        <h2>Probability Summary</h2>
        {[[67, 100, '67–100%'], [34, 66, '34–66%'], [0, 33, '0–33%']].map(([min, max, label]) => {
          const value = band(min, max)
          const total = Math.max(sum('sales_value_ex_gst'), 1)
          return <div className="bar-row" key={label}>
            <strong>{label}</strong>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${value / total * 100}%` }}/></div>
            <span>{pkr(value)}</span>
          </div>
        })}
      </section>
      <section className="panel">
        <h2>Quotation Status</h2>
        {statuses.map(status => <div className="status-row" key={status}>
          <span>{status}</span><strong>{rows.filter(r => r.quotation_status === status).length}</strong>
        </div>)}
      </section>
    </div>

    <section className="panel">
      <div className="panel-head"><h2>Recent Opportunities</h2><Link to="/pipeline">View complete pipeline</Link></div>
      <div className="table-wrap"><table><thead><tr><th>Salesperson</th><th>Customer</th><th>Date</th><th>Item</th><th>Sales</th><th>GP</th><th>Probability</th><th>Status</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="8">Loading...</td></tr> : rows.slice(0, 8).map(r => <tr key={r.id}><td>{r.profiles?.full_name}</td><td>{r.customer_name}</td><td>{r.quotation_date}</td><td>{r.item}</td><td>{pkr(r.sales_value_ex_gst)}</td><td>{pkr(r.gp)}</td><td>{r.probability}%</td><td>{r.quotation_status}</td></tr>)}
      </tbody></table></div>
    </section>
  </div>
}
