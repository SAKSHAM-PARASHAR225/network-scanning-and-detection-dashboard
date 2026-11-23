"""Scanner status, settings, and monitoring control."""

from flask import Blueprint, jsonify, request

from extensions import db
from models import ScanSettings
from services import setup_service
from services.monitoring_service import FIXED_SCAN_INTERVAL_SECONDS, monitoring_service

bp = Blueprint("settings", __name__, url_prefix="/api")

MIN_INTERVAL = 5
MAX_INTERVAL = 3600


def _settings():
    from flask import current_app

    return ScanSettings.get_or_create(
        default_interval=current_app.config["DEFAULT_SCAN_INTERVAL"],
        default_interface=current_app.config["DEFAULT_INTERFACE"],
    )


@bp.get("/scan/status")
def scan_status():
    settings = _settings()
    status = monitoring_service.status()
    status.update(
        {
            "scanInterval": FIXED_SCAN_INTERVAL_SECONDS,
            "scanIntervalSeconds": FIXED_SCAN_INTERVAL_SECONDS,
            "monitoringEnabled": settings.monitoring_enabled,
            "setupRequired": setup_service.is_setup_required(),
        }
    )
    return jsonify(status)


@bp.post("/scan/trigger")
def trigger_scan():
    """Wake the one real monitoring loop now instead of waiting out the interval.

    This does not start a second scanner - if monitoring is stopped or a scan
    is already running, it says so instead of pretending something happened.
    """
    settings = _settings()
    if not settings.monitoring_enabled or not monitoring_service.is_running:
        return jsonify({"success": False, "error": "Monitoring is not running"}), 409

    triggered = monitoring_service.trigger_scan_now()
    if not triggered:
        return jsonify({"success": False, "error": "A scan is already in progress"}), 409

    return jsonify({"success": True, "status": monitoring_service.status()["status"]})


@bp.get("/settings")
def get_settings():
    return jsonify(_settings().to_dict())


@bp.put("/settings")
def update_settings():
    payload = request.get_json(silent=True) or {}
    settings = _settings()

    # Accept both camelCase (dashboard) and snake_case (scripts/curl).
    interval = payload.get("scanInterval", payload.get("scan_interval"))
    if interval is not None:
        try:
            interval = int(interval)
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "scanInterval must be an integer"}), 400
        if not MIN_INTERVAL <= interval <= MAX_INTERVAL:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": f"scanInterval must be between {MIN_INTERVAL} and {MAX_INTERVAL} seconds",
                    }
                ),
                400,
            )
        settings.scan_interval = interval

    interface = payload.get("interface")
    if interface is not None:
        settings.interface = (interface or "").strip() or None

    enabled = payload.get("monitoringEnabled", payload.get("monitoring_enabled"))
    if enabled is not None:
        settings.monitoring_enabled = bool(enabled)

    alert_on_open = payload.get("alertOnOpenNetworks", payload.get("alert_on_open_networks"))
    if alert_on_open is not None:
        settings.alert_on_open_networks = bool(alert_on_open)

    alert_on_wep = payload.get("alertOnWep", payload.get("alert_on_wep"))
    if alert_on_wep is not None:
        settings.alert_on_wep = bool(alert_on_wep)

    rogue_detection = payload.get("rogueDetectionEnabled", payload.get("rogue_detection_enabled"))
    if rogue_detection is not None:
        settings.rogue_detection_enabled = bool(rogue_detection)

    db.session.commit()

    # The loop re-reads settings each cycle; starting/stopping here makes the
    # change take effect immediately rather than after the current wait.
    if settings.monitoring_enabled and not monitoring_service.is_running:
        monitoring_service.start()

    return jsonify({"success": True, "data": settings.to_dict()})


@bp.post("/monitoring/start")
def start_monitoring():
    settings = _settings()
    settings.monitoring_enabled = True
    db.session.commit()

    started = monitoring_service.start()
    return jsonify(
        {
            "success": True,
            "started": started,
            "alreadyRunning": not started,
            "status": monitoring_service.status()["status"],
        }
    )


@bp.post("/monitoring/stop")
def stop_monitoring():
    settings = _settings()
    settings.monitoring_enabled = False
    db.session.commit()

    monitoring_service.stop()
    return jsonify({"success": True, "status": monitoring_service.status()["status"]})
