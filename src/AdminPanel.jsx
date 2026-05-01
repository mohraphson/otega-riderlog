 import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export default function AdminPanel({ onExit }) {
  // Navigation & Date States
  const [activeTab, setActiveTab] = useState('summary') // 'summary' | 'log' | 'riders' | 'locations' | 'settings'
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekString, setWeekString] = useState('')
  
  // Data States
  const [summary, setSummary] = useState([])
  const [ridersList, setRidersList] = useState([])
  const [locationsList, setLocationsList] = useState([])
  const [deliveryLog, setDeliveryLog] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Form States for Riders & Locations
  const [newRiderName, setNewRiderName] = useState('')
  const [editingRiderId, setEditingRiderId] = useState(null)
  const [editingRiderName, setEditingRiderName] = useState('')

  const [newLocName, setNewLocName] = useState('')
  const [newLocDay, setNewLocDay] = useState('')
  const [newLocNight, setNewLocNight] = useState('')
  const [editingLocId, setEditingLocId] = useState(null)
  const [editingLocName, setEditingLocName] = useState('')
  const [editingLocDay, setEditingLocDay] = useState('')
  const [editingLocNight, setEditingLocNight] = useState('')

  // Form States for Settings
  const [newPin, setNewPin] = useState('')
  const [pinStatus, setPinStatus] = useState('')

  // States for Delivery Log & Editing
  const [logFilterRider, setLogFilterRider] = useState('ALL')
  const [editingDelId, setEditingDelId] = useState(null)
  const [editDelData, setEditDelData] = useState({ rider_id: '', location_id: '', is_night: false, price: 0 })

  // Global Fetch (We need riders and locations globally for dropdowns)
  useEffect(() => {
    const fetchGlobals = async () => {
      const { data: rData } = await supabase.from('riders').select('*').order('name')
      if (rData) setRidersList(rData)
      const { data: lData } = await supabase.from('locations').select('*').order('name')
      if (lData) setLocationsList(lData)
    }
    fetchGlobals()
  }, [])

  // Trigger specific data fetch when Tab changes
  useEffect(() => {
    if (activeTab === 'summary') fetchWeeklySummary()
    else if (activeTab === 'log') fetchDeliveryLog()
    // riders and locations are fetched globally now, but we can refresh them if needed
  }, [activeTab, weekOffset, logFilterRider])

  // Auto-calculate price when editing a delivery
  useEffect(() => {
    if (editingDelId && editDelData.location_id) {
      const loc = locationsList.find(l => l.id === editDelData.location_id)
      if (loc) {
        setEditDelData(prev => ({
          ...prev, 
          price: prev.is_night ? loc.night_price : loc.day_price
        }))
      }
    }
  }, [editDelData.location_id, editDelData.is_night, locationsList])


  // ==========================================
  // TAB 1: SUMMARY LOGIC
  // ==========================================
  const fetchWeeklySummary = async () => {
    setIsLoading(true)
    const now = new Date()
    const dayOfWeek = now.getDay() || 7
    
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1 + (weekOffset * 7))
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const options = { day: 'numeric', month: 'short' }
    const startStr = startOfWeek.toLocaleDateString('en-GB', options)
    const endStr = endOfWeek.toLocaleDateString('en-GB', { ...options, year: 'numeric' })
    
    if (weekOffset === 0) setWeekString(`Current Week (${startStr} - ${endStr})`)
    else if (weekOffset === -1) setWeekString(`Last Week (${startStr} - ${endStr})`)
    else setWeekString(`${startStr} - ${endStr}`)

    const { data: deliveries, error } = await supabase
      .from('deliveries')
      .select(`price, riders ( name )`)
      .gte('created_at', startOfWeek.toISOString())
      .lte('created_at', endOfWeek.toISOString())

    if (!error && deliveries) {
      const totals = {}
      deliveries.forEach(d => {
        const riderName = d.riders?.name || 'Deleted Rider'
        if (!totals[riderName]) totals[riderName] = { count: 0, amount: 0 }
        totals[riderName].count += 1
        totals[riderName].amount += d.price
      })
      
      const summaryArray = Object.keys(totals)
        .map(name => ({ name, ...totals[name] }))
        .sort((a, b) => b.amount - a.amount)
      
      setSummary(summaryArray)
    }
    setIsLoading(false)
  }

  // ==========================================
  // TAB 2: DELIVERY LOG & HISTORY LOGIC
  // ==========================================
  const fetchDeliveryLog = async () => {
    setIsLoading(true)
    let query = supabase
      .from('deliveries')
      .select(`id, created_at, price, is_night_shift, rider_id, location_id, riders(name), locations(name)`)
      .order('created_at', { ascending: false })
      .limit(100) // Keep the UI fast, load top 100 recent

    if (logFilterRider !== 'ALL') {
      query = query.eq('rider_id', logFilterRider)
    }

    const { data, error } = await query
    if (!error && data) setDeliveryLog(data)
    setIsLoading(false)
  }

  const handleDeleteDelivery = async (id) => {
    if (window.confirm('Delete this delivery record permanently?')) {
      await supabase.from('deliveries').delete().eq('id', id)
      fetchDeliveryLog()
    }
  }

  const handleSaveDeliveryEdit = async () => {
    const { error } = await supabase.from('deliveries').update({
      rider_id: editDelData.rider_id,
      location_id: editDelData.location_id,
      is_night_shift: editDelData.is_night,
      price: editDelData.price
    }).eq('id', editingDelId)

    if (error) alert("Error saving edit: " + error.message)
    else {
      setEditingDelId(null)
      fetchDeliveryLog()
    }
  }

  // ==========================================
  // TAB 3 & 4: RIDERS & LOCATIONS LOGIC
  // ==========================================
  const handleAddRider = async (e) => {
    e.preventDefault(); if (!newRiderName.trim()) return
    const { error } = await supabase.from('riders').insert([{ name: newRiderName.trim() }])
    if (error) alert("Error: " + error.message); else { setNewRiderName(''); const { data } = await supabase.from('riders').select('*').order('name'); setRidersList(data); }
  }


