from datetime import datetime, timezone

from extensions import db
from models.enums import Encryption, RiskLevel, SecurityStatus


def _utcnow():
    return datetime.now(timezone.utc)


class Network(db.Model):
    """Every AP the scanner has ever observed.

    Rows are never deleted when an AP goes out of range - is_currently_visible
    is cleared instead, so history and first_seen survive.
    """

    __tablename__ = "networks"

    id = db.Column(db.Integer, primary_key=True)
    ssid = db.Column(db.String(255), nullable=False, index=True)
    bssid = db.Column(db.String(17), nullable=False, unique=True, index=True)
    channel = db.Column(db.Integer)
    frequency = db.Column(db.Integer)
    band = db.Column(db.String(16), index=True)
    encryption = db.Column(db.String(16), nullable=False, default=Encryption.UNKNOWN.value)
    signal_dbm = db.Column(db.Integer)
    security_status = db.Column(
        db.String(32), nullable=False, default=SecurityStatus.UNVERIFIED.value, index=True
    )
    risk_score = db.Column(db.Integer, nullable=False, default=0)
    risk_level = db.Column(db.String(16), nullable=False, default=RiskLevel.LOW.value)
    first_seen = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow)
    last_seen = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    is_currently_visible = db.Column(db.Boolean, nullable=False, default=True, index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    signal_readings = db.relationship(
        "SignalReading",
        back_populates="network",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    alerts = db.relationship(
        "Alert",
        back_populates="network",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "ssid": self.ssid,
            "bssid": self.bssid,
            "channel": self.channel,
            "frequency": self.frequency,
            "band": self.band,
            "encryption": self.encryption,
            "signal": self.signal_dbm,
            "securityStatus": self.security_status,
            "riskScore": self.risk_score,
            "riskLevel": self.risk_level,
            "firstSeen": self.first_seen.isoformat() if self.first_seen else None,
            "lastSeen": self.last_seen.isoformat() if self.last_seen else None,
            "isCurrentlyVisible": self.is_currently_visible,
        }
