import React, { useState } from 'react';
import VehicleRouteMap from '../components/customViews/VehicleRouteMap';
import DriverScoreBarChart from '../components/customViews/DriverScoreBarChart';
import TripLogCSVExport from '../components/customViews/TripLogCSVExport';
import AlertRulesEditor from '../components/customViews/AlertRulesEditor';

const TABS = [
  { id: 'route',  label: 'Vehicle Route Map',     kind: 'viz'  },
  { id: 'scores', label: 'Driver Score Bar Chart',kind: 'viz'  },
  { id: 'csv',    label: 'Trip Log CSV Export',   kind: 'tool' },
  { id: 'rules',  label: 'Alert Rules Editor',    kind: 'tool' },
];

export default function CustomViewsPage() {
  const [tab, setTab] = useState('route');

  return (
    <div data-testid="custom-views-page" style={{ padding: 24, color: '#f1f5f9', minHeight: '100vh', background: '#020617' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Fleet Views — Telematics Custom Analytics</h1>
        <p style={{ color: '#94a3b8', marginTop: 6, fontSize: 14 }}>
          Four custom views for fleet telematics: 2 visualizations (route map, driver scores) and 2 operational tools (CSV export, alert rules CRUD).
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`tab-${t.id}`}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: tab === t.id ? '1px solid #3b82f6' : '1px solid #334155',
              background: tab === t.id ? '#1e3a8a' : '#1e293b',
              color: '#f1f5f9',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <span style={{ marginRight: 6, color: t.kind === 'viz' ? '#60a5fa' : '#fbbf24' }}>{t.kind === 'viz' ? '[viz]' : '[tool]'}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'route'  && <VehicleRouteMap />}
        {tab === 'scores' && <DriverScoreBarChart />}
        {tab === 'csv'    && <TripLogCSVExport />}
        {tab === 'rules'  && <AlertRulesEditor />}
      </div>
    </div>
  );
}
