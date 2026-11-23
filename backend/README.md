# Wireless Monitor Backend

Flask + Flask-SocketIO + PostgreSQL backend for the Wireless Network Monitoring
Security Dashboard. Performs real, continuous Wi-Fi scanning (no simulated
data), classifies access points against an administrator-approved trusted
baseline, and pushes live updates to the React frontend over Socket.IO.

```
Wi-Fi Adapter -> Scanner (netsh/nmcli/iwlist) -> Security Analyzer + Risk Engine
    -> PostgreSQL -> Flask REST API + Flask-SocketIO -> React Dashboard
```

## Requirements

- Python 3.11+
- PostgreSQL 13+, reachable and with a database created for this app
- Windows: no extra setup — scanning uses the built-in `netsh` command
- Linux: NetworkManager (`nmcli`) or `wireless-tools` (`iwlist`, usually needs root)

## Setup

```bash
python -m venv venv
venv\Scripts\activate            # Windows
# source venv/bin/activate       # Linux/macOS

pip install -r requirements.txt

createdb -U postgres wireless_monitor   # or create it however you prefer

cp .env.example .env
# edit .env: DATABASE_URL, SCAN_INTERVAL, SCANNER_BACKEND, etc.
# note: special characters in the DB password (# @ etc.) must be percent-encoded

flask --app cli db upgrade       # creates the schema via Alembic
python run.py                    # starts the API, sockets, and the scanner loop
```

The server listens on `http://localhost:5000` by default. The frontend's
`VITE_API_BASE_URL` should point here (it defaults to this already).

## First run

On first start there is no trusted baseline, so the scanner runs in discovery
mode (`WAITING_FOR_SETUP`) instead of classifying anything as rogue. Open the
dashboard — it shows a first-run screen listing every access point currently
in range. Select the ones you administer or otherwise trust and confirm; that
calls `POST /api/setup/verify`, which saves them (keyed by BSSID, not SSID)
and switches the scanner into continuous monitoring.

## Management commands

```bash
python cli.py scan-once        # one real scan, prints the results, no DB writes
python cli.py show-status      # current scanner + setup status
python cli.py trust-bssid <bssid> [<bssid> ...]
python cli.py db migrate -m "message"   # after changing a model
python cli.py db upgrade
```

## Tests

Pure-logic checks for the analyzer/risk engine (no DB or server needed):

```bash
python -m tests.test_analyzer
```

End-to-end API checks (needs the server running against a real database):

```bash
python -m tests.test_api
```

## Project layout

```
app.py                  Flask app factory, error handlers, socket connect handler
run.py                  dev entrypoint (socketio.run, reloader disabled on purpose)
cli.py                  flask db migrate/upgrade + management commands
config.py               env-driven configuration
extensions.py           db / migrate / cors / socketio singletons

models/                 SQLAlchemy models (networks, alerts, scan_sessions, ...)
scanner/                BaseScanner + NetshScanner/NmcliScanner/IwlistScanner + factory
                         wlan_api.py forces a real Windows scan via WlanScan()
                         scapy_scanner.py is a documented, unimplemented extension point
analyzer/               security_analyzer.py (classification) + risk_engine.py (scoring)
services/               monitoring_service.py (the one continuous scan loop),
                         alert_service.py (dedup), setup_service.py (baseline/discovery)
api/                     one blueprint per resource (setup, trusted-aps, networks,
                         alerts, scans, settings, health)
sockets/                 outbound Socket.IO broadcasts
```

## Design notes for future extension

- **Trust is by BSSID, never SSID.** Multiple legitimate APs can share an
  SSID; an attacker can broadcast a trusted SSID from a rogue radio.
- **Deduplication**: a recurring finding keeps one OPEN alert alive
  (`network_id` + `type` + `status=OPEN`) instead of one row per scan cycle.
- **Escalation is deterministic**: `POSSIBLE_EVIL_TWIN` only becomes `ROGUE`
  once the risk engine has accumulated several independent indicators
  (`analyzer/security_analyzer.py`, `ROGUE_SCORE_THRESHOLD` /
  `ROGUE_MIN_REASONS`) — never from a single signal.
- **Exactly one monitoring loop** runs per process (`MonitoringService` is a
  singleton with a lock around `start()`); any number of dashboards can
  connect without spawning additional scanners.
- **Extension points left deliberately unimplemented**: passive
  monitor-mode capture, ML-based anomaly scoring, email/SMS
  notifications, map-based visualization, and auto-blocking. The alert and
  risk-engine metadata (`reasons`, `risk_score`) are already structured to
  feed a future ML model without changing the API contract.
