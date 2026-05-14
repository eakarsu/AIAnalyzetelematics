import React, { useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function RenderValue({ value }) {
  if (value === null || value === undefined) return <span style={{ color: '#94a3b8' }}>—</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: '#94a3b8' }}>(empty)</span>;
    if (typeof value[0] === 'object') {
      const cols = Object.keys(value[0]);
      return (
        <table style={tbl}>
          <thead><tr>{cols.map((c) => <th key={c} style={th}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
          <tbody>
            {value.map((row, i) => (
              <tr key={i}>{cols.map((c) => <td key={c} style={td}><RenderValue value={row[c]} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      );
    }
    return <ul style={{ margin: 0 }}>{value.map((v, i) => <li key={i}><RenderValue value={v} /></li>)}</ul>;
  }

  if (typeof value === 'object') {
    return (
      <div style={{ paddingLeft: 12, borderLeft: '2px solid #334155' }}>
        {Object.entries(value).map(([k, v]) => (
          <div key={k} style={{ marginBottom: 4 }}>
            <strong style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}: </strong>
            <RenderValue value={v} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'boolean') return <span style={{ color: value ? '#22c55e' : '#ef4444' }}>{value ? 'Yes' : 'No'}</span>;
  return <span>{String(value)}</span>;
}

export default function AIStructuredPage({ endpoint, title, description, body = null, formFields = null }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => {
    const init = {};
    if (formFields) formFields.forEach((f) => { init[f.name] = f.default || ''; });
    return init;
  });

  const run = async (e) => {
    e?.preventDefault?.();
    setLoading(true); setError(''); setResult(null);
    try {
      const reqBody = body || (formFields ? Object.fromEntries(formFields.map((f) => {
        const v = form[f.name];
        if (f.type === 'number') return [f.name, Number(v)];
        if (f.type === 'json') {
          try { return [f.name, JSON.parse(v)]; } catch { return [f.name, v]; }
        }
        return [f.name, v];
      })) : {});

      const res = await fetch(`${API_BASE}/ai/${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (data.errors && JSON.stringify(data.errors)) || 'Request failed');
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="page-subtitle">{description}</p>
        </div>
        {!formFields && (
          <button className="btn btn-ai" onClick={run} disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Running...</> : <>🤖 Run Analysis</>}
          </button>
        )}
      </div>

      {formFields && (
        <form onSubmit={run} style={{ display: 'grid', gap: 12, maxWidth: 700, marginBottom: 20, padding: 16, background: '#1e293b', borderRadius: 8 }}>
          {formFields.map((f) => (
            <div key={f.name}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, marginBottom: 4 }}>{f.label}{f.required && ' *'}</label>
              {f.type === 'textarea' || f.type === 'json' ? (
                <textarea
                  value={form[f.name] || ''}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  required={f.required}
                  placeholder={f.placeholder}
                  style={{ ...inp, minHeight: 80, resize: 'vertical', fontFamily: f.type === 'json' ? 'monospace' : 'inherit' }}
                />
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={form[f.name] || ''}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  required={f.required}
                  placeholder={f.placeholder}
                  style={inp}
                />
              )}
            </div>
          ))}
          <button type="submit" className="btn btn-ai" disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Running...</> : <>🤖 Run Analysis</>}
          </button>
        </form>
      )}

      {error && <div className="error-banner">{error}<button onClick={() => setError('')}>x</button></div>}

      {loading && (
        <div className="ai-loading">
          <div className="ai-loading-animation">
            <div className="ai-pulse" />
            <div className="ai-pulse delay-1" />
            <div className="ai-pulse delay-2" />
          </div>
          <h3>AI is analyzing your fleet data...</h3>
        </div>
      )}

      {result && (
        <div className="ai-result">
          <div className="ai-result-body" style={{ padding: 20 }}>
            {result.raw_response ? (
              <pre style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw_response}</pre>
            ) : (
              <RenderValue value={result} />
            )}
          </div>
        </div>
      )}

      {!result && !loading && !formFields && (
        <div className="ai-empty">
          <div className="ai-empty-icon">🤖</div>
          <h3>Ready to Analyze</h3>
          <p>{description}</p>
        </div>
      )}
    </div>
  );
}

const inp = { width: '100%', padding: 10, borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 14, boxSizing: 'border-box' };
const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th = { textAlign: 'left', padding: 8, background: '#1e293b', color: '#94a3b8', textTransform: 'uppercase', fontSize: 11, borderBottom: '1px solid #334155' };
const td = { padding: 8, borderBottom: '1px solid #1e293b', color: '#cbd5e1', verticalAlign: 'top' };
