const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/**
 * ASSETS (3 demo plants)
 */
const assets = [
  { id: "pp-001", name: "District Heat CHP – Budapest", lat: 47.4979, lng: 19.0402, status: "OK" },
  { id: "pp-002", name: "Combined Cycle Plant – Vienna", lat: 48.2082, lng: 16.3738, status: "OK" },
  { id: "pp-003", name: "Peaking Gas Engine – Graz",  lat: 47.0707, lng: 15.4395, status: "OK" }
];

/**
 * Telemetry store (in memory): { "pp-001": [ { ts, moisture, health, co2 }, ... ], ... }
 * We reinterpret:
 *  - moisture -> Pₑ (MW)
 *  - health   -> Efficiency (%)
 *  - co2      -> NOx (ppm)
 */
const telemetry = Object.fromEntries(assets.map(a => [a.id, []]));

// Simulation base per plant (roughly like your Node-RED flow)
const plants = {
  "pp-001": { type: "CHP",    peBase: 2.8, peJitter: 0.25, effBase: 44, effJ: 1.5, noxBase: 175, noxJ: 20 },
  "pp-002": { type: "CCGT",   peBase: 5.2, peJitter: 0.30, effBase: 50, effJ: 2.0, noxBase: 140, noxJ: 25 },
  "pp-003": { type: "Peaker", peBase: 0.3, peJitter: 0.30, effBase: 35, effJ: 2.5, noxBase: 160, noxJ: 30 }
};

// push one sample per plant every 2s (keep last ~500)
setInterval(() => {
  const now = new Date().toISOString();

  for (const a of assets) {
    const p = plants[a.id];
    if (!p) continue;

    let pe  = p.peBase + (Math.random() * 2 - 1) * p.peJitter;
    if (p.type === "Peaker") pe = Math.max(0, pe);

    const eff = p.effBase + (Math.random() * 2 - 1) * p.effJ;
    const nox = p.noxBase + (Math.random() * 2 - 1) * p.noxJ;

    const point = { ts: now, moisture: pe, health: eff, co2: nox };
    const arr = telemetry[a.id];
    arr.push(point);
    if (arr.length > 500) arr.shift();
  }
}, 2000);

// simple alarm computation based on latest sample
function computeAlarms(assetId) {
  const arr = telemetry[assetId] || [];
  const last = arr[arr.length - 1];
  if (!last) return [];

  const alarms = [];
  // demo thresholds:
  if (last.co2 >= 180) {
    alarms.push({ ts: last.ts, type: "NOX_HIGH", severity: "MEDIUM", message: "NOx above 180 ppm" });
  }
  if (last.health <= 40) {
    alarms.push({ ts: last.ts, type: "EFFICIENCY_LOW", severity: "LOW", message: "Efficiency below 40%" });
  }
  return alarms;
}

/** ROUTES **/

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/assets", (_req, res) => {
  res.json(assets);
});

app.get("/telemetry", (req, res) => {
  const assetId = req.query.asset;
  const limit = Math.max(1, Math.min(10000, parseInt(req.query.limit, 10) || 200));
  if (!assetId) return res.status(400).json({ error: "asset is required" });

  const series = (telemetry[assetId] || []).slice(-limit);
  res.json({ assetId, series });
});

app.get("/alarms", (req, res) => {
  const assetId = req.query.asset;
  if (!assetId) return res.status(400).json({ error: "asset is required" });

  const alarms = computeAlarms(assetId);
  res.json(alarms);
});

app.post("/commands", (req, res) => {
  const { asset_id, cmd } = req.body || {};
  if (!asset_id || !cmd) return res.status(400).json({ error: "asset_id and cmd are required" });

  // Just echo a friendly status string your UI expects
  let status = "ack";
  if (cmd === "start") status = "started";
  else if (cmd === "stop") status = "stopped";
  else if (cmd === "setpoint") status = "setpoint updated";

  return res.json({ status });
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Mock API listening on http://localhost:${PORT}`);
});
