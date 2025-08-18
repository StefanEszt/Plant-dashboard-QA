# Plant-dashboard-QA
This project serves to demonstrate my QA technique + Cypress skills 

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Cypress](https://img.shields.io/badge/-cypress-%23E5E5E5?style=for-the-badge&logo=cypress&logoColor=058a5e)


The project is a demo power-plant monitoring dashboard built with a realistic stack:


| Features          | Description                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| **Backend:**        | FastAPI + SQLite (assets, telemetry, alarms, commands)     |
| **Simulator:**    | Node-RED, generating streaming telemetry (power, efficiency, NOx)                |
| **Frontend:**     | Vite + React (interactive dashboard with map, trends, reports, controls)        |
| **Tests** | Cypress end-to-end suite with Page Objects, BDD-style steps                   |

Everything runs locally via **Docker Compose**.

---
### ▶ How to start


## Project Structure

local-realistic-stack/      # Backend + Simulator

├── api/                    # FastAPI app

├── sim/                    # Node-RED flows

└── docker-compose.yml

tree-dashboarderedeti/      # React + Vite frontend

cypress/                    # Cypress tests



---

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Node.js ≥ 18 + npm
- Git
### 2. Setup & Installation
Clone the repository
```bash
git clone https://github.com/StefanEszt/Plant-dashboard-QA.git
```
Start the backend + simulator

```bash
cd local-realistic-stack
docker compose up -d --build
```
API → http://localhost:8000
Swagger docs → http://localhost:8000/docs

Node-RED → http://localhost:1880s

Start Frontend

```bash
cd tree-dashboarderedeti
npm install
```
Configure API base URL
```bash
# macOS/Linux
export VITE_API_BASE=http://localhost:8000

# Windows PowerShell
$env:VITE_API_BASE="http://localhost:8000"
```

Then Run 
```bash
npm run dev
```

On Frontend → http://localhost:5173

# Run TESTS

```bash
npx cypress open   # interactive
npx cypress run    # headless
```






### Tests

- **The Cypress E2E test suite is the highlight of this repo.**

- Uses Page Object Model (POM) (cypress/pages/)

- BDD syntax (Given / When / Then) for readability

Covers:

Asset filtering

Trend charts

Controls (start/stop/setpoint, with time-travel via cy.clock/cy.tick)

Reports (CSV export with download verification)

Handles real browser downloads with Cypress tasks (listDownloads, clearDownloads)

Smart handling of headless mode: download checks are skipped where Cypress has known limitations

Example test (Reports export):

