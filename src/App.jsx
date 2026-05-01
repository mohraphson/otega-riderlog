 import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import AdminPanel from './AdminPanel'

export default function App() {
  const [riders, setRiders] = useState([])
  const [locations, setLocations] = useState([])
  
  const [selectedRider, setSelectedRider] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [isNight, setIsNight] = useState(false)
  const [price, setPrice] = useState(0)
  
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const [isAdminView, setIsAdminView] = useState(false)
  const [isStaffUnlocked, setIsStaffUnlocked] = useState(false) // NEW LOCK STATE

  useEffect(() => {
    async function fetchData() {
      const { data: ridersData } = await supabase.from('riders').select('*').order('name')
      const { data: locationsData } = await supabase.from('locations').select('*').order('name')
      
      if (ridersData) setRiders(ridersData)
      if (locationsData) setLocations(locationsData)
    }
    // Only fetch if they are unlocked
    if (isStaffUnlocked) fetchData()
  }, [isAdminView, isStaffUnlocked])

  useEffect(() => {
    if (selectedLocation) {
      const loc = locations.find(l => l.id === selectedLocation)
      if (loc) setPrice(isNight ? loc.night_price : loc.day_price)
    } else {
      setPrice(0)
    }
  }, [selectedLocation, isNight, locations])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedRider || !selectedLocation) return
    setIsLoading(true)

    const { error } = await supabase.from('deliveries').insert([
      {
        rider_id: selectedRider,
        location_id: selectedLocation,
        price: price,
        is_night_shift: isNight,
        status: 'completed' // Explicitly set to completed
      }
    ])

    setIsLoading(false)

    if (error) {
      setStatus('Error saving ❌')
    } else {
      if (navigator.vibrate) navigator.vibrate(100)
      setStatus('Delivery Added ✅')
      setSelectedRider('')
      setSelectedLocation('')
      setPrice(0)
    }
    setTimeout(() => setStatus(''), 2000)
  }

  // ==========================================
  // STAFF LOCK SCREEN UI
  // ==========================================
  if (!isStaffUnlocked && !isAdminView) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-2xl text-center">
          <h1 className="text-2xl font-black text-gray-900 mb-2">Staff Access</h1>
          <p className="text-sm text-gray-500 mb-6">Enter the daily PIN to log deliveries.</p>
          
          <button 
            onClick={async () => {
              const enteredPin = window.prompt("Enter Daily Staff PIN:")
              if (!enteredPin) return
              const { data } = await supabase.from('staff_settings').select('daily_pin').eq('id', 1).single()
              if (data && data.daily_pin === enteredPin) setIsStaffUnlocked(true)
              else alert("Incorrect PIN ❌")
            }}
            className="w-full py-4 bg-otega-green text-white font-bold rounded-xl shadow-md hover:bg-[#0d3b2c]"
          >
            Unlock Register
          </button>

          {/* Admin Backdoor from Lock Screen */}
          <button 
            onClick={async () => {
              const enteredPin = window.prompt("Enter Admin Master PIN:")
              if (!enteredPin) return
              const { data } = await supabase.from('admin_settings').select('pin').eq('id', 1).single()
              if (data && data.pin === enteredPin) setIsAdminView(true)
              else alert("Incorrect PIN ❌")
            }}
            className="mt-6 text-sm font-bold text-gray-400 hover:text-gray-600"
          >
            Admin Login
          </button>
        </div>
      </div>
    )
  }

  // ==========================================
  // MAIN APP UI
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-8 px-4 font-sans relative">
      <div className="w-full max-w-md text-center mb-8">
        <h1 className="text-3xl font-bold text-otega-green tracking-tight">Otega Tracker</h1>
        <p className="text-gray-500 text-sm mt-1">Fast Delivery Logging</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6 z-10">
        <div className="flex bg-gray-100 rounded-xl p-1 relative">
          <button type="button" onClick={() => setIsNight(false)} className={`flex-1 py-3 text-lg font-semibold rounded-lg transition-all ${!isNight ? 'bg-white shadow-sm text-otega-green' : 'text-gray-500'}`}>☀️ Day</button>
          <button type="button" onClick={() => setIsNight(true)} className={`flex-1 py-3 text-lg font-semibold rounded-lg transition-all ${isNight ? 'bg-gray-800 shadow-sm text-otega-gold' : 'text-gray-500'}`}>🌙 Night</button>
        </div>

        <select className="w-full p-4 text-xl border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-800 focus:border-otega-green focus:bg-white focus:outline-none" value={selectedRider} onChange={(e) => setSelectedRider(e.target.value)} required>
          <option value="" disabled>👤 Select Rider</option>
          {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <select className="w-full p-4 text-xl border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-800 focus:border-otega-green focus:bg-white focus:outline-none" value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} required>
          <option value="" disabled>📍 Select Location</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        <div className="bg-otega-green/10 border border-otega-green/20 p-4 rounded-xl text-center">
          <span className="text-otega-green block text-sm font-semibold mb-1 uppercase tracking-wider">Calculated Price</span>
          <span className="text-4xl font-bold text-otega-green">₦{price.toLocaleString()}</span>
        </div>

        <button type="submit" disabled={!selectedRider || !selectedLocation || isLoading} className="w-full p-5 mt-2 text-xl font-bold text-white bg-otega-green rounded-xl shadow-lg active:scale-95 disabled:bg-gray-300">
          {isLoading ? 'Saving...' : 'Add Delivery'}
        </button>

        {status && <div className="text-center font-bold text-lg text-otega-green animate-pulse">{status}</div>}
      </form>

      <div className="mt-auto pt-10 pb-6 text-center w-full z-10 flex flex-col items-center gap-4">
        <button onClick={() => setIsStaffUnlocked(false)} className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm font-bold shadow-sm">
          🔒 Lock Register
        </button>
        <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">
          Developed by <span className="text-otega-green font-bold">Rabiu Aliyu</span>
        </p>
      </div>

      {isAdminView && (
        <div className="absolute top-0 left-0 w-full min-h-screen bg-gray-50 flex justify-center items-start pt-8 px-4 z-50">
          <AdminPanel onExit={() => setIsAdminView(false)} />
        </div>
      )}

      {/* Admin Button (Bottom Right) */}
      {!isAdminView && (
        <button 
          onClick={async () => {
            const enteredPin = window.prompt("Enter Admin PIN:")
            if (!enteredPin) return
            const { data } = await supabase.from('admin_settings').select('pin').eq('id', 1).single()
            if (data && data.pin === enteredPin) setIsAdminView(true)
            else alert("Incorrect PIN ❌")
          }}
          className="fixed bottom-6 right-6 p-4 bg-gray-800 text-otega-gold rounded-full shadow-xl opacity-20 hover:opacity-100 transition-opacity z-20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}

    </div>
  )
}