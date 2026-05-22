import React, { useEffect, useState } from 'react';

export default function EldHoursViolationMonitor() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/eld-hours-violation-monitor')
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className="page">
      <h1>ELD Hours Violation Monitor</h1>
      <p>Detect driver hours-of-service risk before dispatch creates a compliance violation.</p>
      <div className="stats-grid">
        {data && Object.entries(data.summary).map(([key, value]) => (
          <div className="stat-card" key={key}>
            <span>{key.replaceAll('_', ' ')}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="card">
        {(data?.drivers || []).map((driver) => (
          <div key={driver.driver} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid #e5e7eb' }}>
            <strong>{driver.driver}</strong>
            <span>{driver.risk} risk - {driver.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
