import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const STATUS_COLORS = {
  active: '#10b981',
  maintenance: '#f59e0b',
  inactive: '#64748b',
};

const FUEL_ICONS = {
  electric: '⚡',
  hybrid: '🔋',
  diesel: '🛢️',
  gasoline: '⛽',
};

// Normalize lat/lng to 0–100% within the bounding box of all vehicles
function normalizePositions(vehicles) {
  if (!vehicles.length) return [];
  const lats = vehicles.map((v) => parseFloat(v.lat) || 0);
  const lngs = vehicles.map((v) => parseFloat(v.lng) || 0);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;

  return vehicles.map((v) => ({
    ...v,
    x: ((parseFloat(v.lng) - minLng) / lngRange) * 90 + 5, // 5–95%
    y: 95 - ((parseFloat(v.lat) - minLat) / latRange) * 90, // flip y, 5–95%
  }));
}

export default function LiveMapPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [violations, setViolations] = useState([]);

  const fetchPositions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/vehicles/positions/live`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch vehicle positions');
      const data = await res.json();
      setVehicles(data.data || []);
      setLastUpdated(new Date().toLocaleTimeString());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkViolations = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/geofences/check-violations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      setViolations(data.violations || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    checkViolations();
    const posInterval = setInterval(fetchPositions, 30_000);
    const violInterval = setInterval(checkViolations, 60_000);
    return () => {
      clearInterval(posInterval);
      clearInterval(violInterval);
    };
  }, [fetchPositions, checkViolations]);

  const positioned = normalizePositions(vehicles);

  const stats = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === 'active').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    inactive: vehicles.filter((v) => v.status === 'inactive').length,
    withActiveTrips: vehicles.filter((v) => parseInt(v.active_trips) > 0).length,
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Live Fleet Map</h1>
          <p className="page-subtitle">
            Real-time vehicle positions — auto-refreshes every 30 seconds
            {lastUpdated && <span style={{ color: '#10b981', marginLeft: 12 }}>Last updated: {lastUpdated}</span>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { fetchPositions(); checkViolations(); }}>
          Refresh Now
        </button>
      </div>

      {error && <div className="error-banner">{error}<button onClick={() => setError('')}>x</button></div>}

      {/* Geofence violations banner */}
      {violations.length > 0 && (
        <div style={{ background: '#7c3aed', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span><strong>{violations.length} Geofence Violation{violations.length > 1 ? 's' : ''}:</strong>{' '}
            {violations.map((v) => `${v.vehicle_name} in ${v.geofence_name}`).join(', ')}
          </span>
        </div>
      )}

      {/* Fleet stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Vehicles', value: stats.total, color: '#3b82f6' },
          { label: 'Active', value: stats.active, color: '#10b981' },
          { label: 'In Maintenance', value: stats.maintenance, color: '#f59e0b' },
          { label: 'Inactive', value: stats.inactive, color: '#64748b' },
          { label: 'On Trip Now', value: stats.withActiveTrips, color: '#8b5cf6' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#1e293b', padding: 14, borderRadius: 8, borderLeft: `3px solid ${s.color}` }}>
            <div style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 16 }}>
          {/* Map area */}
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid #334155',
            borderRadius: 12,
            minHeight: 520,
            overflow: 'hidden',
          }}>
            {/* Grid lines */}
            {[20, 40, 60, 80].map((pct) => (
              <React.Fragment key={pct}>
                <div style={{ position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, borderLeft: '1px solid #1e293b' }} />
                <div style={{ position: 'absolute', top: `${pct}%`, left: 0, right: 0, borderTop: '1px solid #1e293b' }} />
              </React.Fragment>
            ))}

            {/* Compass */}
            <div style={{ position: 'absolute', top: 12, right: 12, color: '#475569', fontSize: 11, textAlign: 'center' }}>
              <div>N</div>
              <div>↑</div>
            </div>

            {/* Vehicle pins */}
            {positioned.map((vehicle) => {
              const color = STATUS_COLORS[vehicle.status] || '#64748b';
              const isSelected = selected?.id === vehicle.id;
              const hasActiveTrip = parseInt(vehicle.active_trips) > 0;
              return (
                <div
                  key={vehicle.id}
                  onClick={() => setSelected(isSelected ? null : vehicle)}
                  title={`${vehicle.make} ${vehicle.model} (${vehicle.license_plate})`}
                  style={{
                    position: 'absolute',
                    left: `${vehicle.x}%`,
                    top: `${vehicle.y}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer',
                    zIndex: isSelected ? 10 : 5,
                  }}
                >
                  {/* Pulse ring for active trips */}
                  {hasActiveTrip && (
                    <div style={{
                      position: 'absolute',
                      inset: -8,
                      borderRadius: '50%',
                      border: `2px solid ${color}`,
                      opacity: 0.4,
                      animation: 'pulse 2s infinite',
                    }} />
                  )}
                  {/* Pin */}
                  <div style={{
                    width: isSelected ? 36 : 28,
                    height: isSelected ? 36 : 28,
                    borderRadius: '50%',
                    background: color,
                    border: `3px solid ${isSelected ? '#fff' : color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isSelected ? 16 : 12,
                    boxShadow: isSelected ? `0 0 0 3px ${color}40, 0 4px 12px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.4)',
                    transition: 'all 0.2s',
                  }}>
                    {FUEL_ICONS[vehicle.fuel_type] || '🚛'}
                  </div>
                  {/* Label */}
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: 4,
                    background: 'rgba(15,23,42,0.9)',
                    color: '#cbd5e1',
                    fontSize: 10,
                    padding: '2px 5px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                    border: `1px solid ${color}40`,
                  }}>
                    {vehicle.license_plate}
                  </div>
                </div>
              );
            })}

            {positioned.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 48 }}>🗺️</div>
                <div>No vehicle positions available</div>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20, alignSelf: 'start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: '#fff', margin: 0 }}>{selected.make} {selected.model}</h3>
                <button className="btn btn-secondary" onClick={() => setSelected(null)} style={{ padding: '4px 10px', fontSize: 12 }}>✕</button>
              </div>
              {[
                { label: 'License Plate', value: selected.license_plate },
                { label: 'Status', value: selected.status, colored: true },
                { label: 'Fuel Type', value: `${FUEL_ICONS[selected.fuel_type] || ''} ${selected.fuel_type}` },
                { label: 'Driver', value: selected.driver_name || 'Unassigned' },
                { label: 'Active Trips', value: selected.active_trips || 0 },
                { label: 'Latitude', value: parseFloat(selected.lat).toFixed(6) },
                { label: 'Longitude', value: parseFloat(selected.lng).toFixed(6) },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #334155' }}>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>{row.label}</span>
                  <span style={{
                    color: row.colored ? (STATUS_COLORS[row.value] || '#cbd5e1') : '#e2e8f0',
                    fontWeight: row.colored ? 700 : 400,
                    fontSize: 13,
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}

              {/* Geofence violation indicator */}
              {violations.some((v) => v.vehicle_id === selected.id) && (
                <div style={{ marginTop: 12, background: '#7c3aed20', border: '1px solid #7c3aed', borderRadius: 6, padding: '8px 12px', color: '#a78bfa', fontSize: 13 }}>
                  ⚠️ Geofence violation detected
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
            <span style={{ color: '#94a3b8', fontSize: 13, textTransform: 'capitalize' }}>{status}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #10b981', background: 'transparent' }} />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Active trip (pulsing)</span>
        </div>
      </div>
    </div>
  );
}
