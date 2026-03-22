// Line 1 Fix: Added "React" to the import list
import React, { useState, useEffect } from 'react';
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
  
  // New State for Expandable Rows
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  // Modals States (Kept for Edit/Delete functionality)
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [deleteAuth, setDeleteAuth] = useState('');

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { applyFiltersAndGrouping(); }, [searchTerm, fromDate, toDate, allRecords]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
        .from('payroll_records')
        .select('*')
        .order('payout_date', { ascending: false });
    
    if (error) console.error(error);
    else setAllRecords(data || []);
    setLoading(false);
  };

  const applyFiltersAndGrouping = () => {
    let filtered = [...allRecords];
    
    if (searchTerm) {
        filtered = filtered.filter(r => r.employee_name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (fromDate) filtered = filtered.filter(r => r.payout_date >= fromDate);
    if (toDate) filtered = filtered.filter(r => r.payout_date <= toDate);

    const grouped = filtered.reduce((acc, record) => {
      const name = record.employee_name;
      if (!acc[name]) {
        acc[name] = { 
            name: name, 
            payoutDate: record.payout_date, 
            totalItems: 0, 
            totalSalary: 0, 
            itemsList: [], 
            prices: new Set() 
        };
      }
      acc[name].totalItems += record.quantity_finished;
      acc[name].totalSalary += parseFloat(record.total_earned);
      acc[name].itemsList.push(record);
      acc[name].prices.add(record.item_price);
      return acc;
    }, {});
    setFilteredSummary(Object.values(grouped));
  };

  const grandTotalSalary = filteredSummary.reduce((sum, emp) => sum + emp.totalSalary, 0);

  const toggleExpand = (empName) => {
    setExpandedEmployee(expandedEmployee === empName ? null : empName);
  };

  // --- UPDATED DETAILED PDF GENERATION ---
  const downloadMainPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); 
    doc.text('Nasol Haircraft - Detailed Shop Payroll Summary', 14, 20);
    doc.setFontSize(10);
    doc.text(`Period: ${fromDate || 'Start'} to ${toDate || 'Today'}`, 14, 28);

    const tableRows = [];

    filteredSummary.forEach(emp => {
      // 1. Add Employee Header Row
      tableRows.push([
        { 
          content: emp.name.toUpperCase(), 
          styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } 
        },
        { 
          content: `Total Payout: PHP ${emp.totalSalary.toLocaleString()}`, 
          colSpan: 4, 
          styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'right' } 
        }
      ]);

      // 2. Add Detailed Item Rows below each employee
      emp.itemsList.forEach(item => {
        tableRows.push([
          `   ${item.payout_date}`, // Indented for visual structure
          `   ${item.item_name}`, 
          `P${item.item_price}`, 
          item.quantity_finished, 
          `P${item.total_earned}`
        ]);
      });
      
      // Spacer row
      tableRows.push([{ content: '', colSpan: 5, styles: { cellPadding: 1 } }]);
    });
    
    // 3. Final Grand Total Row
    tableRows.push([
      { 
        content: 'GRAND TOTAL PAYOUT (ALL EMPLOYEES)', 
        colSpan: 4, 
        styles: { halign: 'right', fontStyle: 'bold', fillColor: [30, 58, 138], textColor: [255, 255, 255] } 
      },
      { 
        content: `PHP ${grandTotalSalary.toLocaleString()}`, 
        styles: { fontStyle: 'bold', fillColor: [30, 58, 138], textColor: [255, 255, 255] } 
      }
    ]);

    autoTable(doc, {
      head: [["Date / Employee", "Description", "Price", "Qty", "Subtotal"]],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138] },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' }
      }
    });
    
    doc.save(`Detailed_Payroll_Summary_${new Date().toLocaleDateString()}.pdf`);
  };

  const downloadIndividualPDF = (emp) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text(`Employee Payslip: ${emp.name}`, 14, 20);

    const totalAmount = emp.itemsList.reduce((sum, item) => sum + parseFloat(item.total_earned), 0);

    const rows = emp.itemsList.map(i => [
      i.payout_date, 
      i.item_name, 
      `P${i.item_price}`, 
      i.quantity_finished, 
      `P${i.total_earned}`
    ]);

    rows.push([
      { 
        content: 'TOTAL PAYOUT', 
        colSpan: 4, 
        styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } 
      },
      { 
        content: `PHP ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 
        styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } 
      }
    ]);

    autoTable(doc, {
      head: [["Payout Date", "Item", "Price", "Qty", "Subtotal"]],
      body: rows,
      startY: 35,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save(`Payslip_${emp.name}.pdf`);
  };

  const handleUpdate = async () => {
    const newTotal = (editingRecord.item_price * editingRecord.quantity_finished).toFixed(2);
    const { error } = await supabase.from('payroll_records').update({ 
        quantity_finished: editingRecord.quantity_finished, 
        total_earned: newTotal 
    }).eq('id', editingRecord.id);
    if (!error) { setEditingRecord(null); fetchData(); }
  };

  const handleDelete = async () => {
    if (deleteAuth !== 'DELETE') return;
    const { error } = await supabase.from('payroll_records').delete().eq('id', deletingRecord.id);
    if (!error) { setDeletingRecord(null); setDeleteAuth(''); fetchData(); }
  };

  return (
    <div className="container-fluid py-5" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', color: 'white' }}>
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <button className="btn btn-outline-light px-4 rounded-pill fw-bold" onClick={onBack}>← Dashboard</button>
          <h2 className="fw-bold m-0">Payroll Audit</h2>
          <button className="btn btn-success px-4 rounded-pill fw-bold shadow-sm" onClick={downloadMainPDF}>📥 Main Shop PDF</button>
        </div>

        {/* Filters */}
        <div className="card shadow-lg border-0 rounded-4 p-4 mb-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
          <div className="row g-3">
            <div className="col-md-4"><label className="form-label small fw-bold">Search Name</label><input type="text" className="form-control bg-dark text-white border-0 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <div className="col-md-3"><label className="form-label small fw-bold">From</label><input type="date" className="form-control bg-dark text-white border-0 shadow-sm" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
            <div className="col-md-3"><label className="form-label small fw-bold">To</label><input type="date" className="form-control bg-dark text-white border-0 shadow-sm" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
            <div className="col-md-2 d-flex align-items-end"><button className="btn btn-info w-100 fw-bold text-white shadow-sm" onClick={() => {setSearchTerm(''); setFromDate(''); setToDate('');}}>Clear</button></div>
          </div>
        </div>

        {/* Main Table */}
        <div className="card shadow-lg border-0 rounded-4 overflow-hidden mb-4">
          <table className="table align-middle mb-0 bg-white text-dark">
            <thead style={{ backgroundColor: '#0f172a', color: 'white' }}>
              <tr>
                <th className="ps-4 py-3">Employee</th>
                <th className="text-center">Payout Date</th> 
                <th className="text-center">Item Price(s)</th>
                <th className="text-center">Total Items</th>
                <th className="text-end">Salary</th>
                <th className="text-center pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummary.map((emp, idx) => (
                <React.Fragment key={idx}>
                  {/* MAIN SUMMARY ROW */}
                  <tr className={expandedEmployee === emp.name ? 'table-primary border-0' : ''} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(emp.name)}>
                    <td className="ps-4 fw-bold">{emp.name}</td>
                    <td className="text-center text-muted small">{emp.payoutDate}</td> 
                    <td className="text-center text-muted">₱{Array.from(emp.prices).join(', ₱')}</td>
                    <td className="text-center">{emp.totalItems}</td>
                    <td className="text-end fw-bold text-primary">₱{emp.totalSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-center pe-4">
                      <button 
                        className={`btn btn-sm rounded-pill px-3 shadow-sm fw-bold ${expandedEmployee === emp.name ? 'btn-dark' : 'btn-primary'}`}
                        onClick={(e) => { e.stopPropagation(); toggleExpand(emp.name); }}
                      >
                        {expandedEmployee === emp.name ? 'Hide Details' : 'See All'}
                      </button>
                    </td>
                  </tr>

                  {/* EXPANDED DETAILED ROW */}
                  {expandedEmployee === emp.name && (
                    <tr>
                      <td colSpan="6" className="p-0 bg-light">
                        <div className="p-4 border-start border-primary border-4 animate__animated animate__fadeIn">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="m-0 fw-bold text-dark text-uppercase">Detailed Records: {emp.name}</h6>
                            <button className="btn btn-sm btn-outline-primary fw-bold" onClick={() => downloadIndividualPDF(emp)}>🖨️ Print Payslip</button>
                          </div>
                          <div className="table-responsive rounded-3 shadow-sm">
                            <table className="table table-sm table-bordered mb-0 bg-white">
                              <thead className="table-dark">
                                <tr>
                                  <th className="small">Date</th>
                                  <th className="small">Item Description</th>
                                  <th className="small text-center">Unit Price</th>
                                  <th className="small text-center">Qty</th>
                                  <th className="small text-end">Subtotal</th>
                                  <th className="small text-center">Manage</th>
                                </tr>
                              </thead>
                              <tbody>
                                {emp.itemsList.map((item, i) => (
                                  <tr key={i}>
                                    <td className="small">{item.payout_date}</td>
                                    <td className="small">{item.item_name}</td>
                                    <td className="small text-center">₱{item.item_price}</td>
                                    <td className="small text-center fw-bold">{item.quantity_finished}</td>
                                    <td className="small text-end fw-bold text-primary">₱{item.total_earned}</td>
                                    <td className="small text-center">
                                      <button className="btn btn-link btn-sm text-warning p-0 me-2" onClick={() => setEditingRecord({...item})}>Edit</button>
                                      <button className="btn btn-link btn-sm text-danger p-0" onClick={() => setDeletingRecord(item)}>Delete</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
              <h2 className="fw-bold text-primary m-0">₱{grandTotalSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            </div>
          </div>
        )}

        {/* Action Modals */}
        {editingRecord && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
            <div className="card border-0 rounded-4 p-4 shadow-lg text-dark" style={{ width: '350px' }}>
              <h5 className="fw-bold text-primary mb-3 text-center">Modify Quantity</h5>
              <input type="number" className="form-control mb-3 fw-bold text-center fs-4 border-primary" value={editingRecord.quantity_finished} onChange={(e) => setEditingRecord({...editingRecord, quantity_finished: e.target.value})} />
              <div className="alert alert-info text-center py-2 fw-bold">New Total: ₱{(editingRecord.item_price * editingRecord.quantity_finished).toFixed(2)}</div>
              <div className="d-flex gap-2">
                <button className="btn btn-primary w-100 fw-bold" onClick={handleUpdate}>Save</button>
                <button className="btn btn-outline-secondary w-100" onClick={() => setEditingRecord(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {deletingRecord && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(220,53,69,0.9)', zIndex: 1060 }}>
            <div className="card border-0 rounded-4 p-4 shadow-lg text-dark text-center" style={{ width: '350px' }}>
              <h2 className="text-danger mb-3">⚠️</h2>
              <h5 className="fw-bold">Remove Record?</h5>
              <p className="small text-muted">Type <strong className="text-danger">DELETE</strong> to confirm.</p>
              <input type="text" className="form-control text-center mb-3" placeholder="Type DELETE" value={deleteAuth} onChange={(e) => setDeleteAuth(e.target.value)} />
              <div className="d-flex gap-2">
                <button className="btn btn-danger w-100 fw-bold" disabled={deleteAuth !== 'DELETE'} onClick={handleDelete}>Confirm Delete</button>
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