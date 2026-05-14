const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || (data.errors && JSON.stringify(data.errors)) || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),

  // Paginated list — returns { data, pagination }
  getPage: (resource, page = 1, limit = 20) => request(`/${resource}?page=${page}&limit=${limit}`),

  // getAll — fetches up to 100 records. Returns the FULL envelope { data, pagination }
  // CrudPage destructures `.data` from this
  getAll: (resource) => request(`/${resource}?page=1&limit=100`),

  getOne: (resource, id) => request(`/${resource}/${id}`),
  create: (resource, data) => request(`/${resource}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (resource, id, data) => request(`/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (resource, id) => request(`/${resource}/${id}`, { method: 'DELETE' }),

  // Vehicle positions for live map
  vehiclePositions: () => request('/vehicles/positions/live'),

  // Drivers
  driverLeaderboard: () => request('/drivers/leaderboard'),
  expiringLicenses: (days = 60) => request(`/drivers/expiring-licenses?days=${days}`),

  // Alerts
  markAlertRead: (id) => request(`/alerts/${id}/read`, { method: 'PUT' }),
  markAllAlertsRead: () => request('/alerts/bulk/mark-all-read', { method: 'PUT' }),

  // Geofences
  checkGeofenceViolations: () => request('/geofences/check-violations', { method: 'POST' }),

  // Analytics
  carbonFootprint: () => request('/analytics/carbon-footprint'),
  maintenanceTrends: () => request('/analytics/maintenance-trends'),
  costPerMile: () => request('/analytics/cost-per-mile'),
  fleetUtilization: () => request('/analytics/fleet-utilization'),
  fuelStats: () => request('/fuel/stats/summary'),
  tripUtilization: () => request('/trips/stats/fleet-utilization'),

  // AI
  aiOptimizeRoute: () => request('/ai/optimize-route', { method: 'POST' }),
  aiAnalyzeFuel: () => request('/ai/analyze-fuel', { method: 'POST' }),
  aiAnalyzeDrivers: () => request('/ai/analyze-drivers', { method: 'POST' }),
  aiPredictMaintenance: () => request('/ai/predict-maintenance', { method: 'POST' }),
  aiFleetInsights: () => request('/ai/fleet-insights', { method: 'POST' }),
  dashboardStats: () => request('/ai/dashboard-stats'),
  aiHistory: (page = 1, limit = 20) => request(`/ai/history?page=${page}&limit=${limit}`),

  // New AI features
  aiFuelFraud: () => request('/ai/fuel-fraud', { method: 'POST' }),
  aiDriverBurnout: (driver_id) => request('/ai/driver-burnout', {
    method: 'POST',
    body: JSON.stringify(driver_id ? { driver_id } : {}),
  }),
  aiCostPerMileReport: () => request('/ai/cost-per-mile-report', { method: 'POST' }),
  aiFleetSummaryReport: () => request('/ai/fleet-summary-report', { method: 'POST' }),

  // Export CSV (returns raw fetch so caller can trigger download)
  exportCSV: async (resource) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/${resource}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resource}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
