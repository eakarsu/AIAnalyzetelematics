import AIFieldPresets, { completeExample } from './AIFieldPresets';
import useCancelableAI from './useCancelableAI';
import ReadableAIReport from "./AIResultView";
import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}



export default function AIStructuredPage({ endpoint, title, description, body = null, formFields = null }) {
  const [form, setForm] = useState(() => Object.fromEntries((formFields || []).map((field) => [field.name, field.default ?? ''])));
  const [references, setReferences] = useState({});
  const [referenceError, setReferenceError] = useState('');
  const aiRequest = useCancelableAI();
  const fields = (formFields || []).map((field) => field.name === 'vehicle_id' || field.name === 'driver_id' ? { ...field, type: 'select', requiresExistingRecord: true, options: (references[field.name] || []).map((row) => ({ value: String(row.id), label: row.name || row.license_plate || [row.make, row.model].filter(Boolean).join(' ') || String(row.id) })) } : field);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    aiRequest.cancel(); aiRequest.setResult(null); aiRequest.setError(null);
    setForm(Object.fromEntries((formFields || []).map((field) => [field.name, field.default ?? '']))); setReferences({}); setReferenceError('');
    for (const field of formFields || []) {
      const resource = field.name === 'vehicle_id' ? 'vehicles' : field.name === 'driver_id' ? 'drivers' : null;
      if (!resource) continue;
      fetch(API_BASE + '/' + resource + '?limit=100', { headers: getHeaders(), signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error('Saved records unavailable'); return data.data || data.items || data; }).then((rows) => { if (active) setReferences((previous) => ({ ...previous, [field.name]: Array.isArray(rows) ? rows : [] })); }).catch((error) => { if (active && error.name !== 'AbortError') setReferenceError('Saved record references could not be loaded. Check your connection.'); });
    }
    return () => { active = false; controller.abort(); };
    // eslint-disable-next-line
  }, [endpoint]);
  const run = async (event) => {
    event?.preventDefault?.();
    return aiRequest.run(async (options) => {
      const payload = body || Object.fromEntries((formFields || []).map((field) => {
        const value = form[field.name];
        if (field.required && (value === undefined || value === '')) throw new Error(field.label + ' is required.');
        if (field.type === 'number') return [field.name, value === '' || value === undefined ? undefined : Number(value)];
        if (field.type === 'json' && value) { try { return [field.name, typeof value === 'string' ? JSON.parse(value) : value]; } catch (_) { throw new Error(field.label + ': enter valid structured data.'); } }
        return [field.name, value];
      }));
      const response = await fetch(API_BASE + '/ai/' + endpoint, { ...options, method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.errors?.map?.((item) => item.msg).join(', ') || 'AI request failed');
      return data;
    });
  };
  return <div className="page sr-ai-workspace"><div className="page-header"><div><h1>{title}</h1><p className="page-subtitle">{description}</p></div>{!formFields && <div className="sr-actions"><button type="button" className="btn btn-ai" onClick={run} disabled={aiRequest.loading}>{aiRequest.loading ? 'Preparing report…' : 'Generate with OpenRouter'}</button>{aiRequest.loading && <button type="button" className="btn" onClick={aiRequest.cancel}>Cancel</button>}</div>}</div>{formFields && <form onSubmit={run} className="card" style={{ padding: 20, marginBottom: 20 }}><AIFieldPresets fields={fields} context={title} disabled={aiRequest.loading} onFill={(sample, index) => { setForm(completeExample(fields, sample, index, title, form)); aiRequest.setResult(null); }} />{referenceError && <p className="sr-notice" role="status">{referenceError}</p>}<div className="form-grid">{fields.map((field) => <div className="form-group" key={field.name}><label htmlFor={'structured-' + field.name}>{field.label}<span className="muted">{field.required ? ' · Required' : ' · Optional'}</span></label>{field.type === 'select' ? <select id={'structured-' + field.name} value={form[field.name] ?? ''} required={field.required} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}><option value="">Select a saved record…</option>{(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' || field.type === 'json' ? <textarea id={'structured-' + field.name} rows={5} value={form[field.name] ?? ''} required={field.required} placeholder={field.placeholder} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} /> : <input id={'structured-' + field.name} type={field.type || 'text'} value={form[field.name] ?? ''} required={field.required} placeholder={field.placeholder} min={field.min} max={field.max} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} />}</div>)}</div><div className="sr-actions"><button type="submit" className="btn btn-ai" disabled={aiRequest.loading}>{aiRequest.loading ? 'Preparing report…' : 'Generate with OpenRouter'}</button>{aiRequest.loading && <button type="button" className="btn" onClick={aiRequest.cancel}>Cancel</button>}</div></form>}{aiRequest.notice && <p className="sr-notice" role="status">{aiRequest.notice}</p>}<ReadableAIReport result={aiRequest.result} loading={aiRequest.loading} error={aiRequest.error} title={title} />{!formFields && !aiRequest.result && !aiRequest.loading && <div className="ai-empty"><h3>Ready to analyze saved fleet records</h3><p>{description}</p></div>}</div>;
}

const inp = { width: '100%', padding: 10, borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 14, boxSizing: 'border-box' };
const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th = { textAlign: 'left', padding: 8, background: '#1e293b', color: '#94a3b8', textTransform: 'uppercase', fontSize: 11, borderBottom: '1px solid #334155' };
const td = { padding: 8, borderBottom: '1px solid #1e293b', color: '#cbd5e1', verticalAlign: 'top' };
