"""Network inventory endpoints.

Returns bare arrays/objects (not an envelope) because the React dashboard
consumes these directly as its network and signal-history models.
"""

from flask import Blueprint, jsonify, request

from extensions import db
from models import Network, SignalReading

bp = Blueprint("networks", __name__, url_prefix="/api/networks")

DEFAULT_SIGNAL_LIMIT = 60
MAX_SIGNAL_LIMIT = 1000


@bp.get("")
def list_networks():
    query = db.session.query(Network)

    status = request.args.get("status")
    if status:
        query = query.filter(Network.security_status == status.strip().upper())

    band = request.args.get("band")
    if band:
        # Accept "5", "5 GHz" and "5GHz" alike.
        normalized = band.strip().lower().replace("ghz", "").strip()
        query = query.filter(Network.band.ilike(f"{normalized}%"))

    ssid = request.args.get("ssid")
    if ssid:
        query = query.filter(Network.ssid == ssid)

    if request.args.get("visible") in {"1", "true", "True"}:
        query = query.filter(Network.is_currently_visible.is_(True))

    networks = query.order_by(
        Network.is_currently_visible.desc(), Network.last_seen.desc()
    ).all()
    return jsonify([network.to_dict() for network in networks])


@bp.get("/<int:network_id>")
def get_network(network_id):
    network = db.session.get(Network, network_id)
    if network is None:
        return jsonify({"success": False, "error": "Network not found"}), 404
    return jsonify(network.to_dict())


@bp.get("/<int:network_id>/signals")
def get_network_signals(network_id):
    network = db.session.get(Network, network_id)
    if network is None:
        return jsonify({"success": False, "error": "Network not found"}), 404

    try:
        limit = int(request.args.get("limit", DEFAULT_SIGNAL_LIMIT))
    except ValueError:
        limit = DEFAULT_SIGNAL_LIMIT
    limit = max(1, min(MAX_SIGNAL_LIMIT, limit))

    readings = (
        db.session.query(SignalReading)
        .filter(SignalReading.network_id == network_id)
        .order_by(SignalReading.timestamp.desc())
        .limit(limit)
        .all()
    )

    # Oldest first so the chart can plot straight through.
    return jsonify(
        {
            "networkId": network.id,
            "ssid": network.ssid,
            "bssid": network.bssid,
            "readings": [reading.to_dict() for reading in reversed(readings)],
        }
    )