const handleResetRiderPin = async (id, name) => {
    if (window.confirm(`Reset ${name}'s PIN back to default (0000)?`)) {
      
      // We are adding explicit error checking here
      const { error } = await supabase.from('riders').update({ pin: '0000' }).eq('id', id)
      
      if (error) {
        alert("❌ Error resetting PIN: " + error.message)
      } else {
        alert(`✅ ${name}'s PIN has been securely reset to 0000.`)
      }
    }
  }


  const handleDeleteRider = async (id, name) => {
    if (window.confirm(`Delete ${name}? WARNING: Deletes history too!`)) { await supabase.from('riders').delete().eq('id', id); const { data } = await supabase.from('riders').select('*').order('name'); setRidersList(data); }
  }
  const handleUpdateRider = async (id) => {
    if (!editingRiderName.trim()) return
    await supabase.from('riders').update({ name: editingRiderName.trim() }).eq('id', id); setEditingRiderId(null); const { data } = await supabase.from('riders').select('*').order('name'); setRidersList(data);
  }

  const handleAddLocation = async (e) => {
    e.preventDefault(); if (!newLocName.trim() || !newLocDay || !newLocNight) return
    const { error } = await supabase.from('locations').insert([{ name: newLocName.trim(), day_price: parseInt(newLocDay), night_price: parseInt(newLocNight) }])
    if (error) alert("Error: " + error.message); else { setNewLocName(''); setNewLocDay(''); setNewLocNight(''); const { data } = await supabase.from('locations').select('*').order('name'); setLocationsList(data); }
  }
  const handleDeleteLocation = async (id, name) => {
    if (window.confirm(`Delete ${name}? WARNING: Deletes history too!`)) { await supabase.from('locations').delete().eq('id', id); const { data } = await supabase.from('locations').select('*').order('name'); setLocationsList(data); }
  }
  const handleUpdateLocation = async (id) => {
    if (!editingLocName.trim() || !editingLocDay || !editingLocNight) return
    await supabase.from('locations').update({ name: editingLocName.trim(), day_price: parseInt(editingLocDay), night_price: parseInt(editingLocNight) }).eq('id', id); setEditingLocId(null); const { data } = await supabase.from('locations').select('*').order('name'); setLocationsList(data);
  }

  // ==========================================
  // TAB 5: SETTINGS LOGIC
  // ==========================================
  const handleUpdatePin = async (e) => {
    e.preventDefault(); if (!newPin.trim()) return
    setPinStatus('Updating...')
    const { error } = await supabase.from('admin_settings').update({ pin: newPin.trim() }).eq('id', 1)
    if (error) setPinStatus('❌ Error updating PIN')
    else { setPinStatus('✅ PIN successfully updated!'); setNewPin(''); setTimeout(() => setPinStatus(''), 3000) }
  }

  // Helper for Date Formatting
  const formatDate = (isoString) => {
    const d = new Date(isoString)
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }


  // ==========================================
  // UI RENDER
  // ==========================================
  return (
    <div className="w-full max-w-4xl bg-white p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
      
      {/* Header & Close Button */}
      <div className="flex justify-between items-center border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Admin Dashboard</h2>
          <p className="text-otega-green font-medium text-sm mt-1">Otega Restaurant Tracker</p>
        </div>
        <button onClick={onExit} className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs Navigation (Scrollable on mobile) */}
      <div className="flex overflow-x-auto bg-gray-100 p-1 rounded-xl gap-1 no-scrollbar shrink-0">
        <button onClick={() => setActiveTab('summary')} className={`px-4 py-3 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'summary' ? 'bg-white text-otega-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📊 Summary</button>
        <button onClick={() => setActiveTab('log')} className={`px-4 py-3 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'log' ? 'bg-white text-otega-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📜 Log & History</button>
        <button onClick={() => setActiveTab('riders')} className={`px-4 py-3 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'riders' ? 'bg-white text-otega-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>🛵 Riders</button>
        <button onClick={() => setActiveTab('locations')} className={`px-4 py-3 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'locations' ? 'bg-white text-otega-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📍 Locations</button>
        <button onClick={() => setActiveTab('settings')} className={`px-4 py-3 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'settings' ? 'bg-white text-otega-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>⚙️ Settings</button>
      </div>

      {/* TAB 1: SUMMARY */}
      {activeTab === 'summary' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center bg-otega-green/5 p-2 rounded-xl border border-otega-green/10">
            <button onClick={() => setWeekOffset(prev => prev - 1)} className="px-4 py-2 text-otega-green font-bold hover:bg-otega-green/10 rounded-lg">&larr; Prev</button>
            <div className="text-center"><span className="block text-sm font-extrabold text-otega-green uppercase tracking-wider">{weekString}</span></div>
            <button onClick={() => setWeekOffset(prev => prev + 1)} disabled={weekOffset === 0} className="px-4 py-2 text-otega-green font-bold hover:bg-otega-green/10 rounded-lg disabled:opacity-30">Next &rarr;</button>
          </div>
          {isLoading ? ( <div className="text-center py-12 text-gray-400 font-medium animate-pulse">Loading financial data...</div> ) : summary.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">No deliveries logged for this timeframe.</div>
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              {summary.map((rider, index) => (
                <div key={index} className="flex justify-between items-center p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-otega-green/10 flex items-center justify-center text-otega-green font-bold text-xl">{rider.name.charAt(0)}</div>
                    <div><p className="font-bold text-lg text-gray-900">{rider.name}</p><p className="text-sm text-gray-500 font-medium">{rider.count} deliveries</p></div>
                  </div>
                  <div className="text-right"><p className="font-black text-2xl text-otega-green">₦{rider.amount.toLocaleString()}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DELIVERY LOG & HISTORY */}
      {activeTab === 'log' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
          {/* Filter Bar */}
          <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl flex items-center gap-4">
            <label className="font-bold text-sm text-gray-700 whitespace-nowrap">Filter History:</label>
            <select 
              value={logFilterRider} 
              onChange={(e) => setLogFilterRider(e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-otega-green bg-white"
            >
              <option value="ALL">Show All Riders</option>
              {ridersList.map(r => <option key={r.id} value={r.id}>{r.name}'s Deliveries</option>)}
            </select>
          </div>

          {/* Records List */}
          <div className="flex flex-col gap-3">
            {isLoading ? <div className="text-center py-12 text-gray-400 font-medium animate-pulse">Loading logs...</div> : deliveryLog.length === 0 ? (
               <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">No history found.</div>
            ) : deliveryLog.map((log) => (
              <div key={log.id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all">
                
                {editingDelId === log.id ? (
                  /* EDIT MODE UI */
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select value={editDelData.rider_id} onChange={e => setEditDelData({...editDelData, rider_id: e.target.value})} className="flex-1 p-2 border border-otega-green rounded-lg bg-gray-50 focus:outline-none">
                        {ridersList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <select value={editDelData.location_id} onChange={e => setEditDelData({...editDelData, location_id: e.target.value})} className="flex-1 p-2 border border-otega-green rounded-lg bg-gray-50 focus:outline-none">
                        {locationsList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                      <button onClick={() => setEditDelData({...editDelData, is_night: !editDelData.is_night})} className={`p-2 font-bold rounded-lg ${editDelData.is_night ? 'bg-gray-800 text-otega-gold' : 'bg-gray-200 text-gray-800'}`}>
                        {editDelData.is_night ? '🌙 Night' : '☀️ Day'}
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-2 border-t pt-3">
                      <div className="text-otega-green font-black text-xl">Auto Price: ₦{editDelData.price.toLocaleString()}</div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveDeliveryEdit} className="px-4 py-2 bg-otega-green text-white font-bold rounded-lg shadow-sm">Save Fix</button>
                        <button onClick={() => setEditingDelId(null)} className="px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg">Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* VIEW MODE UI */
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900 text-lg">{log.riders?.name || 'Deleted Rider'}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${log.is_night_shift ? 'bg-gray-800 text-otega-gold' : 'bg-yellow-100 text-yellow-800'}`}>
                          {log.is_night_shift ? '🌙 Night' : '☀️ Day'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 font-medium">📍 {log.locations?.name || 'Deleted Location'}</div>
                      <div className="text-xs text-gray-400 mt-1">🕒 {formatDate(log.created_at)}</div>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col items-center sm:items-end w-full sm:w-auto justify-between sm:justify-center gap-2">
                      <span className="font-black text-xl text-otega-green">₦{log.price.toLocaleString()}</span>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setEditingDelId(log.id)
                          setEditDelData({ rider_id: log.rider_id, location_id: log.location_id, is_night: log.is_night_shift, price: log.price })
                        }} className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors">Edit</button>
                        <button onClick={() => handleDeleteDelivery(log.id)} className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors">Del</button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RIDERS */}
      {activeTab === 'riders' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <form onSubmit={handleAddRider} className="flex gap-2">
            <input type="text" placeholder="New rider name..." value={newRiderName} onChange={(e) => setNewRiderName(e.target.value)} className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-otega-green focus:bg-white" />
            <button type="submit" disabled={!newRiderName.trim()} className="px-6 py-4 bg-otega-green text-white font-bold rounded-xl shadow-md disabled:bg-gray-300">Add</button>
          </form>
          <div className="flex flex-col gap-2">
            {isLoading ? <div className="text-center py-6 text-gray-400 font-medium animate-pulse">Loading staff...</div> : ridersList.map(rider => (
              <div key={rider.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                {editingRiderId !== rider.id && (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingRiderId(rider.id); setEditingRiderName(rider.name); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium">Edit</button>
                    <button onClick={() => handleDeleteRider(rider.id, rider.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium">Delete</button>
                  </div>
                )}

                
                {editingRiderId !== rider.id && (
                  <div className="flex gap-2">

                    <button onClick={() => handleResetRiderPin(rider.id, rider.name)} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg text-sm font-medium">Reset PIN</button>
                    <button onClick={() => { setEditingRiderId(rider.id); setEditingRiderName(rider.name); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium">Edit</button>
                    <button onClick={() => handleDeleteRider(rider.id, rider.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium">Delete</button>

                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LOCATIONS */}
      {activeTab === 'locations' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <form onSubmit={handleAddLocation} className="bg-gray-50 p-4 border border-gray-200 rounded-xl flex flex-col gap-3">
            <h3 className="font-bold text-gray-700 text-sm">Add New Location</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" placeholder="Location Name" value={newLocName} onChange={(e) => setNewLocName(e.target.value)} className="flex-[2] p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-otega-green" />
              <input type="number" placeholder="Day (₦)" value={newLocDay} onChange={(e) => setNewLocDay(e.target.value)} className="flex-1 p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-otega-green" />
              <input type="number" placeholder="Night (₦)" value={newLocNight} onChange={(e) => setNewLocNight(e.target.value)} className="flex-1 p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-otega-green" />
              <button type="submit" disabled={!newLocName.trim() || !newLocDay || !newLocNight} className="px-6 py-3 bg-otega-green text-white font-bold rounded-lg shadow-md disabled:bg-gray-300">Add</button>
            </div>
          </form>
          <div className="flex flex-col gap-3">
            {isLoading ? <div className="text-center py-6 text-gray-400 font-medium animate-pulse">Loading locations...</div> : locationsList.map(loc => (
              <div key={loc.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm gap-4">
                {editingLocId === loc.id ? (
                  <div className="flex flex-col w-full gap-2">
                    <input type="text" value={editingLocName} onChange={(e) => setEditingLocName(e.target.value)} className="w-full p-2 border border-otega-green rounded-lg focus:outline-none" placeholder="Name" />
                    <div className="flex gap-2">
                      <input type="number" value={editingLocDay} onChange={(e) => setEditingLocDay(e.target.value)} className="flex-1 p-2 border border-otega-green rounded-lg focus:outline-none" placeholder="Day Price" />
                      <input type="number" value={editingLocNight} onChange={(e) => setEditingLocNight(e.target.value)} className="flex-1 p-2 border border-otega-green rounded-lg focus:outline-none" placeholder="Night Price" />
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => handleUpdateLocation(loc.id)} className="flex-1 py-2 bg-otega-green text-white rounded-lg font-bold">Save</button>
                      <button onClick={() => setEditingLocId(null)} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <span className="font-bold text-lg text-gray-800 block">{loc.name}</span>
                      <div className="flex gap-4 mt-1 text-sm font-medium text-gray-500">
                        <span className="flex items-center gap-1">☀️ ₦{loc.day_price?.toLocaleString()}</span>
                        <span className="flex items-center gap-1">🌙 ₦{loc.night_price?.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      <button onClick={() => { setEditingLocId(loc.id); setEditingLocName(loc.name); setEditingLocDay(loc.day_price); setEditingLocNight(loc.night_price); }} className="p-2 px-4 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-bold transition-colors">Edit</button>
                      <button onClick={() => handleDeleteLocation(loc.id, loc.name)} className="p-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-bold transition-colors">Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="bg-gray-50 p-6 border border-gray-200 rounded-xl">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Change Admin PIN</h3>
            <form onSubmit={handleUpdatePin} className="flex flex-col gap-4">
              <div>
                <input type="text" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="e.g. 5678" className="w-full p-4 border border-gray-300 rounded-xl focus:border-otega-green focus:outline-none" />
              </div>
              <button type="submit" disabled={!newPin.trim()} className="w-full py-4 bg-gray-900 text-otega-gold font-bold rounded-xl shadow-md disabled:bg-gray-400 transition-colors">Update Security PIN</button>
              {pinStatus && <div className="text-center font-bold p-3 text-gray-800">{pinStatus}</div>}
            </form>
          </div>
        </div>
      )}

    </div>
  )
}