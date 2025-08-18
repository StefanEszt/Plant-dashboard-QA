const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export const getAssets = () =>
  fetch(`${BASE}/assets`).then(r => r.json());

export const getTelemetry = (id: string, limit = 200) =>
  fetch(`${BASE}/telemetry?asset=${id}&limit=${limit}`).then(r => r.json());

export const getAlarms = (id: string) =>
  fetch(`${BASE}/alarms?asset=${id}`).then(r => r.json());

export const sendCommand = (id: string, cmd: string, params: any = {}) =>
  fetch(`${BASE}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: 'tester', asset_id: id, cmd, params })
  }).then(r => r.json());
