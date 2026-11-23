from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import JSONB

from extensions import db
from models.enums import AlertSeverity, AlertStatus


def _utcnow():
    return datetime.now(timezone.utc)


class Alert(db.Model):
    """Security finding raised against a network.

    Deduplication is keyed on (network_id, type, status=OPEN), so a recurring
    condition keeps one OPEN alert alive rather than one per scan.
    """

    __tablename__ = "alerts"

    id = db.Column(db.Integer, primary_key=True)
    network_id = db.Column(
        db.Integer, db.ForeignKey("networks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type = db.Column(db.String(32), nullable=False, index=True)
    severity = db.Column(db.String(16), nullable=False, default=AlertSeverity.MEDIUM.value, index=True)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(16), nullable=False, default=AlertStatus.OPEN.value, index=True)
    alert_metadata = db.Column("metadata", JSONB, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)
    resolved_at = db.Column(db.DateTime(timezone=True))

    network = db.relationship("Network", back_populates="alerts")

    __table_args__ = (
        db.Index("ix_alerts_network_type_status", "network_id", "type", "status"),
    )

    def to_dict(self):
        metadata = self.alert_metadata or {}
        return {
            "id": self.id,
            "networkId": self.network_id,
            "type": self.type,
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
            "status": self.status,
            "ssid": self.network.ssid if self.network else metadata.get("ssid"),
            "bssid": self.network.bssid if self.network else metadata.get("detected_bssid"),
            "riskScore": metadata.get("risk_score"),
            "metadata": metadata,
            "timestamp": self.created_at.isoformat() if self.created_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "resolvedAt": self.resolved_at.isoformat() if self.resolved_at else None,
        }
