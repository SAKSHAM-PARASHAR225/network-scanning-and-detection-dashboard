from datetime import datetime, timezone

from extensions import db


def _utcnow():
    return datetime.now(timezone.utc)


class TrustedAccessPoint(db.Model):
    """Administrator-approved baseline.

    Identity is the BSSID, never the SSID alone - several legitimate APs can
    broadcast the same SSID, and an attacker can broadcast a trusted SSID from
    a different radio.
    """

    __tablename__ = "trusted_access_points"

    id = db.Column(db.Integer, primary_key=True)
    ssid = db.Column(db.String(255), nullable=False, index=True)
    bssid = db.Column(db.String(17), nullable=False, unique=True, index=True)
    channel = db.Column(db.Integer)
    frequency = db.Column(db.Integer)
    band = db.Column(db.String(16))
    encryption = db.Column(db.String(16))
    location = db.Column(db.String(255))
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "ssid": self.ssid,
            "bssid": self.bssid,
            "channel": self.channel,
            "frequency": self.frequency,
            "band": self.band,
            "encryption": self.encryption,
            "location": self.location,
            "active": self.active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
