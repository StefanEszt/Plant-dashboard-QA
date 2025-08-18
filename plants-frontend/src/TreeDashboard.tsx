import React, { useEffect, useMemo, useState } from "react";
import { Building2 as PlantIcon, MapPin, Download, Play, Square, SlidersHorizontal } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getAssets, getAlarms, getTelemetry, sendCommand } from "./api";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { MapContainer, TileLayer, Popup, CircleMarker } from "react-leaflet";

// Fix Leaflet icons
// @ts-ignore
delete (L.Icon.Default as any).prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

type Asset = { id: string; name: string; lat?: number; lng?: number; status?: string };
type TelemetryPoint = { ts: string; moisture?: number; health?: number; co2?: number };
type Metric = "co2" | "moisture" | "health";
type Tab = "overview" | "alarms" | "trends" | "controls" | "reports";

const COLORS = { ok: "#16a34a", alarm: "#ef4444" };

const TreeDashboard = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [alarmIds, setAlarmIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Asset | null>(null);
  const [series, setSeries] = useState<TelemetryPoint[]>([]);
  const [cmdStatus, setCmdStatus] = useState("");
  const [latestByAsset, setLatestByAsset] = useState<Record<string, TelemetryPoint | undefined>>({});
  const [metric, setMetric] = useState<Metric>("co2");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [alarmDetails, setAlarmDetails] = useState<Record<string, any[]>>({});

  // NEW: live-alarms flag + helper to refresh the alarms list
  const [alarmLive, setAlarmLive] = useState(false);
  async function refreshAlarmDetails(list?: Asset[]) {
    const src = list ?? assets;
    const entries = await Promise.all(
      src.map(async (a) => {
        try {
          const al = await getAlarms(a.id);
        return [a.id, al || []] as const;
        } catch {
          return [a.id, []] as const;
        }
      })
    );
    const map: Record<string, any[]> = {};
    for (const [id, arr] of entries) map[id] = arr;
    setAlarmDetails(map);
  }

  // Fleet status pie
  const statusPie = useMemo(() => {
    const alarms = alarmIds.size;
    const ok = Math.max(assets.length - alarms, 0);
    return [
      { name: "ALARM", value: alarms },
      { name: "OK", value: ok },
    ];
  }, [assets.length, alarmIds]);

  // Top-10 bar by selected metric
  const barData = useMemo(() => {
    return Object.entries(latestByAsset)
      .map(([id, p]) => ({ asset: id, value: (p?.[metric] as number) ?? 0 }))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 10);
  }, [latestByAsset, metric]);

  const metricLabels: Record<Metric, string> = {
    co2: "NOx (ppm)",
    moisture: "Pₑ (MW)",
    health: "Efficiency (%)",
  };

  // 1) Load assets + refresh badges + latest point
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const list: Asset[] = await getAssets();
      if (!alive) return;
      setAssets(list);

      const marks = new Set<string>();
      const latestMap: Record<string, TelemetryPoint | undefined> = {};
      await Promise.all(
        list.map(async (a) => {
          try {
            const [al, t] = await Promise.all([getAlarms(a.id), getTelemetry(a.id, 1)]);
            if (al?.length) marks.add(a.id);
            latestMap[a.id] = t?.series?.[0];
          } catch {}
        })
      );
      if (alive) {
        setAlarmIds(marks);
        setLatestByAsset(latestMap);
        // NEW: if user enabled alarms live mode, keep the list in sync too
        if (alarmLive) {
          await refreshAlarmDetails(list);
        }
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [alarmLive]); // note: depends on alarmLive so poll includes alarm refresh once it's enabled

  // 2) Selected asset -> poll series
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const load = async () => {
      const t = await getTelemetry(selected.id, 120);
      if (alive) setSeries(t?.series ?? []);
    };
    load();
    const h = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, [selected?.id]);

  // (Nice-to-have) refresh alarms once if assets change while live mode is on
  useEffect(() => {
    if (!alarmLive) return;
    refreshAlarmDetails().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmLive, assets.map(a => a.id).join(",")]);

  const latest = useMemo(() => (series.length ? series[series.length - 1] : undefined), [series]);

  async function doCmd(cmd: "start" | "stop" | "setpoint") {
    if (!selected) return;
    await sendCommand(selected.id, cmd, cmd === "setpoint" ? { value: 80 } : {});
    setCmdStatus(cmd === "start" ? "started" : cmd === "stop" ? "stopped" : "setpoint updated");
    setTimeout(() => setCmdStatus(""), 3000);
  }

  // filter
  const [nameQuery, setNameQuery] = useState("");
  const filtered = assets.filter((a) => a.name.toLowerCase().includes(nameQuery.toLowerCase()));

  // Reports: deterministic monthly data + CSV export
  const monthKey = new Date().toISOString().slice(0, 7);
  function seedFrom(str: string) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h || 1;
  }
  function makeRand(seed: number) {
    let x = seed >>> 0;
    return () => {
      x = (1664525 * x + 1013904223) >>> 0;
      return x / 0xffffffff;
    };
  }
  const reportRows = useMemo(() => {
    return assets.map((a) => {
      const base = seedFrom(a.id + ":" + monthKey);
      const r = makeRand(base);
      const energy = 200 + r() * 800;
      const eff = 38 + r() * 4;
      const nox95 = 120 + r() * 60;
      return {
        id: a.id,
        name: a.name,
        energy: Math.round(energy),
        eff: +eff.toFixed(1),
        nox95: Math.round(nox95),
      };
    });
  }, [assets, monthKey]);

  function exportReportsCsv() {
    const headers = ["Plant", "Energy (MWh)", "Avg Eff (%)", "NOx 95th (ppm)"];
    const lines = [headers.join(",")].concat(
      reportRows.map((r) =>
        [
          `"${String(r.name).replace(/"/g, '""')}"`,
          r.energy,
          r.eff,
          r.nox95,
        ].join(",")
      )
    );
    const csv = "\ufeff" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly_report_${monthKey}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(1200px 600px at -10% -10%, #ecfccb 0%, rgba(236,252,203,0) 50%), radial-gradient(1000px 500px at 110% 10%, #dbeafe 0%, rgba(219,234,254,0) 50%), #f8fafc",
      }}
    >
      {/* LEFT: Map with glass panel */}
      <div className="relative flex-1">
        <MapContainer center={[47.4979, 19.0402]} zoom={12} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {filtered.map((a) => {
            const pos: [number, number] =
              a.lat && a.lng
                ? [a.lat, a.lng]
                : [47.4979 + Math.random() * 0.01 - 0.005, 19.0402 + Math.random() * 0.01 - 0.005];
            const inAlarm = alarmIds.has(a.id);
            return (
              <CircleMarker
                key={a.id}
                center={pos}
                radius={selected?.id === a.id ? 11 : 9}
                pathOptions={{
                  color: inAlarm ? COLORS.alarm : COLORS.ok,
                  fillColor: inAlarm ? COLORS.alarm : COLORS.ok,
                  fillOpacity: 0.9,
                  weight: selected?.id === a.id ? 4 : 2,
                }}
                eventHandlers={{ click: () => setSelected(a) }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{a.name}</strong>
                    <br />
                    ID: {a.id}
                    <br />
                    Status:{" "}
                    <span className={inAlarm ? "text-red-600" : "text-green-600"}>
                      {inAlarm ? "ALARM" : a.status ?? "OK"}
                    </span>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Glass legend card */}
        <div className="absolute top-4 left-4 backdrop-blur-xl bg-white/70 border border-white/60 shadow-lg rounded-xl px-3 py-2 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" /> ALARM
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600" /> OK
          </div>
        </div>
      </div>

      {/* RIGHT: Panel */}
      <div className="w-[46%] max-w-[760px] bg-white/80 backdrop-blur-xl border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-sky-500 text-white px-6 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-wide">Power Plant Fleet</h1>
            <input
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Filter by name…"
              className="rounded-lg bg-white/15 placeholder-white/70 focus:bg-white/20 focus:outline-none px-3 py-1.5 text-sm"
            />
          </div>
          {/* Segmented tabs */}
          <div className="mt-4 inline-flex rounded-full bg-white/15 p-1">
            {[
              { id: "overview", label: "Overview" },
              { id: "alarms", label: "Alarms" },
              { id: "trends", label: "Trends" },
              { id: "controls", label: "Controls" },
              { id: "reports", label: "Reports" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as Tab)}
                className={`px-3 py-1.5 text-sm rounded-full transition ${
                  activeTab === t.id ? "bg-white text-emerald-700 shadow" : "text-white/90 hover:text-white"
                }`}
                data-testid={`tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Fleet Status</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={80} label>
                          {statusPie.map((_, i) => (
                            <Cell key={i} fill={["#ef4444", "#16a34a"][i % 2]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-700">Top 10 — {metricLabels[metric]}</h3>
                    <select
                      value={metric}
                      onChange={(e) => setMetric(e.target.value as Metric)}
                      className="text-xs rounded-md border border-slate-300 px-2 py-1"
                    >
                      <option value="co2">NOx (ppm)</option>
                      <option value="moisture">Pₑ (MW)</option>
                      <option value="health">Efficiency (%)</option>
                    </select>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <XAxis dataKey="asset" hide />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-3">Assets</h3>
                <div className="grid gap-3">
                  {filtered.map((a) => {
                    const inAlarm = alarmIds.has(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelected(a)}
                        className="group text-left rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm px-4 py-3"
                        data-testid={`asset-${a.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 group-hover:bg-emerald-100">
                            <PlantIcon size={18} />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-800">{a.name}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin size={14} /> ID: {a.id}
                            </div>
                          </div>
                          {inAlarm ? (
                            <span
                              className="text-[10px] tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200"
                              data-testid={`alarm-chip-${a.id}`}
                            >
                              ALARM
                            </span>
                          ) : (
                            <span className="text-[10px] tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              OK
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && <div className="text-sm text-slate-500">No assets match the filter.</div>}
                </div>
              </div>
            </>
          )}

          {/* ALARMS */}
          {activeTab === "alarms" && (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-700">Active Alarms</h3>
                {!Object.keys(alarmDetails).length && !alarmLive && (
                  <button
                    onClick={async () => {
                      setAlarmLive(true);          // enable continuous syncing
                      await refreshAlarmDetails(); // immediate first load
                    }}
                    className="text-xs rounded-md bg-slate-900 text-white px-3 py-1"
                    data-testid="load-alarms"
                  >
                    Load
                  </button>
                )}
                {Object.keys(alarmDetails).length > 0 && alarmLive && (
                  <div className="text-xs text-slate-500">auto-refresh ~15s</div>
                )}
              </div>

              <div className="space-y-3">
                {assets.map((a) => {
                  const list = alarmDetails[a.id] || [];
                  const inAlarm = alarmIds.has(a.id);
                  return (
                    <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${inAlarm ? "bg-red-500" : "bg-green-600"}`} />
                        <span className="font-medium text-slate-800">{a.name}</span>
                        <span className="text-xs text-slate-500">({a.id})</span>
                      </div>
                      {list.length === 0 ? (
                        <div className="text-xs text-slate-500 mt-2">No active alarms.</div>
                      ) : (
                        <ul className="mt-2 text-sm space-y-1">
                          {list.map((al: any, i: number) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="text-red-600 font-semibold">{al.type}</span>
                              <span className="text-[10px] rounded bg-red-50 border border-red-200 px-2 py-0.5">{al.severity}</span>
                              <span className="text-slate-700">{al.message}</span>
                              <span className="text-slate-400 text-xs">({new Date(al.ts).toLocaleTimeString()})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TRENDS */}
          {activeTab === "trends" && (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                Trends — {selected ? selected.name : "select a plant"}
              </h3>
              {!selected ? (
                <div className="text-sm text-slate-500">Pick a plant from the map or list to view trends (last 120 samples).</div>
              ) : series.length === 0 ? (
                <div className="text-sm text-slate-500">Loading…</div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs font-medium text-slate-600 mb-1">NOx (ppm)</div>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series}>
                          <XAxis dataKey="ts" hide />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="co2" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-600 mb-1">Pₑ (MW)</div>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series}>
                          <XAxis dataKey="ts" hide />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="moisture" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-600 mb-1">Efficiency (%)</div>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series}>
                          <XAxis dataKey="ts" hide />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="health" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONTROLS */}
          {activeTab === "controls" && (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                Controls — {selected ? selected.name : "select a plant"}
              </h3>
              {!selected ? (
                <div className="text-sm text-slate-500">Pick a plant to send commands.</div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => doCmd("start")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm hover:bg-emerald-700"
                  >
                    <Play size={16} /> Start
                  </button>
                  <button
                    onClick={() => doCmd("stop")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 text-white px-3 py-1.5 text-sm hover:bg-slate-900"
                  >
                    <Square size={16} /> Stop
                  </button>
                  <button
                    onClick={() => doCmd("setpoint")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-3 py-1.5 text-sm hover:bg-sky-700"
                  >
                    <SlidersHorizontal size={16} /> Setpoint
                  </button>
                  {cmdStatus && (
                    <div className="text-sm ml-2 text-slate-700" data-testid="cmd-status">
                      Status: {cmdStatus}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* REPORTS */}
          {activeTab === "reports" && (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-700">Reports</h3>
                <button
                  onClick={exportReportsCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm hover:bg-emerald-700"
                  data-testid="export-csv"
                  aria-label="Export monthly CSV"
                >
                  <Download size={16} /> Export CSV
                </button>
              </div>
              <div className="text-xs text-slate-500 mb-2">Monthly summary (demo data) — {monthKey}</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr className="text-slate-600">
                      <th className="px-3 py-2 border border-slate-200 text-left">Plant</th>
                      <th className="px-3 py-2 border border-slate-200 text-right">Energy (MWh)</th>
                      <th className="px-3 py-2 border border-slate-200 text-right">Avg Eff (%)</th>
                      <th className="px-3 py-2 border border-slate-200 text-right">NOx 95th (ppm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r, i) => (
                      <tr key={r.id} className={i % 2 ? "bg-white" : "bg-slate-50/40"}>
                        <td className="px-3 py-2 border border-slate-200">{r.name}</td>
                        <td className="px-3 py-2 border border-slate-200 text-right">{r.energy}</td>
                        <td className="px-3 py-2 border border-slate-200 text-right">{r.eff}</td>
                        <td className="px-3 py-2 border border-slate-200 text-right">{r.nox95}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DETAIL */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Selected Plant</h3>
            {!selected ? (
              <div className="text-sm text-slate-500">Select a plant from the list or map.</div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{selected.name}</span>
                  {alarmIds.has(selected.id) && (
                    <span className="text-[10px] tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200" data-testid="alarm-badge">
                      ALARM
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600">ID: {selected.id}</div>
                <div>
                  <div className="text-xs text-slate-500">Latest sample (auto-refresh ~5s):</div>
                  {latest ? (
                    <ul className="mt-1 text-sm text-slate-800">
                      <li>
                        <code>Timestamp</code>: {new Date(latest.ts).toLocaleTimeString()}
                      </li>
                      <li>
                        <code>Pₑ (MW)</code>: {latest.moisture?.toFixed?.(2)}
                      </li>
                      <li>
                        <code>Efficiency (%)</code>: {latest.health?.toFixed?.(1)}
                      </li>
                      <li>
                        <code>NOx (ppm)</code>: {latest.co2?.toFixed?.(0)}
                      </li>
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-500" data-testid="skeleton">
                      Loading…
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreeDashboard;
