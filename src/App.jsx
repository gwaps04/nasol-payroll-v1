import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import NewEmployeeForm from './NewEmployeeForm'
import NewItemForm from './NewItemForm'
import AssignItemForm from './AssignItemForm'
import WeeklySummary from './WeeklySummary'
import MonthlyPayoutPage from './MonthlyPayoutPage' // New Import

function App() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('') 
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [currentView, setCurrentView] = useState('home') 

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
    }
    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session) setCurrentView('home') 
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username, 
      password: password,
    })
    if (error) setError(error.message)
    else setUser(data.user)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const Dashboard = () => (
    <div className="container py-5 text-white">
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h1 className="fw-bold m-0 text-white">Nasol Haircraft Dashboard</h1>
          <p className="opacity-75">Logged in as: {user?.email}</p>
        </div>
        <button className="btn btn-outline-light shadow-sm px-4 rounded-pill" onClick={handleLogout}>Logout</button>
      </div>

      <div className="row g-4 justify-content-center text-dark">
        {/* Card 1: Add Employee */}
        <div className="col-md-6 col-lg-4 col-xl-2">
          <div className="card h-100 shadow border-0 rounded-4 p-3 text-center"
               onClick={() => setCurrentView('add_employee')}
               style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
            <div className="card-body">
              <div className="fs-1 text-primary mb-2">👤</div>
              <h6 className="fw-bold">Add Employee</h6>
              <button className="btn btn-primary btn-sm w-100 rounded-pill mt-2">Open</button>
            </div>
          </div>
        </div>

        {/* Card 2: Manage Items */}
        <div className="col-md-6 col-lg-4 col-xl-2">
          <div className="card h-100 shadow border-0 rounded-4 p-3 text-center"
               onClick={() => setCurrentView('add_item')}
               style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
            <div className="card-body">
              <div className="fs-1 text-success mb-2">🛠️</div>
              <h6 className="fw-bold">Manage Items</h6>
              <button className="btn btn-success btn-sm w-100 rounded-pill mt-2">Open</button>
            </div>
          </div>
        </div>

        {/* Card 3: Log Work */}
        <div className="col-md-6 col-lg-4 col-xl-2">
          <div className="card h-100 shadow border-0 rounded-4 p-3 text-center"
               onClick={() => setCurrentView('assign_items')}
               style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
            <div className="card-body">
              <div className="fs-1 text-info mb-2">📦</div>
              <h6 className="fw-bold">Log Work</h6>
              <button className="btn btn-info text-white btn-sm w-100 rounded-pill mt-2">Start</button>
            </div>
          </div>
        </div>

        {/* Card 4: Weekly Report */}
        <div className="col-md-6 col-lg-4 col-xl-3">
          <div className="card h-100 shadow border-0 rounded-4 p-3 text-center text-white"
               onClick={() => setCurrentView('view_summary')}
               style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' }}>
            <div className="card-body">
              <div className="fs-1 mb-2">📊</div>
              <h6 className="fw-bold">Weekly Report</h6>
              <button className="btn btn-light btn-sm w-100 rounded-pill fw-bold text-primary mt-2 shadow-sm">View</button>
            </div>
          </div>
        </div>

        {/* Card 5: Monthly Payout (NEW) */}
        <div className="col-md-6 col-lg-4 col-xl-3">
          <div className="card h-100 shadow border-0 rounded-4 p-3 text-center text-white"
               onClick={() => setCurrentView('monthly_payout')}
               style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)' }}>
            <div className="card-body">
              <div className="fs-1 mb-2">📅</div>
              <h6 className="fw-bold">Monthly Payout</h6>
              <button className="btn btn-light btn-sm w-100 rounded-pill fw-bold text-purple mt-2 shadow-sm" style={{color: '#6d28d9'}}>View Monthly</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (user) {
    switch(currentView) {
      case 'add_employee':
        return <NewEmployeeForm supabase={supabase} onBack={() => setCurrentView('home')} />
      case 'add_item':
        return <NewItemForm supabase={supabase} onBack={() => setCurrentView('home')} />
      case 'assign_items':
        return <AssignItemForm supabase={supabase} onBack={() => setCurrentView('home')} />
      case 'view_summary':
        return <WeeklySummary supabase={supabase} onBack={() => setCurrentView('home')} />
      case 'monthly_payout':
        return <MonthlyPayoutPage supabase={supabase} onBack={() => setCurrentView('home')} />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="container">
      <div className="row justify-content-center mt-5 pt-5">
        <div className="col-md-5">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-5 text-center">
              <h2 className="fw-bold mb-2 text-primary">Nasol Haircraft</h2>
              <p className="text-muted mb-4">Payroll System V1</p>
              <form onSubmit={handleLogin}>
                <div className="mb-3 text-start">
                  <label className="form-label small fw-semibold">Email</label>
                  <input type="email" className="form-control form-control-lg bg-light border-0 px-3" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="mb-4 text-start">
                  <label className="form-label small fw-semibold">Password</label>
                  <input type="password" className="form-control form-control-lg bg-light border-0 px-3" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {error && <div className="alert alert-danger py-2 small">{error}</div>}
                <button type="submit" className="btn btn-primary btn-lg w-100 fw-bold shadow-sm rounded-3">Login</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App