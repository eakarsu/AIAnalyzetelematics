// Vehicle Route Map — leaflet polyline + stops for a vehicle's trip.
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Fix default marker icons under webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [25, 25] });
  }, [map, points]);
  return null;
}

export default function VehicleRouteMap() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [vehicleId, setVehicleId] = useState(1);

  const load = (id) => {
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/custom-views/vehicle-route-map?vehicle_id=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setErr(e.message));
  };

  useEffect(() => { load(vehicleId); /* eslint-disable-next-line */ }, [vehicleId]);

  if (err) return <div style={{ color: '#f87171' }}>Map error: {err}</div>;
  if (!data) return <div style={{ color: '#94a3b8' }}>Loading vehicle route map...</div>;

  const polylinePoints = data.waypoints.map((w) => [w.lat, w.lng]);
  const startEnd = [data.stops[0], data.stops[data.stops.length - 1]];

  return (
    <div data-testid="vehicle-route-map" style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#f1f5f9' }}>Vehicle Route Map</h3>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            {data.vehicle.license_plate} — {data.vehicle.model} — {data.distance_mi} mi, {data.duration_min} min, avg {data.avg_speed_mph} mph
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ color: '#cbd5e1', fontSize: 13 }}>Vehicle ID:</label>
          <input
            type="number"
            value={vehicleId}
            onChange={(e) => setVehicleId(parseInt(e.target.value, 10) || 1)}
            style={{ width: 70, padding: '4px 6px', background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 4 }}
          />
        </div>
      </div>

      <div style={{ height: 460, borderRadius: 8, overflow: 'hidden', border: '1px solid #1e293b' }}>
        <MapContainer center={[data.center.lat, data.center.lng]} zoom={data.zoom} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          <Polyline positions={polylinePoints} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.85 }} />
          {data.waypoints.map((w, i) => (
            (i % 4 === 0) && (
              <CircleMarker key={w.seq} center={[w.lat, w.lng]} radius={3} pathOptions={{ color: '#60a5fa', fillOpacity: 0.9 }}>
                <Popup>seq {w.seq} — {w.speed_mph} mph</Popup>
              </CircleMarker>
            )
          ))}
          {data.stops.map((s, i) => (
            <Marker key={i} position={[s.lat, s.lng]}>
              <Popup><strong>{s.label}</strong><br />{s.kind}</Popup>
            </Marker>
          ))}
          <FitBounds points={polylinePoints} />
        </MapContainer>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: '#cbd5e1', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span><strong>Stops:</strong></span>
        {data.stops.map((s, i) => (
          <span key={i}>{s.label} ({s.lat.toFixed(3)}, {s.lng.toFixed(3)})</span>
        ))}
        <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>max speed {data.max_speed_mph} mph</span>
      </div>
    </div>
  );
}
