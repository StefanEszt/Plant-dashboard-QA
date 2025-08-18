import os, uuid, datetime as dt, sqlite3, json
from typing import Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")
NODE_RED_URL = os.getenv("NODE_RED_URL", "http://sim:1880")

app = FastAPI(title="Myplant-like Demo API (Local Realistic Stack)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- DB ----------
def db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            lat REAL,
            lng REAL,
            status TEXT DEFAULT 'OK'
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            moisture REAL,  -- reinterpret as electrical power (MW)
            health REAL,    -- reinterpret as efficiency (%)
            co2 REAL,       -- reinterpret as NOx (ppm)
            FOREIGN KEY(asset_id) REFERENCES assets(id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS commands (
            id TEXT PRIMARY KEY,
            user_name TEXT,
            asset_id TEXT,
            cmd TEXT,
            params TEXT,
            requested_ts TEXT,
            status TEXT,
            note TEXT
        )
    """)
    # Seed 3 demo power plants
    cur.executemany(
        "INSERT OR IGNORE INTO assets(id, name, lat, lng, status) VALUES (?,?,?,?,?)",
        [
            ("pp-001", "Jenbacher CHP – Vienna", 48.2082, 16.3738, "OK"),
            ("pp-002", "District Heat CHP – Budapest", 47.4979, 19.0402, "OK"),
            ("pp-003", "Peaking Gas Engine – Graz", 47.0707, 15.4395, "OK"),
        ],
    )
    conn.commit()
    conn.close()

init_db()

# ---------- Endpoints ----------
@app.get("/health")
def health():
    return {"ok": True}

@app.get("/assets")
def get_assets():
    conn = db()
    rows = conn.execute("SELECT id, name, lat, lng, status FROM assets ORDER BY id").fetchall()
    return [dict(r) for r in rows]

@app.get("/telemetry")
def get_telemetry(asset: str = Query(...), limit: int = Query(200, ge=1, le=10000)):
    conn = db()
    rows = conn.execute(
        "SELECT ts, moisture, health, co2 FROM telemetry WHERE asset_id=? ORDER BY ts DESC LIMIT ?",
        (asset, limit),
    ).fetchall()
    series = [dict(r) for r in rows][::-1]  # chronological
    return {"assetId": asset, "series": series}

@app.get("/alarms")
def get_alarms(asset: str = Query(...)):
    """
    Power-plant alarm rules (reinterpreting columns):
      moisture -> electrical power P_e (MW)
      health   -> electrical efficiency η_e (%)
      co2      -> NOx (ppm)
    Rules:
      - POWER_LOW:     P_e < 0.5 MW         (HIGH)
      - EFFICIENCY_LOW:η_e < 38%            (MEDIUM)
      - NOX_HIGH:      NOx > 180 ppm        (MEDIUM)
    """
    conn = db()
    row = conn.execute(
        "SELECT ts, moisture, health, co2 FROM telemetry WHERE asset_id=? ORDER BY ts DESC LIMIT 1",
        (asset,),
    ).fetchone()
    if not row:
        return []
    alarms = []
    ts = row["ts"]
    pe_mw = float(row["moisture"] or 0.0)
    eff_pct = float(row["health"] or 0.0)
    nox_ppm = float(row["co2"] or 0.0)

    if pe_mw < 0.5:
        alarms.append({"ts": ts, "type": "POWER_LOW", "severity": "HIGH", "message": "Electrical power below 0.5 MW"})
    if eff_pct < 38:
        alarms.append({"ts": ts, "type": "EFFICIENCY_LOW", "severity": "MEDIUM", "message": "Electrical efficiency below 38%"})
    if nox_ppm > 180:
        alarms.append({"ts": ts, "type": "NOX_HIGH", "severity": "MEDIUM", "message": "NOx above 180 ppm"})
    return alarms

@app.post("/ingest")
def ingest(payload: Dict[str, Any]):
    """
    Expected payload (from simulator):
      {
        "asset_id": "pp-001",
        "ts": "2025-08-14T10:00:00Z",
        "moisture": <P_e MW>,   # electrical power
        "health":   <η_e %>,    # efficiency
        "co2":      <NOx ppm>   # NOx
      }
    """
    required = {"asset_id", "ts"}
    if not required.issubset(payload.keys()):
        raise HTTPException(400, "asset_id and ts are required")

    conn = db()
    # Ensure asset exists
    a = conn.execute("SELECT 1 FROM assets WHERE id=?", (payload["asset_id"],)).fetchone()
    if not a:
        conn.execute(
            "INSERT INTO assets(id, name, lat, lng, status) VALUES (?,?,?,?,?)",
            (payload["asset_id"], payload["asset_id"], None, None, "OK"),
        )
    # Insert telemetry
    conn.execute(
        "INSERT INTO telemetry(asset_id, ts, moisture, health, co2) VALUES (?,?,?,?,?)",
        (
            payload["asset_id"],
            payload["ts"],
            payload.get("moisture"),
            payload.get("health"),
            payload.get("co2"),
        ),
    )
    conn.commit()
    return {"ok": True}

@app.post("/commands")
async def create_command(payload: Dict[str, Any]):
    """
    Example:
      { "user_name":"tester", "asset_id":"pp-001", "cmd":"setpoint", "params":{"value":2.5} }
    """
    user = payload.get("user_name", "tester")
    asset_id = payload.get("asset_id")
    cmd = payload.get("cmd")
    params = payload.get("params", {})
    if not asset_id or not cmd:
        raise HTTPException(400, "asset_id and cmd are required")

    cmd_id = str(uuid.uuid4())
    now = dt.datetime.utcnow().isoformat() + "Z"

    conn = db()
    conn.execute(
        "INSERT INTO commands(id, user_name, asset_id, cmd, params, requested_ts, status, note) VALUES (?,?,?,?,?,?,?,?)",
        (cmd_id, user, asset_id, cmd, json.dumps(params), now, "PENDING", ""),
    )
    conn.commit()

    status = "FAILED"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.post(f"{NODE_RED_URL}/applyCommand", json={"id": cmd_id, **payload})
            r.raise_for_status()
            status = r.json().get("status", "ACK")
    except Exception:
        status = "FAILED"

    conn.execute("UPDATE commands SET status=? WHERE id=?", (status, cmd_id))
    conn.commit()
    return {"id": cmd_id, "status": status}

@app.get("/commands/{cmd_id}")
def get_command(cmd_id: str):
    conn = db()
    row = conn.execute("SELECT * FROM commands WHERE id=?", (cmd_id,)).fetchone()
    if not row:
        raise HTTPException(404, "not found")
    d = dict(row)
    if d.get("params"):
        try:
            d["params"] = json.loads(d["params"])
        except Exception:
            pass
    return d
