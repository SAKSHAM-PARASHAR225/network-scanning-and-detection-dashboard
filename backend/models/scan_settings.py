from datetime import datetime, timezone

from extensions import db


def _utcnow():
    return datetime.now(timezone.utc)


class ScanSettings(db.Model):
    """Single-row table holding the live scanner configuration."""

    __tablename__ = "scan_settings"

    id = db.Column(db.Integer, primary_key=True)
    scan_interval = db.Column(db.Integer, nullable=False, default=10)
    interface = db.Column(db.String(64))
    monitoring_enabled = db.Column(db.Boolean, nullable=False, default=True)
    # These three gate what the security analyzer does with a scan result -
    # see analyzer/security_analyzer.py::analyze_network.
    alert_on_open_networks = db.Column(db.Boolean, nullable=False, default=True)
    alert_on_wep = db.Column(db.Boolean, nullable=False, default=True)
    rogue_detection_enabled = db.Column(db.Boolean, nullable=False, default=True)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    @classmethod
    def get_or_create(cls, default_interval=10, default_interface=""):
        settings = db.session.query(cls).order_by(cls.id.asc()).first()
        if settings is None:
            settings = cls(
                scan_interval=default_interval,
                interface=default_interface or None,
                monitoring_enabled=True,
            )
            db.session.add(settings)
            db.session.commit()
        return settings

    def to_dict(self):
        return {
            "id": self.id,
            "scanInterval": self.scan_interval,
            "interface": self.interface,
            "monitoringEnabled": self.monitoring_enabled,
            "alertOnOpenNetworks": self.alert_on_open_networks,
            "alertOnWep": self.alert_on_wep,
            "rogueDetectionEnabled": self.rogue_detection_enabled,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_analyzer_flags(self):
        return {
            "alert_on_open_networks": self.alert_on_open_networks,
            "alert_on_wep": self.alert_on_wep,
            "rogue_detection_enabled": self.rogue_detection_enabled,
        }
