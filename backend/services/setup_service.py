"""First-run baseline discovery.

On a fresh install there is no trusted baseline, so every AP in range is
unknown. Marking them all rogue would be noise, not security. Instead the
first scan is a *discovery* scan: the operator is shown what is actually in the
air and picks which APs are authorised. Only then does monitoring begin.
"""

import threading
from datetime import datetime, timezone

from extensions import db
from models import Alert, AlertStatus, AlertType, Network, SecurityStatus, TrustedAccessPoint

# Results of the most recent discovery scan, so POST /api/setup/verify can
# resolve a BSSID back to its channel/band/encryption without rescanning.
_discovery_lock = threading.Lock()
_last_discovery = {"timestamp": None, "records": []}


def trusted_count():
    return db.session.query(TrustedAccessPoint).filter(TrustedAccessPoint.active.is_(True)).count()


def is_setup_required():
    return trusted_count() == 0


def get_trusted_data():
    """Trusted baseline as plain dicts for the analyzer/risk engine."""
    rows = db.session.query(TrustedAccessPoint).filter(TrustedAccessPoint.active.is_(True)).all()
    return [
        {
            "id": row.id,
            "ssid": row.ssid,
            "bssid": row.bssid,
            "channel": row.channel,
            "frequency": row.frequency,
            "band": row.band,
            "encryption": row.encryption,
        }
        for row in rows
    ]


def record_discovery(records):
    with _discovery_lock:
        _last_discovery["timestamp"] = datetime.now(timezone.utc)
        _last_discovery["records"] = list(records)


def get_last_discovery():
    with _discovery_lock:
        return {
            "timestamp": _last_discovery["timestamp"],
            "records": list(_last_discovery["records"]),
        }


def run_discovery(scanner):
    """Perform a real discovery scan and cache the result."""
    records = scanner.scan()
    record_discovery(records)
    return records


def verify_bssids(bssids, location=None):
    """Promote the selected BSSIDs into the trusted baseline.

    Details come from the cached discovery scan, falling back to anything the
    monitor has already stored. A BSSID we have never actually observed is
    rejected rather than trusted on the client's word.
    """
    wanted = {b.strip().lower() for b in bssids if b and b.strip()}
    if not wanted:
        return {"verified": [], "skipped": [], "error": "No BSSIDs supplied"}

    discovery = get_last_discovery()
    by_bssid = {(r.get("bssid") or "").lower(): r for r in discovery["records"]}

    verified, skipped = [], []

    for bssid in sorted(wanted):
        record = by_bssid.get(bssid)

        if record is None:
            known = db.session.query(Network).filter(Network.bssid == bssid).first()
            if known is not None:
                record = {
                    "ssid": known.ssid,
                    "bssid": known.bssid,
                    "channel": known.channel,
                    "frequency": known.frequency,
                    "band": known.band,
                    "encryption": known.encryption,
                }

        if record is None:
            skipped.append({"bssid": bssid, "reason": "Not present in any observed scan"})
            continue

        trusted = (
            db.session.query(TrustedAccessPoint)
            .filter(TrustedAccessPoint.bssid == bssid)
            .first()
        )
        if trusted is None:
            trusted = TrustedAccessPoint(bssid=bssid)
            db.session.add(trusted)

        trusted.ssid = record.get("ssid") or ""
        trusted.channel = record.get("channel")
        trusted.frequency = record.get("frequency")
        trusted.band = record.get("band")
        trusted.encryption = record.get("encryption")
        trusted.active = True
        if location:
            trusted.location = location

        db.session.flush()
        verified.append(trusted)

        mark_network_verified(bssid)

    db.session.commit()
    return {"verified": verified, "skipped": skipped, "error": None}


def mark_network_verified(bssid):
    """Flip an already-observed network to VERIFIED and close its stale alerts."""
    network = db.session.query(Network).filter(Network.bssid == bssid).first()
    if network is None:
        return

    network.security_status = SecurityStatus.VERIFIED.value
    network.risk_score = 0
    network.risk_level = "LOW"

    stale = (
        db.session.query(Alert)
        .filter(
            Alert.network_id == network.id,
            Alert.status == AlertStatus.OPEN.value,
            Alert.type.in_([AlertType.UNKNOWN_AP.value, AlertType.ROGUE_AP.value,
                            AlertType.POSSIBLE_EVIL_TWIN.value]),
        )
        .all()
    )
    for alert in stale:
        alert.status = AlertStatus.RESOLVED.value
        alert.resolved_at = datetime.now(timezone.utc)


def reset_baseline():
    """Clear the trusted baseline and send the system back to first-run setup."""
    count = db.session.query(TrustedAccessPoint).delete()
    db.session.query(Network).update(
        {Network.security_status: SecurityStatus.UNVERIFIED.value}, synchronize_session=False
    )
    db.session.commit()
    record_discovery([])
    return count
