"""First-run baseline setup endpoints."""

from flask import Blueprint, jsonify, request

from scanner import ScannerError
from services import setup_service
from services.monitoring_service import monitoring_service
from sockets import events

bp = Blueprint("setup", __name__, url_prefix="/api/setup")


@bp.get("/status")
def setup_status():
    count = setup_service.trusted_count()
    return jsonify({"setup_required": count == 0, "trusted_network_count": count})


@bp.get("/discovered-networks")
def discovered_networks():
    """Live view of what is actually in the air, for the setup screen.

    Uses the most recent discovery scan when one is fresh, otherwise runs a
    real scan now. Never returns invented networks.
    """
    cached = setup_service.get_last_discovery()

    if not cached["records"]:
        try:
            records = monitoring_service.run_single_discovery()
        except ScannerError as exc:
            return jsonify({"success": False, "error": str(exc), "data": []}), 503
    else:
        records = cached["records"]

    return jsonify(
        {
            "success": True,
            "data": [
                {
                    "ssid": r.get("ssid"),
                    "bssid": r.get("bssid"),
                    "signal": r.get("signal_dbm"),
                    "channel": r.get("channel"),
                    "frequency": r.get("frequency"),
                    "band": r.get("band"),
                    "encryption": r.get("encryption"),
                }
                for r in records
            ],
        }
    )


@bp.post("/rescan")
def rescan():
    try:
        records = monitoring_service.run_single_discovery()
    except ScannerError as exc:
        return jsonify({"success": False, "error": str(exc), "data": []}), 503

    return jsonify({"success": True, "count": len(records)})


@bp.post("/verify")
def verify():
    payload = request.get_json(silent=True) or {}
    bssids = payload.get("bssids") or []
    location = payload.get("location")

    if not isinstance(bssids, list) or not bssids:
        return jsonify({"success": False, "error": "Provide a non-empty 'bssids' array"}), 400

    result = setup_service.verify_bssids(bssids, location=location)
    if result["error"]:
        return jsonify({"success": False, "error": result["error"]}), 400

    count = setup_service.trusted_count()
    events.broadcast_setup_required(count == 0, count)

    # The baseline now exists, so continuous monitoring can take over.
    monitoring_service.start()
    monitoring_service.notify_setup_complete()

    return jsonify(
        {
            "success": True,
            "verified": [ap.to_dict() for ap in result["verified"]],
            "skipped": result["skipped"],
            "setup_required": count == 0,
            "trusted_network_count": count,
        }
    )


@bp.post("/reset")
def reset():
    removed = setup_service.reset_baseline()
    events.broadcast_setup_required(True, 0)
    return jsonify({"success": True, "removed": removed, "setup_required": True})
