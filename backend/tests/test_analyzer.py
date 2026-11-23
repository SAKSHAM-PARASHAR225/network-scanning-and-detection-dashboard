"""Analyzer / risk-engine checks.

Pure logic - no database and no Flask app required:

    venv/Scripts/python.exe -m tests.test_analyzer
"""

from analyzer import analyze_network, calculate_risk, detect_signal_anomaly
from models.enums import AlertType, SecurityStatus

TRUSTED = [
    {"ssid": "CU_WiFi", "bssid": "aa:bb:cc:dd:ee:01", "channel": 6, "encryption": "WPA2"},
    {"ssid": "CU_WiFi", "bssid": "aa:bb:cc:dd:ee:02", "channel": 11, "encryption": "WPA2"},
]

failures = []


def check(label, condition, detail=""):
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label} {detail}")
        failures.append(label)


def record(ssid, bssid, encryption="WPA2", signal=-50, channel=6):
    return {
        "ssid": ssid,
        "bssid": bssid,
        "encryption": encryption,
        "signal_dbm": signal,
        "channel": channel,
        "band": "2.4 GHz",
        "frequency": 2437,
    }


print("\ntrusted AP is VERIFIED and carries no risk")
result = analyze_network(record("CU_WiFi", "aa:bb:cc:dd:ee:01"), TRUSTED)
check("status is VERIFIED", result.security_status == SecurityStatus.VERIFIED.value, result.security_status)
check("risk score is 0", result.risk_score == 0, result.risk_score)
check("no alerts raised", result.alerts == [], [a.type for a in result.alerts])

print("\nunknown SSID with strong encryption is UNVERIFIED, not ROGUE")
result = analyze_network(record("Neighbour", "11:22:33:44:55:66", "WPA2", -70), TRUSTED)
check("status is UNVERIFIED", result.security_status == SecurityStatus.UNVERIFIED.value, result.security_status)
check("raises UNKNOWN_AP alert", any(a.type == AlertType.UNKNOWN_AP.value for a in result.alerts))
check("does not raise ROGUE_AP", not any(a.type == AlertType.ROGUE_AP.value for a in result.alerts))

print("\nsame SSID, different BSSID -> POSSIBLE_EVIL_TWIN (not confirmed rogue)")
result = analyze_network(record("CU_WiFi", "aa:bb:cc:dd:ee:99", "WPA2", -65), TRUSTED)
check(
    "status is POSSIBLE_EVIL_TWIN",
    result.security_status == SecurityStatus.POSSIBLE_EVIL_TWIN.value,
    result.security_status,
)
check("evil twin alert raised", any(a.type == AlertType.POSSIBLE_EVIL_TWIN.value for a in result.alerts))
check("trusted bssid recorded", "aa:bb:cc:dd:ee:01" in result.trusted_bssids, result.trusted_bssids)

print("\nspec example: trusted SSID, unknown BSSID, OPEN encryption, close range")
result = analyze_network(record("CU_WiFi", "aa:bb:cc:dd:ee:99", "OPEN", -40, channel=1), TRUSTED)
check("escalates to ROGUE on multiple indicators", result.security_status == SecurityStatus.ROGUE.value, result.security_status)
check("risk is CRITICAL", result.risk_level == "CRITICAL", result.risk_level)
check("several reasons given", len(result.reasons) >= 3, result.reasons)
check("weak encryption alert also raised", any(a.type == AlertType.WEAK_ENCRYPTION.value for a in result.alerts))

print("\nweak encryption on an unknown AP")
result = analyze_network(record("CoffeeShop", "aa:11:bb:22:cc:33", "WEP", -60), TRUSTED)
check("weak encryption alert", any(a.type == AlertType.WEAK_ENCRYPTION.value for a in result.alerts))
check("WPA2/WPA3 never flagged weak", not any(
    a.type == AlertType.WEAK_ENCRYPTION.value
    for a in analyze_network(record("X", "de:ad:be:ef:00:01", "WPA3", -60), TRUSTED).alerts
))

print("\nunknown encryption is not treated as secure")
result = analyze_network(record("Mystery", "de:ad:be:ef:00:02", "UNKNOWN", -60), TRUSTED)
check("unknown encryption adds risk", result.risk_score > 15, result.risk_score)

