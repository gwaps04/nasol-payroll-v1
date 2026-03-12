import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const WeeklySummary = ({ supabase, onBack }) => {
  const [allRecords, setAllRecords] = useState([]);
  const [filteredSummary, setFilteredSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
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
        acc[name] = { name: name, totalItems: 0, totalSalary: 0, itemsList: [] };
      }
      acc[name].totalItems += record.quantity_finished;
      acc[name].totalSalary += parseFloat(record.total_earned);
      acc[name].itemsList.push(record);
      return acc;
    }, {});
    setFilteredSummary(Object.values(grouped));
  };

  // --- NEW: DYNAMIC GRAND TOTAL CALCULATION ---
  const grandTotalSalary = filteredSummary.reduce((sum, emp) => sum + emp.totalSalary, 0);

  // --- UPDATED: PDF GENERATION (Includes Grand Total) ---
  const downloadPDF = () => {
    const doc = new jsPDF();
    const dateRange = (fromDate && toDate) ? `${fromDate} to ${toDate}` : "All Time Records";

    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); 
    doc.text('Nasol Haircraft - Payroll Summary', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${dateRange}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 33);

    const tableColumn = ["Employee Name", "Total Items", "Total Payout (PHP)"];
    const tableRows = filteredSummary.map(emp => [
      emp.name,
      emp.totalItems,
      `PHP ${emp.totalSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    ]);

    // Add a Footer row for the Grand Total in the PDF
    tableRows.push([
      { content: 'GRAND TOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: `PHP ${grandTotalSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } }
    });

    doc.save(`Payroll_${new Date().toISOString().split('T')[0]}.pdf`);
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
    <div className="container-fluid py-5" style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', 
      color: 'white' 
    }}>
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <button className="btn btn-outline-light px-4 rounded-pill fw-bold" onClick={onBack}>← Back</button>
          <h2 className="fw-bold m-0 text-white">Payroll Audit & History</h2>
          <button className="btn btn-success px-4 rounded-pill fw-bold shadow-sm" onClick={downloadPDF}>
            📥 Download PDF
          </button>
        </div>

        {/* Filter Card */}
        <div className="card shadow-lg border-0 rounded-4 p-4 mb-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
          <div className="row g-3 text-white">
            <div className="col-md-4">
              <label className="form-label small fw-bold">Search Employee</label>
              <input type="text" className="form-control bg-dark text-white border-0" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Type name..." />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-bold">From</label>
              <input type="date" className="form-control bg-dark text-white border-0" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-bold">To</label>
              <input type="date" className="form-control bg-dark text-white border-0" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-info w-100 fw-bold text-white" onClick={() => {setSearchTerm(''); setFromDate(''); setToDate('');}}>Clear</button>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="card shadow-lg border-0 rounded-4 overflow-hidden mb-4">
          <table className="table table-hover align-middle mb-0">
            <thead style={{ backgroundColor: '#0f172a', color: 'white' }}>
              <tr>
                <th className="ps-4 py-3">Employee Name</th>
                <th className="text-center">Total Items</th>
                <th className="text-end">Total Salary</th>
                <th className="text-center pe-4">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white text-dark">
              {loading ? (
                <tr><td colSpan="4" className="text-center py-5">Loading...</td></tr>
              ) : filteredSummary.length > 0 ? (
                filteredSummary.map((emp, idx) => (
                  <tr key={idx}>
                    <td className="ps-4 fw-bold">{emp.name}</td>
                    <td className="text-center"><span className="badge bg-primary rounded-pill px-3">{emp.totalItems}</span></td>
                    <td className="text-end fw-bold text-primary">₱{emp.totalSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-center pe-4">
                      <button className="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onClick={() => setSelectedEmpRecords(emp)}>View Records</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4" className="text-center py-5 text-muted">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* --- NEW: VISUAL GRAND TOTAL INDICATOR --- */}
        {!loading && filteredSummary.length > 0 && (
          <div className="d-flex justify-content-end mb-5">
            <div className="card shadow-lg border-0 rounded-4 p-4 text-dark" style={{ minWidth: '320px', background: '#f8fafc' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="small fw-bold text-muted uppercase">Shop Total Payout</span>
                <span className="badge bg-primary rounded-pill">{filteredSummary.length} Workers</span>
              </div>
              <h2 className="fw-bold text-primary m-0">
                ₱{grandTotalSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>
              <hr className="my-2" />
              <p className="small text-muted m-0 italic">Total based on current filters and search results.</p>
            </div>
          </div>
        )}

        {/* Modal: View Details */}
        {selectedEmpRecords && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1040 }}>
            <div className="card w-75 shadow-lg border-0 rounded-4 overflow-hidden text-dark bg-light">
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center p-3">
                <h5 className="m-0 fw-bold">Log: {selectedEmpRecords.name}</h5>
                <button className="btn-close btn-close-white" onClick={() => setSelectedEmpRecords(null)}></button>
              </div>
              <div className="card-body p-0" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-secondary">
                    <tr>
                      <th className="ps-3">Date</th>
                      <th>Item</th>
                      <th>Price</th>
                      <th>Qty</th>
                      <th>Total</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmpRecords.itemsList.map((item, i) => (
                      <tr key={i}>
                        <td className="ps-3">{item.payout_date}</td>
                        <td className="small">{item.item_name}</td>
                        <td className="text-muted">₱{item.item_price}</td>
                        <td className="fw-bold">{item.quantity_finished}</td>
                        <td className="text-primary fw-bold">₱{item.total_earned}</td>
                        <td className="text-center">
                          <button className="btn btn-warning btn-sm fw-bold me-2 px-3 shadow-sm" onClick={() => setEditingRecord({...item})}>EDIT</button>
                          <button className="btn btn-danger btn-sm fw-bold px-3 shadow-sm" onClick={() => setDeletingRecord(item)}>DELETE</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingRecord && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
            <div className="card border-0 rounded-4 p-4 shadow-lg text-dark" style={{ width: '350px' }}>
              <h5 className="fw-bold text-primary mb-3">Modify Quantity</h5>
              <input type="number" className="form-control mb-3 fw-bold" value={editingRecord.quantity_finished} onChange={(e) => setEditingRecord({...editingRecord, quantity_finished: e.target.value})} />
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