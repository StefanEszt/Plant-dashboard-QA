# Local Realistic Stack — Dashboard-like demo backend using plant "features" 


## What’s included
- **FastAPI + SQLite** at `http://localhost:8000` with:
  - `GET  /assets`
  - `GET  /telemetry?asset=ID&limit=N`
  - `GET  /alarms?asset=ID`
  - `POST /ingest` (used by the simulator to push data)
  - `POST /commands` → forwards to Node-RED for an ACK/REJECT
  - `GET  /commands/{id}`
- **Node-RED** simulator at `http://localhost:1880`:
  - Posts telemetry every 2s to the API
  - Exposes `POST /applyCommand` to ACK whitelisted commands (`start`, `stop`, `setpoint`)

## Run
```bash
docker compose up -d --build
# API docs: http://localhost:8000/docs
# Node-RED: http://localhost:1880
```

## Run frontend
In the React app, point to the API with an env var
```bash
# in frontend shell
export VITE_API_BASE=http://localhost:8000
npm run dev
```

