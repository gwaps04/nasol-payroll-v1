import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const WeeklySummary = ({ supabase, onBack }) => {
  const [allRecords, setAllRecords] = useState([]);
  const [filteredSummary, setFilteredSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Modal Internal Filter States
  const [modalFromDate, setModalFromDate] = useState('');
  const [modalToDate, setModalToDate] = useState('');

  // Modals States
  const [selectedEmpRecords, setSelectedEmpRecords] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [deleteAuth, setDeleteAuth] = useState('');

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { applyFiltersAndGrouping(); }, [searchTerm, fromDate, toDate, allRecords]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('payroll_records').select('*').order('payout_date', { ascending: false });
    if (error) console.error(error);
    else setAllRecords(data || []);
    setLoading(false);
  };

  const applyFiltersAndGrouping = () => {
    let filtered = [...allRecords];
    if (searchTerm) filtered = filtered.filter(r => r.employee_name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (fromDate) filtered = filtered.filter(r => r.payout_date >= fromDate);
    if (toDate) filtered = filtered.filter(r => r.payout_date <= toDate);

    const grouped = filtered.reduce((acc, record) => {
      const name = record.employee_name;
      if (!acc[name]) {
        acc[name] = { name: name, totalItems: 0, totalSalary: 0, itemsList: [], prices: new Set() };
      }
      acc[name].totalItems += record.quantity_finished;
      acc[name].totalSalary += parseFloat(record.total_earned);
      acc[name].itemsList.push(record);
      acc[name].prices.add(record.item_price); // Track unique prices
      return acc;
    }, {});
    setFilteredSummary(Object.values(grouped));
  };

  const grandTotalSalary = filteredSummary.reduce((sum, emp) => sum + emp.totalSalary, 0);

  // --- PDF: Main Shop Report (Updated with Price Column) ---
  const downloadMainPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); 
    doc.text('Nasol Haircraft - Shop Payroll Summary', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${fromDate || 'Start'} to ${toDate || 'Today'}`, 14, 28);

    const tableRows = filteredSummary.map(emp => [
      emp.name, 
      `P${Array.from(emp.prices).join(', P')}`, // Show prices worked
      emp.totalItems, 
      `PHP ${emp.totalSalary.toLocaleString()}`
    ]);
    
    tableRows.push([{ content: 'GRAND TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, `PHP ${grandTotalSalary.toLocaleString()}`]);

    autoTable(doc, {
      head: [["Employee Name", "Item Price(s)", "Total Items", "Total Payout"]],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138] }
    });
    doc.save(`Shop_Payroll_${new Date().toLocaleDateString()}.pdf`);
  };

  const downloadIndividualPDF = (emp) => {
    const doc = new jsPDF();
    const itemsToPrint = emp.itemsList.filter(item => {
      const isAfter = modalFromDate ? item.payout_date >= modalFromDate : true;
      const isBefore = modalToDate ? item.payout_date <= modalToDate : true;
      return isAfter && isBefore;
    });

    const individualTotal = itemsToPrint.reduce((sum, item) => sum + parseFloat(item.total_earned), 0);

    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text(`Employee Payslip: ${emp.name}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Date Range: ${modalFromDate || 'All'} to ${modalToDate || 'All'}`, 14, 28);

    const rows = itemsToPrint.map(i => [i.payout_date, i.item_name, `P${i.item_price}`, i.quantity_finished, `P${i.total_earned}`]);
    rows.push([{ content: 'TOTAL PAYOUT', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, `PHP ${individualTotal.toLocaleString()}`]);

    autoTable(doc, {
      head: [["Date", "Item", "Price", "Qty", "Subtotal"]],
      body: rows,
      startY: 35,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save(`Payslip_${emp.name}_${new Date().toLocaleDateString()}.pdf`);
  };

  const handleUpdate = async () => {
    const newTotal = (editingRecord.item_price * editingRecord.quantity_finished).toFixed(2);
    const { error } = await supabase.from('payroll_records').update({ 
        quantity_finished: editingRecord.quantity_finished, 
        total_earned: newTotal 
    }).eq('id', editingRecord.id);
    if (!error) { setEditingRecord(null); setSelectedEmpRecords(null); fetchData(); }
  };

  const handleDelete = async () => {
    if (deleteAuth !== 'DELETE') return;
    const { error } = await supabase.from('payroll_records').delete().eq('id', deletingRecord.id);
    if (!error) { setDeletingRecord(null); setDeleteAuth(''); setSelectedEmpRecords(null); fetchData(); }
  };

  return (
    <div className="container-fluid py-5" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', color: 'white' }}>
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <button className="btn btn-outline-light px-4 rounded-pill fw-bold" onClick={onBack}>← Dashboard</button>
          <h2 className="fw-bold m-0">Payroll Audit</h2>
          <button className="btn btn-success px-4 rounded-pill fw-bold" onClick={downloadMainPDF}>📥 Main Shop PDF</button>
        </div>

        {/* Filters */}
        <div className="card shadow-lg border-0 rounded-4 p-4 mb-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
          <div className="row g-3">
            <div className="col-md-4"><label className="form-label small fw-bold">Search</label><input type="text" className="form-control bg-dark text-white border-0" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <div className="col-md-3"><label className="form-label small fw-bold">From</label><input type="date" className="form-control bg-dark text-white border-0" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
            <div className="col-md-3"><label className="form-label small fw-bold">To</label><input type="date" className="form-control bg-dark text-white border-0" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
            <div className="col-md-2 d-flex align-items-end"><button className="btn btn-info w-100 fw-bold text-white" onClick={() => {setSearchTerm(''); setFromDate(''); setToDate('');}}>Clear</button></div>
          </div>
        </div>

        {/* Main Table (With Item Price column) */}
        <div className="card shadow-lg border-0 rounded-4 overflow-hidden mb-4">
          <table className="table table-hover align-middle mb-0 bg-white text-dark">
            <thead style={{ backgroundColor: '#0f172a', color: 'white' }}>
              <tr>
                <th className="ps-4 py-3">Employee</th>
                <th className="text-center">Item Price(s)</th> {/* NEW COLUMN */}
                <th className="text-center">Total Items</th>
                <th className="text-end">Salary</th>
                <th className="text-center pe-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummary.map((emp, idx) => (
                <tr key={idx}>
                  <td className="ps-4 fw-bold">{emp.name}</td>
                  <td className="text-center text-muted">
                    {/* Shows a single price or a list if they did different tasks */}
                    ₱{Array.from(emp.prices).join(', ₱')}
                  </td>
                  <td className="text-center">{emp.totalItems}</td>
                  <td className="text-end fw-bold text-primary">₱{emp.totalSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-center pe-4">
                    <button className="btn btn-sm btn-primary rounded-pill px-3" onClick={() => {setSelectedEmpRecords(emp); setModalFromDate(''); setModalToDate('');}}>View Records</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grand Total Footer */}
        {!loading && filteredSummary.length > 0 && (
          <div className="d-flex justify-content-end mb-5">
            <div className="card shadow-lg border-0 rounded-4 p-4 text-dark" style={{ minWidth: '320px', background: '#f8fafc' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="small fw-bold text-muted text-uppercase">Total Shop Payout</span>
                <span className="badge bg-primary rounded-pill">{filteredSummary.length} Workers</span>
              </div>
              <h2 className="fw-bold text-primary m-0">
                ₱{grandTotalSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>
            </div>
          </div>
        )}

        {/* Modal: Detailed View */}
        {selectedEmpRecords && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1040 }}>
            <div className="card w-75 shadow-lg border-0 rounded-4 overflow-hidden text-dark bg-light">
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center p-3">
                <h5 className="m-0 fw-bold">Records: {selectedEmpRecords.name}</h5>
                <div className="d-flex gap-2">
                  <button className="btn btn-light btn-sm fw-bold text-primary px-3 shadow-sm" onClick={() => downloadIndividualPDF(selectedEmpRecords)}>🖨️ Print Payslip</button>
                  <button className="btn-close btn-close-white" onClick={() => setSelectedEmpRecords(null)}></button>
                </div>
              </div>
              <div className="p-3 bg-secondary bg-opacity-10 border-bottom d-flex align-items-center gap-3">
                <span className="small fw-bold">Filter Range:</span>
                <input type="date" className="form-control form-control-sm w-auto" value={modalFromDate} onChange={(e) => setModalFromDate(e.target.value)} />
                <input type="date" className="form-control form-control-sm w-auto" value={modalToDate} onChange={(e) => setModalToDate(e.target.value)} />
              </div>
              <div className="card-body p-0" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                <table className="table table-striped mb-0">
                  <thead className="table-secondary">
                    <tr><th>Date</th><th>Item</th><th>Price</th><th>Qty</th><th>Total</th><th className="text-center">Actions</th></tr>
                  </thead>
                  <tbody>
                    {selectedEmpRecords.itemsList
                      .filter(item => {
                        const isAfter = modalFromDate ? item.payout_date >= modalFromDate : true;
                        const isBefore = modalToDate ? item.payout_date <= modalToDate : true;
                        return isAfter && isBefore;
                      })
                      .map((item, i) => (
                        <tr key={i}>
                          <td>{item.payout_date}</td>
                          <td>{item.item_name}</td>
                          <td>₱{item.item_price}</td>
                          <td className="fw-bold">{item.quantity_finished}</td>
                          <td className="text-primary fw-bold">₱{item.total_earned}</td>
                          <td className="text-center">
                            <button className="btn btn-warning btn-sm me-2 fw-bold shadow-sm" onClick={() => setEditingRecord({...item})}>EDIT</button>
                            <button className="btn btn-danger btn-sm fw-bold shadow-sm" onClick={() => setDeletingRecord(item)}>DELETE</button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Edit Mini-Modal */}
        {editingRecord && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
            <div className="card border-0 rounded-4 p-4 shadow-lg text-dark" style={{ width: '350px' }}>
              <h5 className="fw-bold text-primary mb-3">Modify Quantity</h5>
              <input type="number" className="form-control mb-3 fw-bold text-center fs-4" value={editingRecord.quantity_finished} onChange={(e) => setEditingRecord({...editingRecord, quantity_finished: e.target.value})} />
              <div className="alert alert-info text-center py-2 fw-bold">Total: ₱{(editingRecord.item_price * editingRecord.quantity_finished).toFixed(2)}</div>
              <div className="d-flex gap-2">
                <button className="btn btn-primary w-100 fw-bold" onClick={handleUpdate}>Save Changes</button>
                <button className="btn btn-outline-secondary w-100" onClick={() => setEditingRecord(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deletingRecord && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(220,53,69,0.9)', zIndex: 1060 }}>
            <div className="card border-0 rounded-4 p-4 shadow-lg text-dark text-center" style={{ width: '350px' }}>
              <h2 className="text-danger mb-3">⚠️</h2>
              <h5 className="fw-bold">Remove Record?</h5>
              <p className="small text-muted">Type <strong className="text-danger">DELETE</strong> to confirm.</p>
              <input type="text" className="form-control text-center mb-3" placeholder="Type DELETE" value={deleteAuth} onChange={(e) => setDeleteAuth(e.target.value)} />
              <div className="d-flex gap-2">
                <button className="btn btn-danger w-100 fw-bold" disabled={deleteAuth !== 'DELETE'} onClick={handleDelete}>Delete Permanently</button>
                <button className="btn btn-light border w-100" onClick={() => {setDeletingRecord(null); setDeleteAuth('');}}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default WeeklySummary;