import { Link } from 'react-router-dom'
import { Download, FileSpreadsheet, Maximize, Plus, RefreshCw } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { pkr, useSales } from '../context/SalesContext'

export default function TeamReports() {
  const { records, loading, load, calc } = useSales()
  const groups = {}

  records.forEach(record => {
    const name = record.profiles?.full_name || 'Unknown'
    if (!groups[name]) groups[name] = { count: 0, pipeline: 0, gp: 0, p75: 0, p50: 0, p25: 0 }
    const group = groups[name]
    const sales = Number(record.sales_value_ex_gst || 0)
    const probability = Number(record.probability || 0)
    group.count += 1
    group.pipeline += sales
    group.gp += calc(record).gp
    // Exact desktop logic: 75%, 50% and 25% columns.
    if (probability === 75) group.p75 += sales
    if (probability === 50) group.p50 += sales
    if (probability === 25) group.p25 += sales
  })

  const rows = Object.entries(groups).map(([name, values]) => ({ name, ...values }))

  function exportPdf() {
    if (!rows.length) return alert('No team report data available.')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFontSize(17)
    doc.text('TELEC Smart Sales Manager', 14, 14)
    doc.setFontSize(13)
    doc.text('Salesperson-wise Summary', 14, 22)
    autoTable(doc, {
      startY: 28,
      head: [['Salesperson', 'Opportunities', 'Total Pipeline', 'GP', '75%', '50%', '25%']],
      body: rows.map(row => [row.name, row.count, pkr(row.pipeline), pkr(row.gp), pkr(row.p75), pkr(row.p50), pkr(row.p25)]),
      styles: { fontSize: 8 }
    })
    doc.save('TELEC-Team-Reports.pdf')
  }

  function exportExcel() {
    if (!rows.length) return alert('No team report data available.')
    const data = rows.map(row => ({
      Salesperson: row.name,
      Opportunities: row.count,
      'Total Pipeline': row.pipeline,
      GP: row.gp,
      '75%': row.p75,
      '50%': row.p50,
      '25%': row.p25
    }))
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Team Reports')
    XLSX.writeFile(workbook, 'TELEC-Team-Reports.xlsx')
  }

  async function toggleFullScreen() {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
    else await document.exitFullscreen()
  }

  return <div>
    <div className="topbar desktop-report-topbar">
      <div><h1>Team Reports</h1><p>Salesperson-wise management view</p></div>
      <div className="actions">
        <button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button>
        <button className="secondary" onClick={exportPdf}><Download size={16}/> Export PDF</button>
        <button className="secondary" onClick={exportExcel}><FileSpreadsheet size={16}/> Export Excel</button>
        <button className="secondary" onClick={toggleFullScreen}><Maximize size={16}/> Full Screen</button>
        <Link className="primary button-link" to="/opportunity"><Plus size={16}/> Add Opportunity</Link>
      </div>
    </div>

    <section className="panel team-report-panel">
      <h2>Salesperson-wise Summary</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Salesperson</th><th>Opportunities</th><th>Total Pipeline</th><th>GP</th><th>75%</th><th>50%</th><th>25%</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan="7">Loading...</td></tr> : rows.length
            ? rows.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.count}</td><td>{pkr(row.pipeline)}</td><td>{pkr(row.gp)}</td><td>{pkr(row.p75)}</td><td>{pkr(row.p50)}</td><td>{pkr(row.p25)}</td></tr>)
            : <tr><td colSpan="7" className="empty">No sales records available.</td></tr>}
        </tbody>
      </table></div>
    </section>
  </div>
}
