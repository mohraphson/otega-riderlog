import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export default function RiderPortal({ riders, onExit }) {
  const [selectedRider, setSelectedRider] = useState('')
  const [enteredPin, setEnteredPin] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeRider, setActiveRider] = useState(null)
  
  // Dashboard Data
  const [deliveries, setDeliveries] = useState([])
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // PIN Change State
  const [newPin, setNewPin] = useState('')
  const [pinMessage, setPinMessage] = useState('')

  // Handle Login Check
  const handleLogin = async (e) => {
    e.preventDefault()
    if (!selectedRider || !enteredPin) return

    const { data, error } = await supabase
      .from('riders')
      .select('id, name, pin')
      .eq('id', selectedRider)
      .single()

    if (data && data.pin === enteredPin) {
      setActiveRider(data)
      setIsLoggedIn(true)
      fetchMyDeliveries(data.id)
    } else {
      alert("Incorrect PIN ❌. (Default is 0000)")
    }
  }

  // Fetch Current Week Deliveries
  const fetchMyDeliveries = async (riderId) => {
    setIsLoading(true)
    const now = new Date()
    const dayOfWeek = now.getDay() || 7
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1)
    startOfWeek.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('deliveries')
      .select('price, created_at, is_night_shift, locations(name)')
      .eq('rider_id', riderId)
      .gte('created_at', startOfWeek.toISOString())
      .order('created_at', { ascending: false })

    if (data) {
      setDeliveries(data)
      const total = data.reduce((sum, item) => sum + item.price, 0)
      setTotalEarnings(total)
    }
    setIsLoading(false)
  }

  // Handle PIN Change
  const handleChangePin = async (e) => {
    e.preventDefault()
    if (!newPin || newPin.length < 4) {
      setPinMessage('PIN must be at least 4 characters')
      return
    }

    const { error } = await supabase
      .from('riders')
      .update({ pin: newPin })
      .eq('id', activeRider.id)

    if (error) {
      setPinMessage('❌ Error updating PIN')
    } else {
      setPinMessage('✅ PIN Updated Successfully!')
      setNewPin('')
      setTimeout(() => setPinMessage(''), 3000)
    }
  }

  // Helper for Date
  const formatDate = (iso) => {
    return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  }

  // ==========================================
  // RENDER LOGIN SCREEN
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-900">Rider Login</h2>
          <button onClick={onExit} className="p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-full">✕</button>
        </div>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <select 
            className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-800 focus:border-otega-green focus:outline-none"
            value={selectedRider} onChange={(e) => setSelectedRider(e.target.value)} required
          >
            <option value="" disabled>👤 Select Your Name</option>
            {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <input 
            type="password" placeholder="Enter PIN (Default: 0000)" 
            className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-800 focus:border-otega-green focus:outline-none"
            value={enteredPin} onChange={(e) => setEnteredPin(e.target.value)} required
          />

          <button type="submit" className="w-full p-4 bg-otega-green text-white font-bold rounded-xl shadow-md hover:bg-[#0d3b2c] transition-colors">
            Access My Portal
          </button>
        </form>
      </div>
    )
  }

  // ==========================================
  // RENDER DASHBOARD SCREEN
  // ==========================================
  return (
    <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
      
      <div className="flex justify-between items-start border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Welcome, {activeRider.name}</h2>
          <p className="text-otega-green font-bold text-sm mt-1">Your Personal Portal</p>
        </div>
        <button onClick={onExit} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors">
          Logout
        </button>
      </div>

      {/* Earnings Summary Card */}
      <div className="bg-otega-green rounded-2xl p-6 text-white shadow-lg shadow-otega-green/30 text-center">
        <p className="text-otega-green-100 text-sm font-bold uppercase tracking-wider mb-1">My Earnings (This Week)</p>
        <h3 className="text-4xl font-black text-otega-gold">₦{totalEarnings.toLocaleString()}</h3>
        <p className="text-xs mt-2 opacity-80">{deliveries.length} total deliveries logged</p>
      </div>

      {/* PIN Change Section */}
      <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl">
        <h4 className="font-bold text-sm text-gray-700 mb-3">🔒 Change Personal PIN</h4>
        <form onSubmit={handleChangePin} className="flex gap-2">
          <input 
            type="text" placeholder="New PIN" 
            value={newPin} onChange={(e) => setNewPin(e.target.value)}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:border-otega-green focus:outline-none"
          />
          <button type="submit" disabled={!newPin} className="px-4 bg-gray-800 text-otega-gold font-bold rounded-lg disabled:bg-gray-300">Update</button>
        </form>
        {pinMessage && <p className={`text-xs font-bold mt-2 ${pinMessage.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>{pinMessage}</p>}
      </div>

      {/* Delivery Log */}
      <div>
        <h4 className="font-black text-gray-800 mb-3 uppercase tracking-wide text-sm">📜 My Log (This Week)</h4>
        {isLoading ? (
          <div className="text-center py-6 text-gray-400 font-medium">Loading history...</div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">No deliveries yet this week.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {deliveries.map((del, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
                <div>
                  <p className="font-bold text-gray-800 text-sm">{del.locations?.name || 'Unknown'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{formatDate(del.created_at)}</span>
                    <span className="text-[10px] uppercase font-bold">{del.is_night_shift ? '🌙 Night' : '☀️ Day'}</span>
                  </div>
                </div>
                <div className="font-black text-otega-green">₦{del.price.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}