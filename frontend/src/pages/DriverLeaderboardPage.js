import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const BADGE_COLORS = { gold: '#f59e0b', silver: '#94a3b8', bronze: '#b45309' };
const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed' };

export default function DriverLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [loadingExpiring, setLoadingExpiring] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.driverLeaderboard()
      .then((d) => setLeaderboard(d.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingLeaderboard(false));

    api.expiringLicenses(90)
      .then((d) => setExpiring(d.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingExpiring(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Driver Leaderboard</h1>
          <p className="page-subtitle">Ranked by composite safety score. Gamified to drive real behavioral change.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}<button onClick={() => setError('')}>x</button></div>}

      {/* Leaderboard Table */}
      <div className="section-header" style={{ marginTop: 0 }}>
        <h2>Safety Champions</h2>
        <p>Composite score = safety 50% + trip volume 30% + incident-free record 20%</p>
      </div>

      {loadingLeaderboard ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Driver</th>
                <th>Safety Score</th>
                <th>Composite Score</th>
                <th>Trips (30d)</th>
                <th>Safety Events (30d)</th>
                <th>License Expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((d) => (
                <tr key={d.id} className="table-row">
                  <td style={{ fontWeight: 700, fontSize: 18 }}>
                    {d.badge ? (
                      <span style={{ color: BADGE_COLORS[d.badge] }}>
                        {d.rank === 1 ? '🥇' : d.rank === 2 ? '🥈' : '🥉'} {d.rank}
                      </span>
                    ) : `#${d.rank}`}
                  </td>
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 8, background: '#334155', borderRadius: 4, overflow: 'hidden', maxWidth: 80 }}>
                        <div style={{ width: `${d.safety_score}%`, height: '100%', background: d.safety_score >= 90 ? '#10b981' : d.safety_score >= 70 ? '#f59e0b' : '#ef4444', borderRadius: 4 }} />
                      </div>
                      <span>{Number(d.safety_score).toFixed(1)}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: '#3b82f6' }}>{Number(d.composite_score).toFixed(1)}</td>
                  <td>{d.trips_30d}</td>
                  <td>
                    <span style={{ color: d.safety_events_30d > 0 ? '#ef4444' : '#10b981' }}>
                      {d.safety_events_30d}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: d.license_expiring_soon ? '#f59e0b' : '#cbd5e1', fontWeight: d.license_expiring_soon ? 700 : 400 }}>
                      {d.license_expiry ? new Date(d.license_expiry).toLocaleDateString() : '—'}
                      {d.license_expiring_soon && ' ⚠️'}
                    </span>
                  </td>
                  <td><span className={`badge badge-${d.status === 'active' ? 'active' : 'inactive'}`}>{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expiring Licenses Section */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <h2>License Expiry Alert — Next 90 Days</h2>
        <p>Drivers with licenses expiring soon</p>
      </div>

      {loadingExpiring ? (
        <div className="loading"><div className="spinner" /></div>
      ) : expiring.length === 0 ? (
        <div className="ai-empty">
          <div className="ai-empty-icon">✅</div>
          <h3>No licenses expiring in the next 90 days</h3>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Email</th>
                <th>License #</th>
                <th>Expiry Date</th>
                <th>Days Remaining</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((d) => (
                <tr key={d.id} className="table-row">
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td style={{ color: '#94a3b8' }}>{d.email}</td>
                  <td>{d.license_number}</td>
                  <td>{new Date(d.license_expiry).toLocaleDateString()}</td>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      color: d.days_until_expiry <= 30 ? '#ef4444' : d.days_until_expiry <= 60 ? '#f59e0b' : '#10b981'
                    }}>
                      {d.days_until_expiry} days
                    </span>
                  </td>
                  <td><span className={`badge badge-${d.status === 'active' ? 'active' : 'inactive'}`}>{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
