import React, { useEffect, useState, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
}

export default function AIHistoryPage() {
  const [items, setItems] = useState([]);
  const [pag, setPag] = useState({ page: 1, total_pages: 1, total: 0, limit: 20 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/ai/history?page=${page}&limit=20`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setItems(data.data || []);
      setPag(data.pagination || { page: 1, total_pages: 1, total: 0, limit: 20 });
    } catch (err) { setError(err.message); }
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>AI Analysis History</h1>
          <p className="page-subtitle">Past AI runs by you with input + output.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}<button onClick={() => setError('')}>x</button></div>}

      {loading ? <div className="ai-loading"><h3>Loading...</h3></div> : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th style={th}>Type</th>
                <th style={th}>Created</th>
                <th style={th}>Input Summary</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} onClick={() => setSelected(it)} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b' }}>
                  <td style={td}><strong>{it.analysis_type}</strong></td>
                  <td style={td}>{new Date(it.created_at).toLocaleString()}</td>
                  <td style={{ ...td, color: '#94a3b8', fontSize: 12 }}>
                    {typeof it.input_data === 'string' ? it.input_data : JSON.stringify(it.input_data)}
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={3} style={td}>No analyses yet.</td></tr>}
            </tbody>
          </table>

          {pag.total_pages > 1 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, justifyContent: 'center' }}>
              <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
              <span style={{ color: '#cbd5e1' }}>Page {pag.page} of {pag.total_pages} ({pag.total} total)</span>
              <button className="btn" onClick={() => setPage((p) => Math.min(pag.total_pages, p + 1))} disabled={page >= pag.total_pages}>Next</button>
            </div>
          )}
        </>
      )}

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#0f172a', padding: 24, borderRadius: 8, maxWidth: 800, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <h2 style={{ color: '#fff' }}>{selected.analysis_type}</h2>
            <h4 style={{ color: '#94a3b8' }}>Input</h4>
            <pre style={{ color: '#cbd5e1', fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selected.input_data, null, 2)}</pre>
            <h4 style={{ color: '#94a3b8' }}>Result</h4>
            <pre style={{ color: '#cbd5e1', fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selected.result, null, 2)}</pre>
            <button className="btn" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { textAlign: 'left', padding: 10, color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' };
const td = { padding: 12, color: '#cbd5e1' };
