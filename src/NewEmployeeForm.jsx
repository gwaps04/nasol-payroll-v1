import { useState, useEffect } from 'react';

const NewEmployeeForm = ({ supabase, onBack }) => {
  const [employees, setEmployees] = useState([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [editingId, setEditingId] = useState(null); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState(null);

  // Safety Delete State (Now used for Archiving)
  const [deletingId, setDeletingId] = useState(null);
  const [deleteAuth, setDeleteAuth] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    // Only fetch employees where status is 'active'
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'active') 
      .order('last_name', { ascending: true });
    setEmployees(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMessage(null);

    try {
      if (editingId) {
        // --- UPDATE ACTION ---
        const { error } = await supabase
          .from('employees')
          .update({ first_name: firstName, last_name: lastName })
          .eq('id', editingId);
        
        if (error) throw error;
        setFormMessage({ type: 'success', text: `Successfully updated ${firstName} ${lastName}!` });
      } else {
        // --- INSERT ACTION ---
        const { error } = await supabase
          .from('employees')
          .insert([{ first_name: firstName, last_name: lastName, status: 'active' }]);
        
        if (error) throw error;
        setFormMessage({ type: 'success', text: `Successfully registered ${firstName} ${lastName}!` });
      }

      // RESET FORM & REFRESH DATA
      setFirstName('');
      setLastName('');
      setEditingId(null);
      fetchEmployees(); 

    } catch (err) {
      setFormMessage({ type: 'danger', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInit = (emp) => {
    setFirstName(emp.first_name);
    setLastName(emp.last_name);
    setEditingId(emp.id);
    setFormMessage(null);
    window.scrollTo(0, 0); 
  };

  const handleDelete = async () => {
    if (deleteAuth !== 'DELETE') return;
    
    try {
      // SOFT DELETE: Update status to 'inactive' to preserve payroll history
      const { error } = await supabase
        .from('employees')
        .update({ status: 'inactive' })
        .eq('id', deletingId);
      
      if (error) throw error;

      // --- REFRESH & NOTIFY ---
      setFormMessage({ type: 'success', text: 'Employee moved to archives. History is preserved.' });
      setDeletingId(null);
      setDeleteAuth('');
      fetchEmployees(); 
      
    } catch (err) {
      setFormMessage({ type: 'danger', text: `Archive Error: ${err.message}` });
    }
  };

  return (
    <div className="container py-5 text-white">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <button className="btn btn-outline-light mb-4 rounded-pill px-4 fw-bold shadow-sm" onClick={onBack}>← Dashboard</button>
          
          {/* --- FORM SECTION --- */}
          <div className="card shadow border-0 rounded-4 p-4 mb-5 text-dark">
            <h2 className="fw-bold mb-4 text-primary text-center">
              {editingId ? 'Edit Employee Info' : 'Register New Employee'}
            </h2>
            
            {formMessage && (
              <div className={`alert alert-${formMessage.type} alert-dismissible fade show shadow-sm fw-bold animate__animated animate__fadeIn`} role="alert">
                {formMessage.type === 'success' ? '✅ ' : '❌ '} {formMessage.text}
                <button type="button" className="btn-close" onClick={() => setFormMessage(null)}></button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold">First Name</label>
                  <input type="text" className="form-control" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">Last Name</label>
                  <input type="text" className="form-control" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>
              <div className="mt-4 d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-lg w-100 fw-bold shadow-sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : (editingId ? 'Save Changes' : 'Register Employee')}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-light btn-lg border w-50" onClick={() => {setEditingId(null); setFirstName(''); setLastName('');}}>Cancel</button>
                )}
              </div>
            </form>
          </div>

          {/* --- LIST SECTION --- */}
          <div className="card shadow border-0 rounded-4 overflow-hidden text-dark">
            <div className="card-header bg-dark text-white py-3">
              <h5 className="m-0 fw-bold text-center">Active Employee Registry</h5>
            </div>
            <div className="table-responsive" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="ps-4">Full Name</th>
                    <th className="text-center">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length > 0 ? employees.map(emp => (
                    <tr key={emp.id}>
                      <td className="ps-4 fw-bold">{emp.last_name}, {emp.first_name}</td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-warning me-2 fw-bold px-3 shadow-sm" onClick={() => handleEditInit(emp)}>EDIT</button>
                        <button className="btn btn-sm btn-danger fw-bold px-3 shadow-sm" onClick={() => setDeletingId(emp.id)}>DELETE</button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="2" className="text-center py-4 text-muted">No active employees found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* --- ARCHIVE (SOFT DELETE) SAFETY CONFIRMATION --- */}
      {deletingId && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1060 }}>
          <div className="card border-0 rounded-4 p-4 shadow-lg text-dark text-center" style={{ width: '400px' }}>
            <div className="display-1 text-danger mb-3">⚠️</div>
            <h4 className="fw-bold">Archive Employee?</h4>
            <p className="text-muted small">
              This person will be removed from the active list, but their 
              <span className="fw-bold text-dark"> payroll history will be saved</span>. 
              Type <span className="text-danger fw-bold">DELETE</span> to confirm:
            </p>
            <input 
              type="text" 
              className="form-control text-center mb-3 fw-bold border-danger" 
              placeholder="Type DELETE" 
              value={deleteAuth} 
              onChange={(e) => setDeleteAuth(e.target.value)} 
            />
            <div className="d-flex gap-2">
              <button 
                className="btn btn-danger w-100 fw-bold shadow-sm" 
                disabled={deleteAuth !== 'DELETE'} 
                onClick={handleDelete}
              >
                Archive Record
              </button>
              <button className="btn btn-light border w-100" onClick={() => {setDeletingId(null); setDeleteAuth('');}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewEmployeeForm;