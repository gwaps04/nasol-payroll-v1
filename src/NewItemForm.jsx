import { useState, useEffect } from 'react';

const NewItemForm = ({ supabase, onBack }) => {
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState(null);

  // Safety Delete State
  const [deletingId, setDeletingId] = useState(null);
  const [deleteAuth, setDeleteAuth] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    // UPDATED: Only fetch items that are 'active'
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('status', 'active') 
      .order('item_name', { ascending: true });
    setItems(data || []);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMessage(null);

    try {
      if (editingId) {
        // UPDATE ACTION
        const { error } = await supabase
          .from('items')
          .update({ item_name: itemName, item_price: parseFloat(itemPrice) })
          .eq('id', editingId);
        if (error) throw error;
        setFormMessage({ type: 'success', text: `Updated ${itemName} successfully!` });
      } else {
        // INSERT ACTION
        const { error } = await supabase
          .from('items')
          .insert([{ item_name: itemName, item_price: parseFloat(itemPrice), status: 'active' }]);
        if (error) throw error;
        setFormMessage({ type: 'success', text: `Added ${itemName} to inventory!` });
      }

      // RESET AND REFRESH
      setItemName('');
      setItemPrice('');
      setEditingId(null);
      fetchItems();
    } catch (err) {
      setFormMessage({ type: 'danger', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInit = (item) => {
    setItemName(item.item_name);
    setItemPrice(item.item_price);
    setEditingId(item.id);
    window.scrollTo(0, 0); // Focus back on the form
  };

  const handleDelete = async () => {
    if (deleteAuth !== 'DELETE') return;
    try {
      // UPDATED: Performs a Soft Delete by updating status to 'inactive'
      const { error } = await supabase
        .from('items')
        .update({ status: 'inactive' }) 
        .eq('id', deletingId);
        
      if (error) throw error;
      setFormMessage({ type: 'success', text: 'Item moved to archives. Historical records preserved.' });
      setDeletingId(null);
      setDeleteAuth('');
      fetchItems();
    } catch (err) {
      setFormMessage({ type: 'danger', text: err.message });
    }
  };

  // Filter items based on search term
  const filteredItems = items.filter(i => 
    i.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container py-5 text-white">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <button className="btn btn-outline-light mb-4 rounded-pill px-4" onClick={onBack}>← Back</button>

          {/* --- FORM SECTION --- */}
          <div className="card shadow border-0 rounded-4 p-4 mb-5 text-dark">
            <h2 className="fw-bold mb-4 text-success text-center">
              {editingId ? 'Edit Item Details' : 'Add New Item'}
            </h2>
            
            {formMessage && (
              <div className={`alert alert-${formMessage.type} alert-dismissible fade show shadow-sm fw-bold mb-4`}>
                {formMessage.type === 'success' ? '✅' : '❌'} {formMessage.text}
                <button type="button" className="btn-close" onClick={() => setFormMessage(null)}></button>
              </div>
            )}

            <form onSubmit={handleSaveItem}>
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label small fw-bold text-muted">Item Name</label>
                  <input type="text" className="form-control" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold text-muted">Price (₱)</label>
                  <input type="number" step="0.01" className="form-control" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} required />
                </div>
              </div>
              <div className="mt-4 d-flex gap-2">
                <button type="submit" className="btn btn-success btn-lg w-100 fw-bold shadow-sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : (editingId ? 'Save Changes' : 'Add Item')}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-light btn-lg border" onClick={() => {setEditingId(null); setItemName(''); setItemPrice('');}}>Cancel</button>
                )}
              </div>
            </form>
          </div>

          {/* --- SEARCH & LIST SECTION --- */}
          <div className="card shadow border-0 rounded-4 overflow-hidden text-dark">
            <div className="card-header bg-success text-white py-3 d-flex justify-content-between align-items-center">
              <h5 className="m-0 fw-bold">Active Inventory</h5>
              <input 
                type="text" 
                className="form-control form-control-sm w-50" 
                placeholder="Search active items..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="table-responsive" style={{ maxHeight: '400px' }}>
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="ps-4">Item Description</th>
                    <th className="text-center">Base Price</th>
                    <th className="text-center">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length > 0 ? filteredItems.map(item => (
                    <tr key={item.id}>
                      <td className="ps-4 fw-bold">{item.item_name}</td>
                      <td className="text-center text-success fw-bold">₱{Number(item.item_price).toFixed(2)}</td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-outline-warning me-2 fw-bold" onClick={() => handleEditInit(item)}>EDIT</button>
                        <button className="btn btn-sm btn-outline-danger fw-bold" onClick={() => setDeletingId(item.id)}>DEL</button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3" className="text-center py-4 text-muted">No active items found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deletingId && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1060 }}>
          <div className="card border-0 rounded-4 p-4 shadow-lg text-dark text-center" style={{ width: '400px' }}>
            <h2 className="text-danger mb-3">⚠️</h2>
            <h5 className="fw-bold">Archive This Item?</h5>
            <p className="small text-muted">
              Removing this item will hide it from new logs, but 
              <span className="fw-bold text-dark"> payroll history will be saved</span>. 
              Type <strong className="text-danger">DELETE</strong> to confirm:
            </p>
            <input 
              type="text" className="form-control text-center mb-3 fw-bold border-danger" 
              placeholder="Type DELETE" 
              value={deleteAuth} onChange={(e) => setDeleteAuth(e.target.value)} 
            />
            <div className="d-flex gap-2">
              <button className="btn btn-danger w-100 fw-bold" disabled={deleteAuth !== 'DELETE'} onClick={handleDelete}>Confirm Archive</button>
              <button className="btn btn-light border w-100" onClick={() => {setDeletingId(null); setDeleteAuth('');}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewItemForm;