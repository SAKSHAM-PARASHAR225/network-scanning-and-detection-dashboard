# ScanGuard

ScanGuard is a real-time wireless network scanning and threat detection dashboard. It discovers nearby Wi-Fi access points, compares them with a trusted baseline, highlights suspicious networks, and streams monitoring updates to a React dashboard.

> ScanGuard scans nearby Wi-Fi access points. It is not an IP, host, or port scanner.

## What it does

- Discovers nearby networks and displays signal strength, channel, security type, and other available details.
- Uses trusted access points (BSSIDs) as a baseline to help identify unknown or suspicious networks, including possible evil twins.
- Tracks alerts, scan history, network changes, and signal trends.
- Streams live status and monitoring updates from the backend with Socket.IO.
- Lets you tune monitoring and detection settings from the dashboard.
- Supports Windows (`netsh`) and Linux (`nmcli` or `iwlist`) scanning backends.

## How it works

```mermaid
flowchart LR
  W[Wi-Fi adapter] --> S[Platform scanner]
  S --> A[Analyzer and risk engine]
  A --> D[(PostgreSQL)]
  D --> API[Flask REST API and Socket.IO]
  API --> UI[React dashboard]
```

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- Python 3.11+
- PostgreSQL 13+ with a database created for ScanGuard
- A Wi-Fi adapter supported by the operating system
- On Linux: NetworkManager (`nmcli`) or `wireless-tools` (`iwlist`)

Windows uses the built-in `netsh` scanner. On Linux, `auto` selects `nmcli` or `iwlist` based on what is installed. Scan results depend on the adapter, OS permissions, and wireless environment.

## Run locally

Start the backend and frontend in separate terminals.

### 1. Configure PostgreSQL

Create a database, for example:

```bash
createdb -U postgres wireless_monitor
```

If `createdb` is unavailable, create a database named `wireless_monitor` using your PostgreSQL administration tool.

### 2. Start the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

```bash
# Linux/macOS
source .venv/bin/activate
```

Install dependencies and configure the environment:

```bash
python -m pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and set at least `DATABASE_URL` and a private `SECRET_KEY`. For example:

```dotenv
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/wireless_monitor
SECRET_KEY=replace-with-a-long-random-value
```

Then initialize the schema and start the service:

```bash
flask --app cli db upgrade
python run.py
```

The API and Socket.IO server listen on `http://localhost:5000` by default. The health endpoint is `http://localhost:5000/api/health`.

### 3. Start the frontend

From the repository root, in a second terminal:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The frontend connects to `http://localhost:5000` by default. To use a different backend, create a root `.env.local` file:

```dotenv
VITE_API_BASE_URL=http://localhost:5000
```

## First launch

On first run, ScanGuard enters setup/discovery mode because no trusted access points have been configured. Review the discovered networks in the dashboard and mark the access points you trust. The baseline is keyed by BSSID, rather than SSID, so networks that share a name are still distinguished.

After setup, the backend continues scanning and the dashboard reports findings according to the enabled analyzer settings. Keep the dashboard and backend on a trusted network while configuring the system.

## Configuration

Backend settings are read from `backend/.env`:

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Local `wireless_monitor` database |
| `SECRET_KEY` | Flask session and application secret | Development fallback; replace it |
| `HOST` / `PORT` | Backend bind address and port | `0.0.0.0` / `5000` |
| `CORS_ORIGINS` | Allowed frontend origins | `*` |
| `SCAN_INTERVAL` | Initial scan interval in seconds | `10` |
| `SCANNER_BACKEND` | `auto`, `netsh`, `nmcli`, or `iwlist` | `auto` |
| `WIFI_INTERFACE` | Optional wireless interface name | Auto-detected |
| `AUTO_START_MONITORING` | Start monitoring when the backend boots | `true` |
| `SIGNAL_HISTORY_LIMIT` | Signal readings kept per network; `0` keeps all | `0` |

The persisted dashboard scan settings may take precedence over the initial interval and interface values.

The optional `VITE_ACCESS_PASSWORD` controls a client-side access screen. It is not server-side authentication and must not be treated as a security boundary for a publicly exposed deployment. Configure the backend, CORS, network access, and any real authentication before exposing the service beyond a trusted local environment.

## Useful commands

```bash
# From the repository root
npm run build
npm run lint
```

```bash
# From the backend directory with its virtual environment active
python cli.py scan-once
python cli.py show-status
python cli.py trust-bssid <bssid> [<bssid> ...]
flask --app cli db upgrade
```

## API overview

The Flask service exposes endpoints under `/api` for health, setup, networks, trusted access points, alerts, scans, and monitoring settings. Live changes are broadcast over Socket.IO. The endpoint implementations are in [`backend/api`](backend/api/), with event handling in [`backend/sockets`](backend/sockets/).

## Project structure

```text
src/                   React + TypeScript dashboard
src/pages/             Dashboard, networks, alerts, analytics, settings, and history
src/components/         Reusable dashboard and visualization components
src/services/           REST API and Socket.IO clients
backend/api/            Flask REST endpoints
backend/scanner/        Windows and Linux Wi-Fi scanning adapters
backend/analyzer/       Network classification and risk scoring
backend/services/       Monitoring, setup, and alert workflows
backend/models/         SQLAlchemy data models
backend/migrations/     Alembic database migrations
Project_Report/         Project report documents and PDFs
```

## Reports

Project documentation is available in [`Project_Report/`](Project_Report/), including PDF and editable Word versions.

## Responsible use

Use ScanGuard only on wireless environments and equipment you own or are authorized to monitor. ScanGuard is a monitoring aid; review findings in context and do not treat automated classifications as proof of malicious activity.
