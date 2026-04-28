import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MonthlyPayoutPage = ({ supabase, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [summaryData, setSummaryData] = useState([]); 
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchAndSummarizeData();
  }, [selectedMonth]);

  const fetchAndSummarizeData = async () => {
    setLoading(true);
    const startOfMonth = `${selectedMonth}-01`;
    const lastDay = new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0).getDate();
    const endOfMonth = `${selectedMonth}-${lastDay}`;

    const { data, error } = await supabase
      .from('payroll_records')
      .select('employee_name, payout_date, total_earned')
      .gte('payout_date', startOfMonth)
      .lte('payout_date', endOfMonth)
      .range(0, 5000);

    if (error) {
      console.error('Error fetching records:', error);
      setLoading(false);
      return;
    }

    const grouped = data.reduce((acc, curr) => {
      const name = curr.employee_name;
      const amount = parseFloat(curr.total_earned || 0);
      const date = curr.payout_date;

      if (!acc[name]) {
        acc[name] = {
          name: name,
          total: 0,
          firstDate: date,
          lastDate: date,
        };
      }

      acc[name].total += amount;
      if (date < acc[name].firstDate) acc[name].firstDate = date;
      if (date > acc[name].lastDate) acc[name].lastDate = date;

      return acc;
    }, {});

    const formatAndSort = (dataObj) => {
      return Object.values(dataObj).map(emp => {
        const parts = emp.name.trim().split(/\s+/);
        let formattedName = emp.name;
        
        if (parts.length > 1) {
          const lastName = parts.pop();
          const firstNames = parts.join(' ');
          formattedName = `${lastName} ${firstNames}`;
        }
        
        return { ...emp, displayName: formattedName };
      }).sort((a, b) => a.displayName.localeCompare(b.displayName));
    };

    const summarizedArray = formatAndSort(grouped);
    const grandTotal = summarizedArray.reduce((sum, emp) => sum + emp.total, 0);

    setSummaryData(summarizedArray);
    setMonthlyTotal(grandTotal);
    setLoading(false);
  };

  const downloadPDF = () => {
    setPdfLoading(true);
    const doc = new jsPDF();
    const monthLabel = new Date(selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text('Nasol Haircraft - Monthly Payroll Summary', 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Period: ${monthLabel}`, 14, 28);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 34);

    const tableRows = summaryData.map(emp => [
      emp.displayName.toUpperCase(),
      `${emp.firstDate} to ${emp.lastDate}`,
      `PHP ${emp.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Employee Name (Last, First)', 'Payout Date Range', 'Total Earnings']],
      body: tableRows,
      foot: [[
        'GRAND TOTAL', 
        '', 
        `PHP ${monthlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      ]],
      showFoot: 'lastPage', // FIX: Only shows the Grand Total footer on the very last page
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138], fontSize: 10 },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 11 },
      columnStyles: {
        2: { halign: 'right' }
      }
    });

    doc.save(`Payroll_Summary_${selectedMonth}.pdf`);
    setPdfLoading(false);
  };

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <button className="btn btn-light rounded-pill px-4 shadow-sm" onClick={onBack}>← Back</button>
        <h2 className="text-white fw-bold m-0">Monthly Payroll Summary</h2>
        <button 
          className="btn btn-warning rounded-pill px-4 fw-bold shadow-sm" 
          onClick={downloadPDF}
          disabled={pdfLoading || loading}
        >
          {pdfLoading ? <span className="spinner-border spinner-border-sm me-2"></span> : '💾 '}
          Download Summary PDF
        </button>
      </div>

      <div className="card shadow-lg border-0 rounded-4 overflow-hidden">
        <div className="card-header bg-white p-4">
          <div className="row align-items-center">
            <div className="col-md-4">
              <label className="form-label small fw-bold text-muted">Select Month</label>
              <input 
                type="month" className="form-control border-0 bg-light" value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
            <div className="col-md-8 text-end">
                <div className="d-inline-block text-start p-3 bg-light rounded-4 border">
                    <div className="small text-muted fw-bold text-uppercase" style={{fontSize: '0.7rem'}}>Grand Total (All Employees)</div>
                    <div className="h4 m-0 fw-bold text-primary">₱{monthlyTotal.toLocaleString()}</div>
                </div>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          <div className="table-responsive" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light sticky-top">
                <tr>
                  <th className="ps-4 py-3">Employee Name</th>
                  <th className="py-3">Payout Date Range</th>
                  <th className="text-end pe-4 py-3">Total Earnings</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="3" className="text-center py-5">Processing Summary...</td></tr>
                ) : summaryData.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-5 text-muted">No records found for this month.</td></tr>
                ) : (
                  summaryData.map((emp) => (
                    <tr key={emp.name}>
                      <td className="ps-4 fw-bold">{emp.displayName}</td>
                      <td className="text-muted">{emp.firstDate} <span className="mx-1">→</span> {emp.lastDate}</td>
                      <td className="text-end pe-4 fw-bold text-success">
                        ₱{emp.total.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && summaryData.length > 0 && (
                <tfoot className="table-light border-top">
                    <tr>
                        <td colSpan="2" className="ps-4 py-3 fw-bold">TOTAL MONTHLY PAYOUT</td>
                        <td className="text-end pe-4 py-3 h5 m-0 fw-bold text-primary">₱{monthlyTotal.toLocaleString()}</td>
                    </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyPayoutPage;