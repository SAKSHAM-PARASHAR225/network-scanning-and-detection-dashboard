"""Alert creation with deduplication.

A rogue AP sitting in the airspace is re-detected every scan cycle. Without
deduplication that is one alert row every 10 seconds. Instead, the first
detection opens an alert and later detections refresh the existing OPEN row
keyed on (network_id, type, status=OPEN).
"""

from datetime import datetime, timezone

from extensions import db
from models import Alert, AlertStatus


def _utcnow():
    return datetime.now(timezone.utc)


def upsert_alert(network, intent):
    """Create an OPEN alert or refresh the matching one.

    Returns (alert, created) where created is True only on first detection, so
    the caller knows whether to broadcast alert_created.
    """
    existing = (
        db.session.query(Alert)
        .filter(
            Alert.network_id == network.id,
            Alert.type == intent.type,
            Alert.status == AlertStatus.OPEN.value,
        )
        .order_by(Alert.created_at.desc())
        .first()
    )

    if existing is not None:
        existing.severity = intent.severity
        existing.title = intent.title
        existing.message = intent.message
        existing.alert_metadata = intent.metadata
        existing.updated_at = _utcnow()
        return existing, False

    alert = Alert(
        network_id=network.id,
        type=intent.type,
        severity=intent.severity,
        title=intent.title,
        message=intent.message,
        status=AlertStatus.OPEN.value,
        alert_metadata=intent.metadata,
    )
    db.session.add(alert)
    db.session.flush()  # assign id so the broadcast payload is complete
    return alert, True


def resolve_alert(alert_id):
    alert = db.session.get(Alert, alert_id)
    if alert is None:
        return None
    alert.status = AlertStatus.RESOLVED.value
    alert.resolved_at = _utcnow()
    return alert


def resolve_alerts_for_network(network_id, types=None):
    """Resolve OPEN alerts for a network.

    Used when an AP is promoted into the trusted baseline - its outstanding
    "unknown AP" findings are no longer true.
    """
    query = db.session.query(Alert).filter(
        Alert.network_id == network_id,
        Alert.status == AlertStatus.OPEN.value,
    )
    if types:
        query = query.filter(Alert.type.in_(list(types)))

    resolved = []
    for alert in query.all():
        alert.status = AlertStatus.RESOLVED.value
        alert.resolved_at = _utcnow()
        resolved.append(alert)
    return resolved
