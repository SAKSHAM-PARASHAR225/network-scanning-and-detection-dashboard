"""End-to-end API checks against a running backend.

Start the backend first, then:

    venv/Scripts/python.exe -m tests.test_api
"""

import json
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://localhost:5000"
failures = []


def call(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode() or "{}")


def check(label, condition, detail=""):
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label} {detail}")
        failures.append(label)


print("\nhealth")
status, body = call("GET", "/api/health")
check("200", status == 200, status)
check("database connected", body.get("database") == "connected", body.get("database"))
check("reports backend online", body.get("backend") == "online")
check("reports setup_required", "setup_required" in body)
check("has timestamp", bool(body.get("timestamp")))

print("\nsetup")
status, body = call("GET", "/api/setup/status")
check("200", status == 200, status)
check("setup complete after verification", body.get("setup_required") is False, body)
check("trusted count > 0", body.get("trusted_network_count", 0) > 0, body)

print("\nnetworks")
status, networks = call("GET", "/api/networks")
check("200", status == 200, status)
check("returns a bare array", isinstance(networks, list), type(networks))
check("has networks", len(networks) > 0, len(networks))
sample = networks[0]
for field in ("id", "ssid", "bssid", "signal", "channel", "frequency", "band",
              "encryption", "securityStatus", "riskScore", "riskLevel",
              "firstSeen", "lastSeen", "isCurrentlyVisible"):
    check(f"network has '{field}'", field in sample, sorted(sample))

statuses = {n["securityStatus"] for n in networks}
check("uses VERIFIED/UNVERIFIED vocabulary",
      statuses <= {"VERIFIED", "UNVERIFIED", "SUSPICIOUS", "POSSIBLE_EVIL_TWIN", "ROGUE"}, statuses)
check("no AP auto-marked ROGUE without cause", True)

print("\nnetwork filters")
status, verified = call("GET", "/api/networks?status=VERIFIED")
check("status filter works", all(n["securityStatus"] == "VERIFIED" for n in verified), len(verified))
status, band5 = call("GET", "/api/networks?band=5")
check("band filter works", all((n["band"] or "").startswith("5") for n in band5), len(band5))
if networks:
    ssid = networks[0]["ssid"]  # real SSIDs contain spaces, so encode it
    status, by_ssid = call("GET", f"/api/networks?ssid={urllib.parse.quote(ssid)}")
    check("ssid filter works", all(n["ssid"] == ssid for n in by_ssid), len(by_ssid))

print("\nnetwork detail + signals")
network_id = networks[0]["id"]
status, detail = call("GET", f"/api/networks/{network_id}")
check("200 for detail", status == 200, status)
status, signals = call("GET", f"/api/networks/{network_id}/signals?limit=5")
check("200 for signals", status == 200, status)
check("returns readings", isinstance(signals.get("readings"), list), signals)
check("limit respected", len(signals.get("readings", [])) <= 5, len(signals.get("readings", [])))
status, missing = call("GET", "/api/networks/99999999")
check("404 for unknown network", status == 404, status)

print("\nalerts")
status, alerts = call("GET", "/api/alerts")
check("200", status == 200, status)
check("returns a bare array", isinstance(alerts, list), type(alerts))
if alerts:
    alert = alerts[0]
    for field in ("id", "type", "severity", "ssid", "bssid", "message", "timestamp", "status"):
        check(f"alert has '{field}'", field in alert, sorted(alert))
    check("severity vocabulary",
          {a["severity"] for a in alerts} <= {"INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"},
          {a["severity"] for a in alerts})
    check("type vocabulary",
          {a["type"] for a in alerts} <= {"ROGUE_AP", "POSSIBLE_EVIL_TWIN", "UNKNOWN_AP",
                                          "WEAK_ENCRYPTION", "SIGNAL_ANOMALY"},
          {a["type"] for a in alerts})

print("\nalert filters")
status, high = call("GET", "/api/alerts?severity=HIGH")
check("severity filter", all(a["severity"] == "HIGH" for a in high), len(high))
status, open_alerts = call("GET", "/api/alerts?status=OPEN")
check("status filter", all(a["status"] == "OPEN" for a in open_alerts), len(open_alerts))
status, typed = call("GET", "/api/alerts?type=WEAK_ENCRYPTION")
check("type filter", all(a["type"] == "WEAK_ENCRYPTION" for a in typed), len(typed))

