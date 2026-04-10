import { useState, useEffect, useCallback, useRef } from 'react';

const API = 'http://localhost:5000/api';

// ─── TOAST HOOK ──────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, addToast };
}

// ─── MINI MAP COMPONENT ───────────────────────────────────────────────────────
function MiniMap({ drivers, currentUser }) {
  const canvasRef = useRef(null);
  const GRID_SIZE = 12;
  const PADDING = 30;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cellW = (W - PADDING * 2) / GRID_SIZE;
    const cellH = (H - PADDING * 2) / GRID_SIZE;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const x = PADDING + i * cellW;
      const y = PADDING + i * cellH;
      ctx.beginPath(); ctx.moveTo(x, PADDING); ctx.lineTo(x, H - PADDING); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PADDING, y); ctx.lineTo(W - PADDING, y); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = 'rgba(148,163,184,0.5)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= GRID_SIZE; i += 2) {
      ctx.fillText(i, PADDING + i * cellW, H - PADDING + 16);
      ctx.fillText(i, PADDING - 16, H - PADDING - i * cellH + 4);
    }

    const toCanvas = (x, y) => ({
      cx: PADDING + x * cellW,
      cy: H - PADDING - y * cellH,
    });

    // Draw drivers
    drivers.forEach(d => {
      const { cx, cy } = toCanvas(d.x, d.y);
      const isAvailable = d.available === 1;

      // Connection line to user
      if (currentUser && isAvailable) {
        const uc = toCanvas(currentUser.x, currentUser.y);
        ctx.beginPath();
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = 'rgba(108,99,255,0.2)';
        ctx.lineWidth = 1;
        ctx.moveTo(cx, cy);
        ctx.lineTo(uc.cx, uc.cy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Driver circle
      const color = isAvailable ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = color + '22';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Name label
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.name.split(' ')[0], cx, cy - 10);
    });

    // Draw user
    if (currentUser) {
      const { cx, cy } = toCanvas(currentUser.x, currentUser.y);
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', cx, cy - 12);
    }
  }, [drivers, currentUser]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={320}
      className="map-canvas"
      style={{ borderRadius: '8px' }}
    />
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState({ drivers: false, rides: false, addDriver: false, requestRide: false });
  const [lastRideResult, setLastRideResult] = useState(null);
  const [userPreview, setUserPreview] = useState(null);

  // Forms
  const [driverForm, setDriverForm] = useState({ name: '', x: '', y: '' });
  const [rideForm, setRideForm] = useState({ user_name: '', user_x: '', user_y: '' });

  const { toasts, addToast } = useToast();

  // Fetch helpers
  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${API}/stats`);
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch { }
  }, []);

  const fetchDrivers = useCallback(async () => {
    setLoading(l => ({ ...l, drivers: true }));
    try {
      const r = await fetch(`${API}/drivers`);
      const d = await r.json();
      if (d.success) setDrivers(d.data);
    } catch { addToast('Failed to fetch drivers', 'error'); }
    finally { setLoading(l => ({ ...l, drivers: false })); }
  }, [addToast]);

  const fetchRides = useCallback(async () => {
    setLoading(l => ({ ...l, rides: true }));
    try {
      const r = await fetch(`${API}/rides`);
      const d = await r.json();
      if (d.success) setRides(d.data);
    } catch { addToast('Failed to fetch rides', 'error'); }
    finally { setLoading(l => ({ ...l, rides: false })); }
  }, [addToast]);

  const refreshAll = useCallback(() => {
    fetchStats();
    fetchDrivers();
    fetchRides();
  }, [fetchStats, fetchDrivers, fetchRides]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(refreshAll, 10000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // Add Driver
  const handleAddDriver = async (e) => {
    e.preventDefault();
    if (!driverForm.name || driverForm.x === '' || driverForm.y === '') {
      return addToast('Please fill in all driver fields.', 'error');
    }
    setLoading(l => ({ ...l, addDriver: true }));
    try {
      const r = await fetch(`${API}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: driverForm.name, x: driverForm.x, y: driverForm.y }),
      });
      const d = await r.json();
      if (d.success) {
        addToast(d.message, 'success');
        setDriverForm({ name: '', x: '', y: '' });
        refreshAll();
      } else addToast(d.message, 'error');
    } catch { addToast('Network error. Is the backend running?', 'error'); }
    finally { setLoading(l => ({ ...l, addDriver: false })); }
  };

  // Request Ride
  const handleRequestRide = async (e) => {
    e.preventDefault();
    if (!rideForm.user_name || rideForm.user_x === '' || rideForm.user_y === '') {
      return addToast('Please fill in all ride request fields.', 'error');
    }
    setLoading(l => ({ ...l, requestRide: true }));
    setLastRideResult(null);
    try {
      const r = await fetch(`${API}/rides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: rideForm.user_name, user_x: rideForm.user_x, user_y: rideForm.user_y }),
      });
      const d = await r.json();
      addToast(d.message, d.success ? 'success' : 'error');
      setLastRideResult(d);
      if (d.success) {
        setRideForm({ user_name: '', user_x: '', user_y: '' });
        setUserPreview(null);
      }
      refreshAll();
    } catch { addToast('Network error. Is the backend running?', 'error'); }
    finally { setLoading(l => ({ ...l, requestRide: false })); }
  };

  // Delete Driver
  const handleDeleteDriver = async (id, name) => {
    if (!window.confirm(`Remove driver "${name}"?`)) return;
    try {
      const r = await fetch(`${API}/drivers/${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.success) { addToast(d.message, 'success'); refreshAll(); }
      else addToast(d.message, 'error');
    } catch { addToast('Network error', 'error'); }
  };

  // Toggle Driver Availability
  const handleToggleDriver = async (id) => {
    try {
      const r = await fetch(`${API}/drivers/${id}/toggle`, { method: 'PATCH' });
      const d = await r.json();
      if (d.success) { addToast(d.message, 'success'); refreshAll(); }
      else addToast(d.message, 'error');
    } catch { addToast('Network error', 'error'); }
  };

  // Complete Ride
  const handleCompleteRide = async (id) => {
    try {
      const r = await fetch(`${API}/rides/${id}/complete`, { method: 'POST' });
      const d = await r.json();
      if (d.success) { addToast(d.message, 'success'); refreshAll(); }
      else addToast(d.message, 'error');
    } catch { addToast('Network error', 'error'); }
  };

  const statusBadge = (status) => {
    const map = {
      assigned: { cls: 'badge-assigned', label: '🔷 Assigned' },
      completed: { cls: 'badge-completed', label: '✅ Completed' },
      no_driver_available: { cls: 'badge-no-driver', label: '❌ No Driver' },
      pending: { cls: 'badge-no-driver', label: '⏳ Pending' },
    };
    const m = map[status] || { cls: 'badge-no-driver', label: status };
    return <span className={`badge ${m.cls}`}>{m.label}</span>;
  };

  const maxDist = lastRideResult?.allDistances?.length
    ? Math.max(...lastRideResult.allDistances.map(d => d.distance))
    : 1;

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="logo">
            <div className="logo-icon">🚕</div>
            <div>
              <div className="logo-text">CabMatch</div>
              <div className="logo-sub">Smart Ride Assignment</div>
            </div>
          </div>
          <div className="nav-tabs">
            {[
              { id: 'dashboard', label: '📊 Dashboard' },
              { id: 'drivers', label: '👨‍✈️ Drivers' },
              { id: 'rides', label: '🚗 Rides' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                id={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="app-container">
        {/* Hero */}
        <div className="hero">
          <div className="hero-tag">⚡ Real-time Nearest Driver Assignment</div>
          <h1>Cab Assignment System</h1>
          <p>Automatically assigns the nearest available driver using Euclidean distance calculation</p>
        </div>

        {/* Stats Bar */}
        <div className="stats-bar">
          {[
            { icon: '👨‍✈️', value: stats?.totalDrivers ?? '—', label: 'Total Drivers' },
            { icon: '🟢', value: stats?.availableDrivers ?? '—', label: 'Available' },
            { icon: '🚗', value: stats?.totalRides ?? '—', label: 'Total Rides' },
            { icon: '✅', value: stats?.completedRides ?? '—', label: 'Completed' },
            { icon: '🔷', value: stats?.assignedRides ?? '—', label: 'Active Rides' },
          ].map((s, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="main-grid">

          {/* ── Add Driver ── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <div className="card-title-icon icon-purple">👨‍✈️</div>
                Add Driver
              </div>
            </div>
            <form onSubmit={handleAddDriver} id="form-add-driver">
              <div className="form-group">
                <label className="form-label">Driver Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. John Smith"
                  value={driverForm.name}
                  onChange={e => setDriverForm(f => ({ ...f, name: e.target.value }))}
                  id="input-driver-name"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">X Coordinate</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="0–11"
                    min="0" max="11"
                    value={driverForm.x}
                    onChange={e => setDriverForm(f => ({ ...f, x: e.target.value }))}
                    id="input-driver-x"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Y Coordinate</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="0–11"
                    min="0" max="11"
                    value={driverForm.y}
                    onChange={e => setDriverForm(f => ({ ...f, y: e.target.value }))}
                    id="input-driver-y"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading.addDriver}
                id="btn-add-driver"
              >
                {loading.addDriver ? (
                  <span className="loading-dots">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                ) : '+ Add Driver'}
              </button>
            </form>
          </div>

          {/* ── Request Ride ── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <div className="card-title-icon icon-green">🚗</div>
                Request a Ride
              </div>
            </div>
            <form onSubmit={handleRequestRide} id="form-request-ride">
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Sarah"
                  value={rideForm.user_name}
                  onChange={e => setRideForm(f => ({ ...f, user_name: e.target.value }))}
                  id="input-user-name"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Your X</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="0–11"
                    min="0" max="11"
                    value={rideForm.user_x}
                    onChange={e => {
                      setRideForm(f => ({ ...f, user_x: e.target.value }));
                      if (e.target.value !== '' && rideForm.user_y !== '') {
                        setUserPreview({ x: parseFloat(e.target.value), y: parseFloat(rideForm.user_y) });
                      }
                    }}
                    id="input-user-x"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Your Y</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="0–11"
                    min="0" max="11"
                    value={rideForm.user_y}
                    onChange={e => {
                      setRideForm(f => ({ ...f, user_y: e.target.value }));
                      if (rideForm.user_x !== '' && e.target.value !== '') {
                        setUserPreview({ x: parseFloat(rideForm.user_x), y: parseFloat(e.target.value) });
                      }
                    }}
                    id="input-user-y"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-success"
                disabled={loading.requestRide}
                id="btn-request-ride"
              >
                {loading.requestRide ? (
                  <span className="loading-dots">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                ) : '🚕 Find Nearest Driver'}
              </button>
            </form>

            {/* Ride Result */}
            {lastRideResult && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: `1px solid ${lastRideResult.success ? 'var(--success)' : 'var(--danger)'}` }}>
                <div style={{ fontWeight: 700, color: lastRideResult.success ? 'var(--success)' : 'var(--danger)', marginBottom: '0.5rem' }}>
                  {lastRideResult.success ? '✅ Driver Assigned!' : '❌ ' + lastRideResult.message}
                </div>
                {lastRideResult.success && lastRideResult.allDistances && (
                  <>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Distance to all available drivers:</div>
                    <ul className="distance-list">
                      {lastRideResult.allDistances.map((d, i) => (
                        <li key={d.id} className={`distance-item ${i === 0 ? 'nearest' : ''}`}>
                          <span style={{ fontWeight: i === 0 ? 700 : 400 }}>
                            {i === 0 ? '🏆 ' : ''}{d.name}
                          </span>
                          <span style={{ color: i === 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                            {d.distance} units
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Live Map ── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <div className="card-title-icon icon-blue">🗺️</div>
                Live Grid Map
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>🟢 Available</span>
                <span>🔴 Busy</span>
                <span>🟡 You</span>
              </div>
            </div>
            <div className="map-container">
              <MiniMap drivers={drivers} currentUser={userPreview} />
            </div>
          </div>

          {/* ── Drivers List ── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <div className="card-title-icon icon-purple">👥</div>
                Drivers
                <span className="count-badge">{drivers.length}</span>
              </div>
            </div>
            <div className="scrollable">
              {loading.drivers && drivers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <span className="loading-dots"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></span>
                </div>
              ) : drivers.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">👨‍✈️</div><div className="empty-text">No drivers added yet</div></div>
              ) : (
                <ul className="data-list">
                  {drivers.map(d => (
                    <li key={d.id} className="driver-item">
                      <div className="driver-info">
                        <div className="driver-avatar">{d.name[0].toUpperCase()}</div>
                        <div>
                          <div className="driver-name">{d.name}</div>
                          <div className="driver-coords">📍 ({d.x}, {d.y})</div>
                        </div>
                        <span className={`badge ${d.available ? 'badge-available' : 'badge-busy'}`}>
                          {d.available ? '● Available' : '● Busy'}
                        </span>
                      </div>
                      <div className="driver-actions">
                        <button className="btn btn-sm btn-toggle-sm" onClick={() => handleToggleDriver(d.id)} title="Toggle availability" id={`btn-toggle-${d.id}`}>
                          {d.available ? 'Set Busy' : 'Set Free'}
                        </button>
                        <button className="btn btn-sm btn-danger-sm" onClick={() => handleDeleteDriver(d.id, d.name)} id={`btn-delete-driver-${d.id}`}>
                          🗑
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ── Rides History ── */}
          <div className="card full-width">
            <div className="card-header">
              <div className="card-title">
                <div className="card-title-icon icon-amber">🚗</div>
                Rides History
                <span className="count-badge">{rides.length}</span>
              </div>
            </div>
            <div className="scrollable">
              {rides.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🚗</div><div className="empty-text">No rides requested yet</div></div>
              ) : (
                <ul className="data-list">
                  {rides.map(ride => (
                    <li key={ride.id} className="ride-item">
                      <div className="ride-info">
                        <div className="ride-avatar">👤</div>
                        <div style={{ flex: 1 }}>
                          <div className="ride-user">{ride.user_name}</div>
                          <div className="ride-meta">
                            📍 ({ride.user_x}, {ride.user_y})
                            {ride.driver_name && <> &nbsp;→&nbsp; 👨‍✈️ <strong>{ride.driver_name}</strong></>}
                            {ride.distance && <> &nbsp;·&nbsp; {ride.distance} units</>}
                            &nbsp;·&nbsp; {new Date(ride.created_at).toLocaleString()}
                          </div>
                        </div>
                        {statusBadge(ride.status)}
                      </div>
                      <div className="ride-actions">
                        {ride.status === 'assigned' && (
                          <button className="btn btn-sm btn-complete-sm" onClick={() => handleCompleteRide(ride.id)} id={`btn-complete-ride-${ride.id}`}>
                            ✓ Done
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Toast Container */}
      <div className="toast-container" id="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
