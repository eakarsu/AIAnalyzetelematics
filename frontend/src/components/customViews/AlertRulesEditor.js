// Alert Rules Editor — geofence + speed thresholds, full CRUD (add/edit/delete + save).
import React, { useEffect, useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function AlertRulesEditor() {
  const [state, setState] = useState(null);
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(false);
  const [filter, setFilter] = useState('all'); // all | speed | geofence

  const load = () => {
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/custom-views/alert-rules`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setState)
      .catch((e) => setErr(e.message));
  };

  useEffect(load, []);

  const updateRule = (idx, field, value) => {
    setState((s) => {
      const rules = s.rules.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
      return { ...s, rules };
    });
    setSaved(false);
  };

  const toggleChannel = (idx, ch) => {
    setState((s) => {
      const rules = s.rules.map((r, i) => {
        if (i !== idx) return r;
        const has = r.channels.includes(ch);
        return { ...r, channels: has ? r.channels.filter((c) => c !== ch) : [...r.channels, ch] };
      });
      return { ...s, rules };
    });
    setSaved(false);
  };

  const addRule = (kind) => {
    setState((s) => ({
      ...s,
      rules: [
        ...s.rules,
        {
          id: `r${Date.now()}`,
          name: kind === 'geofence' ? 'New geofence rule' : 'New speed rule',
          kind,
          metric: kind === 'geofence' ? 'geofence_exit' : 'speed_mph',
          op: '>',
          threshold: kind === 'geofence' ? 1 : 65,
          severity: 'medium',
          enabled: true,
          channels: ['email'],
        },
      ],
    }));
    setSaved(false);
  };

  const removeRule = (idx) => {
    setState((s) => ({ ...s, rules: s.rules.filter((_, i) => i !== idx) }));
    setSaved(false);
  };

  const save = async () => {
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_BASE}/custom-views/alert-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rules: state.rules }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e.message);
    }
  };

  if (err) return <div style={{ color: '#f87171' }}>Rules error: {err}</div>;
  if (!state) return <div style={{ color: '#94a3b8' }}>Loading alert rules...</div>;

  const inp = { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', padding: '4px 6px', borderRadius: 4, fontSize: 12 };
  const visible = state.rules
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => filter === 'all' || r.kind === filter);

  const kindBadge = (k) => (
    <span style={{
      display: 'inline-block', padding: '2px 6px', borderRadius: 3, fontSize: 10,
      background: k === 'geofence' ? '#312e81' : '#7c2d12',
      color: k === 'geofence' ? '#c7d2fe' : '#fed7aa',
    }}>{k}</span>
  );

  return (
    <div data-testid="alert-rules-editor" style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#f1f5f9' }}>Alert Rules Editor (Geofence + Speed)</h3>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            {state.rules.length} rules — speed: {state.rules.filter((r) => r.kind === 'speed').length}, geofence: {state.rules.filter((r) => r.kind === 'geofence').length}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'speed', 'geofence'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 10px',
              background: filter === f ? '#1d4ed8' : '#1e293b',
              color: '#fff', border: '1px solid ' + (filter === f ? '#3b82f6' : '#334155'),
              borderRadius: 4, cursor: 'pointer', fontSize: 12,
            }}>{f}</button>
          ))}
          <button onClick={() => addRule('speed')}    style={{ padding: '6px 12px', background: '#7c2d12', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer' }}>+ Speed</button>
          <button onClick={() => addRule('geofence')} style={{ padding: '6px 12px', background: '#312e81', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer' }}>+ Geofence</button>
          <button onClick={save} data-testid="alert-rules-save" style={{ padding: '6px 14px', background: '#22c55e', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer' }}>Save</button>
        </div>
      </div>
      {saved && <div style={{ color: '#22c55e', fontSize: 12, marginBottom: 8 }}>Saved.</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#cbd5e1' }}>
          <thead>
            <tr style={{ background: '#1e293b', textAlign: 'left' }}>
              <th style={{ padding: 6 }}>On</th>
              <th style={{ padding: 6 }}>Kind</th>
              <th style={{ padding: 6 }}>Name</th>
              <th style={{ padding: 6 }}>Metric</th>
              <th style={{ padding: 6 }}>Op</th>
              <th style={{ padding: 6 }}>Threshold</th>
              <th style={{ padding: 6 }}>Severity</th>
              <th style={{ padding: 6 }}>Channels</th>
              <th style={{ padding: 6 }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ r, i }) => (
              <tr key={r.id || i} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: 6 }}>
                  <input type="checkbox" checked={r.enabled} onChange={(e) => updateRule(i, 'enabled', e.target.checked)} />
                </td>
                <td style={{ padding: 6 }}>
                  <select value={r.kind} onChange={(e) => updateRule(i, 'kind', e.target.value)} style={inp}>
                    {(state.kinds || ['speed', 'geofence']).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>{' '}{kindBadge(r.kind)}
                </td>
                <td style={{ padding: 6 }}>
                  <input value={r.name} onChange={(e) => updateRule(i, 'name', e.target.value)} style={{ ...inp, width: 200 }} />
                </td>
                <td style={{ padding: 6 }}>
                  <select value={r.metric} onChange={(e) => updateRule(i, 'metric', e.target.value)} style={inp}>
                    {state.metrics.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td style={{ padding: 6 }}>
                  <select value={r.op} onChange={(e) => updateRule(i, 'op', e.target.value)} style={inp}>
                    {state.operators.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td style={{ padding: 6 }}>
                  <input type="number" value={r.threshold} onChange={(e) => updateRule(i, 'threshold', parseFloat(e.target.value))} style={{ ...inp, width: 80 }} />
                </td>
                <td style={{ padding: 6 }}>
                  <select value={r.severity} onChange={(e) => updateRule(i, 'severity', e.target.value)} style={inp}>
                    {state.severities.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: 6 }}>
                  {state.channels.map((c) => (
                    <label key={c} style={{ marginRight: 6, color: r.channels.includes(c) ? '#22c55e' : '#64748b' }}>
                      <input type="checkbox" checked={r.channels.includes(c)} onChange={() => toggleChannel(i, c)} /> {c}
                    </label>
                  ))}
                </td>
                <td style={{ padding: 6 }}>
                  <button onClick={() => removeRule(i)} style={{ background: '#7f1d1d', color: '#fff', border: 0, padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>x</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
