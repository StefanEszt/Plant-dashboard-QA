import { useEffect, useMemo, useState } from "react";
import { getAssets, getTelemetry, getAlarms, sendCommand } from "../api";

type Asset = { id: string; name: string; status?: string };

export default function LiveDemo() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [alarms, setAlarms] = useState<any[]>([]);
  const [cmdStatus, setCmdStatus] = useState("");

  // load fleet once
  useEffect(() => {
    getAssets().then(setAssets);
  }, []);

  // when an asset is selected, start polling its telemetry + alarms
  useEffect(() => {
    if (!selected) return;
    let alive = true;

    const load = async () => {
      const t = await getTelemetry(selected.id, 120);
      const a = await getAlarms(selected.id);
      if (alive) {
        setSeries(t.series ?? []);
        setAlarms(a ?? []);
      }
    };

    load();
    const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [selected?.id]);

  const latest = useMemo(() => series.at(-1), [series]);

  async function doCmd(cmd: string) {
    if (!selected) return;
    const r = await sendCommand(selected.id, cmd, {});
    setCmdStatus(r.status || "");
    setTimeout(() => setCmdStatus(""), 3000);
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1>Live Demo (API connected)</h1>

      {/* Fleet */}
      <section style={{ marginTop: 12 }}>
        <h2>Assets</h2>
        <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
          {assets.map(a => (
            <li key={a.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8 }}>
              <button
                data-testid={`asset-${a.id}`}
                onClick={() => setSelected(a)}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <div style={{ fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>ID: {a.id}</div>
                <div style={{ marginTop: 4 }}>
                  Status: <span style={{ fontWeight: 600 }}>{a.status ?? "—"}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Detail */}
      <section style={{ marginTop: 20 }}>
        <h2>Selected asset</h2>
        {!selected ? (
          <p>Select an asset above.</p>
        ) : (
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
              <div><strong>{selected.name}</strong> <span style={{ opacity: 0.6 }}>({selected.id})</span></div>
              {alarms.length > 0 && (
                <span data-testid="alarm-badge" style={{ padding: "2px 8px", borderRadius: 999, background: "#fee2e2", border: "1px solid #fecaca" }}>
                  {alarms[0].severity}: {alarms[0].type}
                </span>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <div>Latest sample (updates ~5s):</div>
              {latest ? (
                <ul style={{ marginTop: 6 }}>
                  <li><code>ts</code>: {new Date(latest.ts).toLocaleTimeString()}</li>
                  <li><code>moisture</code>: {latest.moisture?.toFixed?.(1)}</li>
                  <li><code>health</code>: {latest.health?.toFixed?.(1)}</li>
                  <li><code>co2</code>: {latest.co2?.toFixed?.(0)}</li>
                </ul>
              ) : (
                <div data-testid="skeleton">Loading…</div>
              )}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={() => doCmd("start")}>Start</button>
              <button onClick={() => doCmd("stop")}>Stop</button>
              <button onClick={() => doCmd("setpoint")}>Setpoint</button>
              {cmdStatus && <div data-testid="cmd-status" style={{ marginLeft: 8 }}>Command: {cmdStatus}</div>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
