"""CRUD for the administrator-approved trusted baseline."""

from flask import Blueprint, jsonify, request

from extensions import db
from models import TrustedAccessPoint
from services import setup_service

bp = Blueprint("trusted_aps", __name__, url_prefix="/api/trusted-aps")


@bp.get("")
def list_trusted():
    rows = (
        db.session.query(TrustedAccessPoint)
        .order_by(TrustedAccessPoint.ssid.asc(), TrustedAccessPoint.bssid.asc())
        .all()
    )
    return jsonify([row.to_dict() for row in rows])


@bp.post("")
def create_trusted():
    payload = request.get_json(silent=True) or {}
    bssid = (payload.get("bssid") or "").strip().lower()

    if not bssid:
        return jsonify({"success": False, "error": "bssid is required"}), 400

    existing = db.session.query(TrustedAccessPoint).filter(TrustedAccessPoint.bssid == bssid).first()
    if existing is not None:
        return jsonify({"success": False, "error": "BSSID is already trusted"}), 409

    trusted = TrustedAccessPoint(
        bssid=bssid,
        ssid=(payload.get("ssid") or "").strip(),
        channel=payload.get("channel"),
        frequency=payload.get("frequency"),
        band=payload.get("band"),
        encryption=payload.get("encryption"),
        location=payload.get("location"),
        active=bool(payload.get("active", True)),
    )
    db.session.add(trusted)
    db.session.commit()

    setup_service.mark_network_verified(bssid)
    db.session.commit()

    return jsonify({"success": True, "data": trusted.to_dict()}), 201


@bp.put("/<int:trusted_id>")
def update_trusted(trusted_id):
    trusted = db.session.get(TrustedAccessPoint, trusted_id)
    if trusted is None:
        return jsonify({"success": False, "error": "Trusted access point not found"}), 404

    payload = request.get_json(silent=True) or {}
    for field in ("ssid", "channel", "frequency", "band", "encryption", "location"):
        if field in payload:
            setattr(trusted, field, payload[field])
    if "active" in payload:
        trusted.active = bool(payload["active"])

    db.session.commit()
    return jsonify({"success": True, "data": trusted.to_dict()})


@bp.delete("/<int:trusted_id>")
def delete_trusted(trusted_id):
    trusted = db.session.get(TrustedAccessPoint, trusted_id)
    if trusted is None:
        return jsonify({"success": False, "error": "Trusted access point not found"}), 404

    db.session.delete(trusted)
    db.session.commit()
    return jsonify({"success": True, "deleted": trusted_id})
