"""Deterministic risk scoring.

Every point added to a score comes from an observed property of the scan, the
AP's own history, or the trusted baseline. Nothing here is random, and the same
inputs always produce the same score.
"""

from models.enums import Encryption, RiskLevel

# Scoring weights. Kept as named constants so the policy is auditable and
# tunable in one place.
W_NOT_IN_BASELINE = 15
W_SSID_IMPERSONATION = 45
W_ENCRYPTION_DOWNGRADE = 20
W_CHANNEL_MISMATCH = 5
W_OPEN = 20
W_WEP = 25
W_UNKNOWN_ENCRYPTION = 10
W_WPA_LEGACY = 5
W_SIGNAL_INSTABILITY = 10
W_CLOSE_RANGE = 10
W_PERSISTENT = 5
W_HIDDEN_SSID = 5

# An unverified AP this close is worth flagging: it is inside the monitored
# space rather than bleeding in from a neighbour.
CLOSE_RANGE_DBM = -45
SIGNAL_INSTABILITY_DBM = 25
PERSISTENCE_READINGS = 30

LEVEL_MEDIUM = 25
LEVEL_HIGH = 50
LEVEL_CRITICAL = 75


def _risk_level(score):
    if score >= LEVEL_CRITICAL:
        return RiskLevel.CRITICAL.value
    if score >= LEVEL_HIGH:
        return RiskLevel.HIGH.value
    if score >= LEVEL_MEDIUM:
        return RiskLevel.MEDIUM.value
    return RiskLevel.LOW.value


def calculate_risk(network, historical_data=None, trusted_data=None):
    """Score one observed AP.

    network:         normalized scan record (ssid, bssid, encryption, signal_dbm, channel...)
    historical_data: prior signal readings in dBm, oldest first
    trusted_data:    iterable of trusted AP dicts (ssid, bssid, encryption, channel)

    Returns {"risk_score": 0-100, "risk_level": ..., "reasons": [...]}.
    """
    historical_data = list(historical_data or [])
    trusted_data = list(trusted_data or [])

    bssid = (network.get("bssid") or "").lower()
    ssid = (network.get("ssid") or "").strip()
    encryption = network.get("encryption") or Encryption.UNKNOWN.value
    signal = network.get("signal_dbm")
    channel = network.get("channel")

    trusted_by_bssid = {(t.get("bssid") or "").lower(): t for t in trusted_data}

    score = 0
    reasons = []

    # A verified AP carries no baseline risk. Encryption weakness is still
    # reported so an operator can see a trusted AP that needs attention.
    if bssid in trusted_by_bssid:
        weak_reason = _encryption_reason(encryption)
        if weak_reason:
            weak_score = _encryption_score(encryption)
            return {
                "risk_score": weak_score,
                "risk_level": _risk_level(weak_score),
                "reasons": [f"Trusted access point {weak_reason.lower()}"],
            }
        return {
            "risk_score": 0,
            "risk_level": RiskLevel.LOW.value,
            "reasons": ["BSSID matches the administrator-approved trusted baseline"],
        }

    score += W_NOT_IN_BASELINE
    reasons.append("BSSID is not in the trusted baseline")

    # SSID impersonation: same network name broadcast from an unknown radio.
    impersonated = [t for t in trusted_data if (t.get("ssid") or "").strip() == ssid and ssid]
    if impersonated:
        score += W_SSID_IMPERSONATION
        trusted_bssids = ", ".join(sorted({t.get("bssid", "") for t in impersonated}))
        reasons.append(
            f"SSID '{ssid}' matches a trusted access point broadcast from a different BSSID "
            f"(trusted: {trusted_bssids})"
        )

        trusted_encryptions = {t.get("encryption") for t in impersonated if t.get("encryption")}
        if trusted_encryptions and encryption not in trusted_encryptions:
            score += W_ENCRYPTION_DOWNGRADE
            reasons.append(
                f"Encryption '{encryption}' differs from the trusted access point's "
                f"{'/'.join(sorted(e for e in trusted_encryptions if e))}"
            )

        trusted_channels = {t.get("channel") for t in impersonated if t.get("channel") is not None}
        if channel is not None and trusted_channels and channel not in trusted_channels:
            score += W_CHANNEL_MISMATCH
            reasons.append(f"Operating on channel {channel}, unlike the trusted access point")

    encryption_reason = _encryption_reason(encryption)
    if encryption_reason:
        score += _encryption_score(encryption)
        reasons.append(encryption_reason)

    if not ssid:
        score += W_HIDDEN_SSID
        reasons.append("Access point is not broadcasting an SSID")

    if signal is not None and signal >= CLOSE_RANGE_DBM:
        score += W_CLOSE_RANGE
        reasons.append(f"Unverified access point at close range ({signal} dBm)")

    if len(historical_data) >= 3:
        spread = max(historical_data) - min(historical_data)
        if spread >= SIGNAL_INSTABILITY_DBM:
            score += W_SIGNAL_INSTABILITY
            reasons.append(f"Signal strength varies by {spread} dBm across recent scans")

    if len(historical_data) >= PERSISTENCE_READINGS:
        score += W_PERSISTENT
        reasons.append(
            f"Unverified access point has persisted across {len(historical_data)} scans"
        )

    score = max(0, min(100, score))
    return {"risk_score": score, "risk_level": _risk_level(score), "reasons": reasons}


def _encryption_score(encryption):
    return {
        Encryption.OPEN.value: W_OPEN,
        Encryption.WEP.value: W_WEP,
        Encryption.UNKNOWN.value: W_UNKNOWN_ENCRYPTION,
        Encryption.WPA.value: W_WPA_LEGACY,
    }.get(encryption, 0)


def _encryption_reason(encryption):
    return {
        Encryption.OPEN.value: "Network is open with no encryption",
        Encryption.WEP.value: "Network uses WEP, which is broken and trivially decrypted",
        Encryption.UNKNOWN.value: "Encryption could not be determined",
        Encryption.WPA.value: "Network uses legacy WPA",
    }.get(encryption)
