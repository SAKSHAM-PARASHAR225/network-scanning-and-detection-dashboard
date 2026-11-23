"""Scan session history."""

from flask import Blueprint, jsonify, request

from extensions import db
from models import ScanSession

bp = Blueprint("scans", __name__, url_prefix="/api/scans")

DEFAULT_LIMIT = 50
MAX_LIMIT = 500


@bp.get("")
def list_scans():
    try:
        limit = int(request.args.get("limit", DEFAULT_LIMIT))
    except ValueError:
        limit = DEFAULT_LIMIT
    limit = max(1, min(MAX_LIMIT, limit))

    status = request.args.get("status")
    query = db.session.query(ScanSession)
    if status:
        query = query.filter(ScanSession.status == status.strip().upper())

    sessions = query.order_by(ScanSession.started_at.desc()).limit(limit).all()
    return jsonify([session.to_dict() for session in sessions])


@bp.get("/<int:scan_id>")
def get_scan(scan_id):
    session = db.session.get(ScanSession, scan_id)
    if session is None:
        return jsonify({"success": False, "error": "Scan session not found"}), 404
    return jsonify(session.to_dict())