print("\nrisk scoring is deterministic")
a = calculate_risk(record("CU_WiFi", "aa:bb:cc:dd:ee:99", "OPEN", -40), [], TRUSTED)
b = calculate_risk(record("CU_WiFi", "aa:bb:cc:dd:ee:99", "OPEN", -40), [], TRUSTED)
check("same input -> same score", a["risk_score"] == b["risk_score"], (a["risk_score"], b["risk_score"]))
check("score is bounded 0-100", 0 <= a["risk_score"] <= 100, a["risk_score"])

print("\nsignal anomaly detection")
check("stable signal raises nothing", detect_signal_anomaly("X", "aa", [-50, -52, -51]) is None)
check("large jump is flagged", detect_signal_anomaly("X", "aa", [-80, -40]) is not None)

print("\nsignal instability feeds the risk score")
stable = calculate_risk(record("N", "aa:aa:aa:aa:aa:aa"), [-50, -51, -50], TRUSTED)["risk_score"]
unstable = calculate_risk(record("N", "aa:aa:aa:aa:aa:aa"), [-30, -75, -40], TRUSTED)["risk_score"]
check("unstable scores higher", unstable > stable, (stable, unstable))

print("\nempty baseline (first run) does not mark everything rogue")
result = analyze_network(record("Anything", "aa:bb:cc:00:00:01", "WPA2", -60), [])
check("status is UNVERIFIED", result.security_status == SecurityStatus.UNVERIFIED.value, result.security_status)
check("not ROGUE", result.security_status != SecurityStatus.ROGUE.value)

print("\nsettings: alert_on_open_networks off suppresses only the OPEN alert")
result = analyze_network(record("X", "de:ad:be:ef:00:03", "OPEN", -60), [], settings={"alert_on_open_networks": False})
check("no weak-encryption alert", not any(a.type == AlertType.WEAK_ENCRYPTION.value for a in result.alerts), [a.type for a in result.alerts])
check("still classified UNVERIFIED", result.security_status == SecurityStatus.UNVERIFIED.value)
result = analyze_network(record("X", "de:ad:be:ef:00:04", "WEP", -60), [], settings={"alert_on_open_networks": False})
check("WEP alert unaffected by the open-network flag", any(a.type == AlertType.WEAK_ENCRYPTION.value for a in result.alerts))

print("\nsettings: alert_on_wep off suppresses only the WEP alert")
result = analyze_network(record("X", "de:ad:be:ef:00:05", "WEP", -60), [], settings={"alert_on_wep": False})
check("no weak-encryption alert", not any(a.type == AlertType.WEAK_ENCRYPTION.value for a in result.alerts))
result = analyze_network(record("X", "de:ad:be:ef:00:06", "OPEN", -60), [], settings={"alert_on_wep": False})
check("OPEN alert unaffected by the WEP flag", any(a.type == AlertType.WEAK_ENCRYPTION.value for a in result.alerts))

print("\nsettings: rogue_detection_enabled off caps escalation at SUSPICIOUS")
rogue_case = record("CU_WiFi", "aa:bb:cc:dd:ee:99", "OPEN", -40, channel=1)
with_rogue = analyze_network(rogue_case, TRUSTED)
without_rogue = analyze_network(rogue_case, TRUSTED, settings={"rogue_detection_enabled": False})
check("rogue detection on -> ROGUE", with_rogue.security_status == SecurityStatus.ROGUE.value, with_rogue.security_status)
check("rogue detection off -> never ROGUE", without_rogue.security_status != SecurityStatus.ROGUE.value, without_rogue.security_status)
check("no ROGUE_AP alert while disabled", not any(a.type == AlertType.ROGUE_AP.value for a in without_rogue.alerts))
check("risk score unaffected by the toggle", with_rogue.risk_score == without_rogue.risk_score, (with_rogue.risk_score, without_rogue.risk_score))

print("\n" + ("ALL CHECKS PASSED" if not failures else f"{len(failures)} FAILURES: {failures}"))
raise SystemExit(1 if failures else 0)
