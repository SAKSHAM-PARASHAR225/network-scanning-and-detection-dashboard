"""Turns a scan record plus history into a classification and alert intents.

Policy, in order:
  1. BSSID in the trusted baseline            -> VERIFIED
  2. SSID of a trusted AP, different BSSID    -> POSSIBLE_EVIL_TWIN
  3. Anything else                            -> UNVERIFIED
  4. Escalate 2/3 to SUSPICIOUS or ROGUE only when the risk engine has
     aggregated enough independent indicators.

An AP is never called ROGUE just for being unknown, and never called a
confirmed evil twin on the SSID/BSSID mismatch alone.
"""

from analyzer.risk_engine import calculate_risk
from models.enums import (
    WEAK_ENCRYPTION,
    AlertSeverity,
    AlertType,
    Encryption,
    SecurityStatus,
)

# ROGUE needs both a high aggregate score and several distinct indicators, so a
# single weak signal never escalates an AP on its own.
ROGUE_SCORE_THRESHOLD = 75
ROGUE_MIN_REASONS = 3
SUSPICIOUS_SCORE_THRESHOLD = 50


class AnalysisResult:
    def __init__(self, security_status, risk_score, risk_level, reasons, alerts, trusted_bssids=None):
        self.security_status = security_status
        self.risk_score = risk_score
        self.risk_level = risk_level
        self.reasons = reasons
        self.alerts = alerts
        self.trusted_bssids = trusted_bssids or []


class AlertIntent:
    """What the alert service should ensure exists for this network."""

    def __init__(self, type_, severity, title, message, metadata=None):
        self.type = type_
        self.severity = severity
        self.title = title
        self.message = message
        self.metadata = metadata or {}


