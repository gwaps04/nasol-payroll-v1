import { useState } from 'react';

const NewItemForm = ({ supabase, onBack }) => {
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState(null);

  const handleAddItem = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMessage(null);

    try {
      // Notice we convert itemPrice to a Number before sending
      const { error } = await supabase
        .from('items')
        .insert([{ 
          item_name: itemName, 
          item_price: parseFloat(itemPrice) 
        }]);

      if (error) throw error;

      setFormMessage({ type: 'success', text: `Success! ${itemName} has been added to inventory.` });
      setItemName('');
      setItemPrice('');
    } catch (err) {
      console.error("Supabase Item Error:", err);
      setFormMessage({ type: 'danger', text: `Database Error: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <button className="btn btn-light mb-4 shadow-sm" onClick={onBack}>
            ← Back to Dashboard
          </button>
          
          <div className="card shadow-lg border-0 rounded-4 p-5">
            <h2 className="fw-bold mb-4 text-success text-center">Add New Item</h2>
            
            {formMessage && (
              <div className={`alert alert-${formMessage.type} alert-dismissible fade show mb-4`} role="alert">
                <strong>{formMessage.type === 'success' ? '✔' : '✘'}</strong> {formMessage.text}
                <button type="button" className="btn-close" onClick={() => setFormMessage(null)}></button>
              </div>
            )}

            <form onSubmit={handleAddItem}>
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">Item Name</label>
                <input 
                  type="text" 
                  className="form-control form-control-lg bg-light border-0" 
                  placeholder="Add Item here"
                  value={itemName} 
                  onChange={(e) => setItemName(e.target.value)} 
                  required 
                />
              </div>
              <div className="mb-4">
                <label className="form-label small fw-bold text-muted">Item Price (₱)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-control form-control-lg bg-light border-0" 
                  placeholder="0.00"
                  value={itemPrice} 
                  onChange={(e) => setItemPrice(e.target.value)} 
                  required 
                />
              </div>
              <button type="submit" className="btn btn-success btn-lg w-100 fw-bold shadow-sm" disabled={isSubmitting}>
                {isSubmitting ? 'Adding Item...' : 'Save Item'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewItemForm;