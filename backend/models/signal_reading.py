from datetime import datetime, timezone

from extensions import db


def _utcnow():
    return datetime.now(timezone.utc)


class SignalReading(db.Model):
    """One row per AP per scan. Append-only - readings are never overwritten."""

    __tablename__ = "signal_readings"

    id = db.Column(db.Integer, primary_key=True)
    network_id = db.Column(
        db.Integer, db.ForeignKey("networks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    signal_dbm = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow, index=True)

    network = db.relationship("Network", back_populates="signal_readings")

    __table_args__ = (
        db.Index("ix_signal_readings_network_timestamp", "network_id", "timestamp"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "networkId": self.network_id,
            "signal": self.signal_dbm,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