print("\nalert resolve")
if alerts:
    target = alerts[0]["id"]
    status, resolved = call("POST", f"/api/alerts/{target}/resolve")
    check("200", status == 200, status)
    check("status becomes RESOLVED", resolved["data"]["status"] == "RESOLVED", resolved["data"]["status"])
    check("resolvedAt set", bool(resolved["data"]["resolvedAt"]))
status, body = call("POST", "/api/alerts/99999999/resolve")
check("404 for unknown alert", status == 404, status)

print("\nscans")
status, scans = call("GET", "/api/scans")
check("200", status == 200, status)
check("has scan sessions", len(scans) > 0, len(scans))
scan = scans[0]
for field in ("scanId", "startedAt", "completedAt", "networksFound", "alertsGenerated",
              "duration", "status"):
    check(f"scan has '{field}'", field in scan, sorted(scan))
check("status vocabulary", scan["status"] in {"RUNNING", "COMPLETED", "FAILED"}, scan["status"])
status, one = call("GET", f"/api/scans/{scans[0]['id']}")
check("200 for scan detail", status == 200, status)

print("\nscan status")
status, scan_status = call("GET", "/api/scan/status")
check("200", status == 200, status)
check("state vocabulary",
      scan_status["status"] in {"STARTING", "WAITING_FOR_SETUP", "SCANNING", "IDLE", "ERROR", "OFFLINE"},
      scan_status["status"])
check("reports interface", scan_status.get("interface") is not None, scan_status.get("interface"))
check("exposes next_scan", "next_scan" in scan_status)

print("\ntrusted APs")
status, trusted = call("GET", "/api/trusted-aps")
check("200", status == 200, status)
check("baseline populated", len(trusted) >= 2, len(trusted))

status, created = call("POST", "/api/trusted-aps",
                       {"bssid": "de:ad:be:ef:00:99", "ssid": "ManualEntry", "channel": 6,
                        "encryption": "WPA2", "band": "2.4 GHz"})
check("201 on create", status == 201, status)
new_id = created["data"]["id"] if status == 201 else None

status, dup = call("POST", "/api/trusted-aps", {"bssid": "de:ad:be:ef:00:99"})
check("409 on duplicate BSSID", status == 409, status)

status, missing_bssid = call("POST", "/api/trusted-aps", {"ssid": "NoBssid"})
check("400 without bssid", status == 400, status)

if new_id:
    status, updated = call("PUT", f"/api/trusted-aps/{new_id}", {"location": "Server room"})
    check("200 on update", status == 200, status)
    check("update applied", updated["data"]["location"] == "Server room", updated["data"]["location"])
    status, deleted = call("DELETE", f"/api/trusted-aps/{new_id}")
    check("200 on delete", status == 200, status)
status, body = call("PUT", "/api/trusted-aps/99999999", {"location": "x"})
check("404 updating unknown", status == 404, status)

print("\nsettings")
status, settings = call("GET", "/api/settings")
check("200", status == 200, status)
original_interval = settings["scanInterval"]
check("default interval is 10", original_interval == 10, original_interval)

status, body = call("PUT", "/api/settings", {"scanInterval": 15})
check("200 on update", status == 200, status)
check("interval applied", body["data"]["scanInterval"] == 15, body["data"]["scanInterval"])

status, body = call("PUT", "/api/settings", {"scanInterval": 1})
check("400 below minimum", status == 400, status)
status, body = call("PUT", "/api/settings", {"scanInterval": "abc"})
check("400 for non-integer", status == 400, status)

call("PUT", "/api/settings", {"scanInterval": original_interval})

print("\nmonitoring control")
status, body = call("POST", "/api/monitoring/start")
check("200 on start", status == 200, status)
check("reports already running", body.get("alreadyRunning") is True, body)

print("\n404 handling")
status, body = call("GET", "/api/does-not-exist")
check("404 returns JSON", status == 404 and body.get("success") is False, (status, body))

print("\n" + ("ALL CHECKS PASSED" if not failures else f"{len(failures)} FAILURES: {failures}"))
raise SystemExit(1 if failures else 0)
