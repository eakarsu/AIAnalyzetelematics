const API_BASE = 'http://localhost:3001/api';

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
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),

  // CRUD helpers
  getAll: (resource) => request(`/${resource}`),
  getOne: (resource, id) => request(`/${resource}/${id}`),
  create: (resource, data) => request(`/${resource}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (resource, id, data) => request(`/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (resource, id) => request(`/${resource}/${id}`, { method: 'DELETE' }),

  // AI
  aiOptimizeRoute: () => request('/ai/optimize-route', { method: 'POST' }),
  aiAnalyzeFuel: () => request('/ai/analyze-fuel', { method: 'POST' }),
  aiAnalyzeDrivers: () => request('/ai/analyze-drivers', { method: 'POST' }),
  aiPredictMaintenance: () => request('/ai/predict-maintenance', { method: 'POST' }),
  aiFleetInsights: () => request('/ai/fleet-insights', { method: 'POST' }),
  dashboardStats: () => request('/ai/dashboard-stats'),

  // Alert mark read
  markAlertRead: (id) => request(`/alerts/${id}/read`, { method: 'PUT' }),
};
