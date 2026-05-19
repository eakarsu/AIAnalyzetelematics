// Trip Log CSV Export — fetches preview JSON, then downloads CSV file.
import React, { useEffect, useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function TripLogCSVExport() {
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState(null);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);

  const loadPreview = async (lim) => {
    setLoading(true);
    setErr(null);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_BASE}/custom-views/trip-log-csv?format=json&limit=${lim}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setMeta(j);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPreview(limit); /* eslint-disable-next-line */ }, []);

  const download = () => {
    if (!meta) return;
    const blob = new Blob([meta.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-testid="trip-log-csv-export" style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #1e293b' }}>
      <h3 style={{ marginTop: 0, color: '#f1f5f9' }}>Trip Log CSV Export</h3>
      <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 0 }}>
        Export trip logs (vehicle, driver, distance, fuel, speeds, status) as CSV for spreadsheets / BI tools.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ color: '#cbd5e1', fontSize: 13 }}>Rows:</label>
        <input
          type="number"
          min="1"
          max="1000"
          value={limit}
          onChange={(e) => setLimit(Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 100)))}
          style={{ width: 90, padding: '6px 8px', background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 4 }}
        />
        <button
          onClick={() => loadPreview(limit)}
          disabled={loading}
          style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer' }}
        >
          {loading ? 'Loading...' : 'Refresh Preview'}
        </button>
        {meta && (
          <button
            onClick={download}
            data-testid="csv-download-btn"
            style={{ padding: '6px 14px', background: '#22c55e', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer' }}
          >
            Download {meta.filename}
          </button>
        )}
        {meta && <span style={{ color: '#94a3b8', fontSize: 12 }}>{meta.count} rows — {meta.bytes} bytes</span>}
      </div>

      {err && <div style={{ color: '#f87171', fontSize: 13 }}>{err}</div>}

      {meta && (
        <div style={{ overflowX: 'auto', background: '#020617', borderRadius: 8, border: '1px solid #1e293b' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#cbd5e1' }}>
            <thead>
              <tr style={{ background: '#1e293b', textAlign: 'left' }}>
                {meta.headers.map((h) => (
                  <th key={h} style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meta.preview.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '4px 8px' }}>{t.id}</td>
                  <td style={{ padding: '4px 8px' }}>{t.vehicle_id}</td>
                  <td style={{ padding: '4px 8px' }}>{t.license_plate || ''}</td>
                  <td style={{ padding: '4px 8px' }}>{t.driver_id}</td>
                  <td style={{ padding: '4px 8px' }}>{t.driver_name || ''}</td>
                  <td style={{ padding: '4px 8px' }}>{(t.start_time || '').replace('T', ' ').slice(0, 16)}</td>
                  <td style={{ padding: '4px 8px' }}>{(t.end_time || '').replace('T', ' ').slice(0, 16)}</td>
                  <td style={{ padding: '4px 8px' }}>{t.distance_miles}</td>
                  <td style={{ padding: '4px 8px' }}>{t.fuel_used}</td>
                  <td style={{ padding: '4px 8px' }}>{t.avg_speed}</td>
                  <td style={{ padding: '4px 8px' }}>{t.max_speed}</td>
                  <td style={{ padding: '4px 8px' }}>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