def analyze_network(record, trusted_data, historical_signals=None, settings=None):
    """Classify one observed AP. Returns an AnalysisResult.

    settings (all default True, from ScanSettings.to_analyzer_flags()):
      alert_on_open_networks / alert_on_wep - suppress the WEAK_ENCRYPTION
        alert for that specific encryption when the operator has turned it off.
      rogue_detection_enabled - when off, escalation stops at SUSPICIOUS;
        nothing is ever classified ROGUE while it's disabled.
    """
    trusted_data = list(trusted_data or [])
    historical_signals = list(historical_signals or [])
    settings = settings or {}
    alert_on_open_networks = settings.get("alert_on_open_networks", True)
    alert_on_wep = settings.get("alert_on_wep", True)
    rogue_detection_enabled = settings.get("rogue_detection_enabled", True)

    bssid = (record.get("bssid") or "").lower()
    ssid = (record.get("ssid") or "").strip()
    encryption = record.get("encryption") or Encryption.UNKNOWN.value

    risk = calculate_risk(record, historical_signals, trusted_data)
    score, level, reasons = risk["risk_score"], risk["risk_level"], risk["reasons"]

    trusted_by_bssid = {(t.get("bssid") or "").lower(): t for t in trusted_data}
    impersonated = [t for t in trusted_data if (t.get("ssid") or "").strip() == ssid and ssid]

    alerts = []

    if bssid in trusted_by_bssid:
        status = SecurityStatus.VERIFIED.value
    elif impersonated:
        status = SecurityStatus.POSSIBLE_EVIL_TWIN.value
    else:
        status = SecurityStatus.UNVERIFIED.value

    # Escalation. VERIFIED is administrator-granted and is never escalated by
    # the scanner - a trusted AP with weak crypto still gets its own alert.
    if status != SecurityStatus.VERIFIED.value:
        if rogue_detection_enabled and score >= ROGUE_SCORE_THRESHOLD and len(reasons) >= ROGUE_MIN_REASONS:
            status = SecurityStatus.ROGUE.value
        elif status == SecurityStatus.UNVERIFIED.value and score >= SUSPICIOUS_SCORE_THRESHOLD:
            status = SecurityStatus.SUSPICIOUS.value

    trusted_bssids = sorted({t.get("bssid") for t in impersonated if t.get("bssid")})
    base_metadata = {
        "ssid": ssid,
        "detected_bssid": bssid,
        "risk_score": score,
        "risk_level": level,
        "reasons": reasons,
        "encryption": encryption,
        "channel": record.get("channel"),
        "band": record.get("band"),
    }
    if trusted_bssids:
        base_metadata["trusted_bssid"] = trusted_bssids[0]
        base_metadata["trusted_bssids"] = trusted_bssids

    if status == SecurityStatus.ROGUE.value:
        alerts.append(
            AlertIntent(
                AlertType.ROGUE_AP.value,
                _severity_for(level, floor=AlertSeverity.HIGH),
                f"Rogue access point: {ssid or '(hidden SSID)'}",
                "Multiple indicators identify this access point as rogue: "
                + "; ".join(reasons),
                base_metadata,
            )
        )
    elif status == SecurityStatus.POSSIBLE_EVIL_TWIN.value:
        trusted_list = ", ".join(trusted_bssids) or "a trusted access point"
        alerts.append(
            AlertIntent(
                AlertType.POSSIBLE_EVIL_TWIN.value,
                _severity_for(level, floor=AlertSeverity.HIGH),
                f"Possible evil twin: {ssid}",
                f"Same SSID as trusted access point but different BSSID "
                f"(trusted: {trusted_list}, detected: {bssid}).",
                base_metadata,
            )
        )
    elif status in (SecurityStatus.UNVERIFIED.value, SecurityStatus.SUSPICIOUS.value):
        alerts.append(
            AlertIntent(
                AlertType.UNKNOWN_AP.value,
                _severity_for(level, floor=AlertSeverity.LOW),
                f"Unverified access point: {ssid or '(hidden SSID)'}",
                f"Access point {bssid} is not part of the trusted baseline. "
                + "; ".join(reasons),
                base_metadata,
            )
        )

    weak_encryption_suppressed = (
        (encryption == Encryption.OPEN.value and not alert_on_open_networks)
        or (encryption == Encryption.WEP.value and not alert_on_wep)
    )
    if encryption in {e.value for e in WEAK_ENCRYPTION} and not weak_encryption_suppressed:
        alerts.append(
            AlertIntent(
                AlertType.WEAK_ENCRYPTION.value,
                AlertSeverity.HIGH.value
                if encryption == Encryption.WEP.value
                else AlertSeverity.MEDIUM.value,
                f"Weak encryption on {ssid or bssid}",
                f"Access point {bssid} is using {encryption}, which does not protect "
                "client traffic.",
                base_metadata,
            )
        )

    return AnalysisResult(status, score, level, reasons, alerts, trusted_bssids)


def detect_signal_anomaly(network_ssid, bssid, readings, threshold_dbm=30):
    """Flag an abrupt jump in signal strength between consecutive scans.

    A large sudden change can mean the radio moved or that a different
    transmitter is now answering for the same BSSID.
    """
    if len(readings) < 2:
        return None

    delta = abs(readings[-1] - readings[-2])
    if delta < threshold_dbm:
        return None

    return AlertIntent(
        AlertType.SIGNAL_ANOMALY.value,
        AlertSeverity.MEDIUM.value,
        f"Signal anomaly on {network_ssid or bssid}",
        f"Signal strength changed by {delta} dBm between consecutive scans "
        f"({readings[-2]} -> {readings[-1]} dBm).",
        {
            "ssid": network_ssid,
            "detected_bssid": bssid,
            "previous_signal": readings[-2],
            "current_signal": readings[-1],
            "delta_dbm": delta,
        },
    )


def _severity_for(risk_level, floor=AlertSeverity.LOW):
    mapping = {
        "LOW": AlertSeverity.LOW,
        "MEDIUM": AlertSeverity.MEDIUM,
        "HIGH": AlertSeverity.HIGH,
        "CRITICAL": AlertSeverity.CRITICAL,
    }
    order = [
        AlertSeverity.INFO,
        AlertSeverity.LOW,
        AlertSeverity.MEDIUM,
        AlertSeverity.HIGH,
        AlertSeverity.CRITICAL,
    ]
    severity = mapping.get(risk_level, AlertSeverity.LOW)
    return (severity if order.index(severity) >= order.index(floor) else floor).value
