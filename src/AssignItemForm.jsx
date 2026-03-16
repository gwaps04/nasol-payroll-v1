import { useState, useEffect } from 'react';

const AssignItemForm = ({ supabase, onBack }) => {
  const [employees, setEmployees] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: empData } = await supabase.from('employees').select('*').order('last_name', { ascending: true });
      const { data: itemData } = await supabase.from('items').select('*').order('item_name', { ascending: true });
      setEmployees(empData || []);
      setItems(itemData || []);
    };
    fetchData();
  }, [supabase]);

  // Automatic Computation Logic
  const selectedItemData = items.find(i => i.id === parseInt(selectedItem));
  const currentTotal = selectedItemData ? (selectedItemData.item_price * quantity).toFixed(2) : "0.00";

  const handleAssign = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMessage(null); // Clear any previous messages
    
    const empDetails = employees.find(emp => emp.id === parseInt(selectedEmployee));

    try {
      const { error } = await supabase
        .from('payroll_records')
        .insert([{ 
          employee_id: selectedEmployee,
          item_id: selectedItem,
          employee_name: `${empDetails.first_name} ${empDetails.last_name}`,
          item_name: selectedItemData.item_name,
          item_price: selectedItemData.item_price,
          quantity_finished: quantity,
          total_earned: parseFloat(currentTotal),
          payout_date: new Date().toISOString().split('T')[0]
        }]);

      if (error) throw error;

      // --- RESET FIELDS ON SUCCESS ---
      setFormMessage({ 
        type: 'success', 
        text: `✅ Saved! ${empDetails.first_name} earned ₱${currentTotal} for ${quantity} items.` 
      });
      
      setSelectedEmployee(''); // Reset Employee dropdown
      setSelectedItem('');     // Reset Item dropdown
      setQuantity(1);         // Reset Quantity to 1
      
    } catch (err) {
      setFormMessage({ type: 'danger', text: `❌ Error: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <button className="btn btn-light mb-4 shadow-sm fw-bold" onClick={onBack}>← Back</button>
          
          <div className="card shadow-lg border-0 rounded-4 p-5">
            <h2 className="fw-bold mb-4 text-info text-center">Log Work & Calculate Payout</h2>
            
            {/* SUCCESS / ERROR NOTIFICATION */}
            {formMessage && (
              <div className={`alert alert-${formMessage.type} alert-dismissible fade show mb-4 shadow-sm animate__animated animate__fadeInDown`}>
                <span className="fw-bold">{formMessage.text}</span>
                <button type="button" className="btn-close" onClick={() => setFormMessage(null)}></button>
              </div>
            )}

            <form onSubmit={handleAssign}>
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">Employee Name</label>
                <select 
                  className="form-select border-0 bg-light" 
                  value={selectedEmployee} 
                  onChange={(e) => setSelectedEmployee(e.target.value)} 
                  required
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.last_name}, {emp.first_name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">Item Finished</label>
                <select 
                  className="form-select border-0 bg-light" 
                  value={selectedItem} 
                  onChange={(e) => setSelectedItem(e.target.value)} 
                  required
                >
                  <option value="">-- Select Item --</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.item_name} (₱{item.item_price})</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-bold text-muted">Quantity Finished</label>
                <input 
                  type="number" 
                  className="form-control border-0 bg-light" 
                  min="1" 
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)} 
                  required 
                />
              </div>

              {/* Automatic Computation Display */}
              <div className="alert alert-secondary border-0 bg-light text-center mb-4">
                <p className="small text-muted mb-1">Estimated Earnings</p>
                <h3 className="fw-bold text-primary m-0">₱{currentTotal}</h3>
              </div>

              <button 
                type="submit" 
                className="btn btn-info text-white btn-lg w-100 fw-bold shadow-sm" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving Record...' : 'Save & Record Payout'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignItemForm;