from datetime import datetime, timezone

from extensions import db
from models.enums import ScanStatus


def _utcnow():
    return datetime.now(timezone.utc)


class ScanSession(db.Model):
    """One row per automatic scan cycle."""

    __tablename__ = "scan_sessions"

    id = db.Column(db.Integer, primary_key=True)
    started_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    completed_at = db.Column(db.DateTime(timezone=True))
    networks_found = db.Column(db.Integer, nullable=False, default=0)
    alerts_generated = db.Column(db.Integer, nullable=False, default=0)
    # Classification breakdown for this specific cycle - see
    # MonitoringService._scan_cycle for how VERIFIED/UNVERIFIED/SUSPICIOUS/
    # ROGUE/POSSIBLE_EVIL_TWIN map onto these three buckets.
    verified_count = db.Column(db.Integer, nullable=False, default=0)
    suspicious_count = db.Column(db.Integer, nullable=False, default=0)
    rogue_count = db.Column(db.Integer, nullable=False, default=0)
    duration = db.Column(db.Float)
    status = db.Column(db.String(16), nullable=False, default=ScanStatus.RUNNING.value, index=True)
    error = db.Column(db.Text)

    def to_dict(self):
        return {
            "id": self.id,
            "scanId": f"SCAN-{self.id:04d}",
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "networksFound": self.networks_found,
            "alertsGenerated": self.alerts_generated,
            "verifiedCount": self.verified_count,
            "suspiciousCount": self.suspicious_count,
            "rogueCount": self.rogue_count,
            "duration": round(self.duration, 2) if self.duration is not None else None,
            "status": self.status,
            "error": self.error,
        }
