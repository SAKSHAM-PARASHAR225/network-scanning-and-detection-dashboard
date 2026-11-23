"""Liveness / readiness."""

from datetime import datetime, timezone

from flask import Blueprint, jsonify
from sqlalchemy import text

from extensions import db
from services import setup_service
from services.monitoring_service import monitoring_service

bp = Blueprint("health", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    database = "connected"
    setup_required = None
    try:
        db.session.execute(text("SELECT 1"))
        setup_required = setup_service.is_setup_required()
    except Exception as exc:  # surface the failure instead of reporting healthy
        database = f"error: {exc.__class__.__name__}"

    status = monitoring_service.status()
    scanner = "running" if status["running"] else status["status"].lower()

    payload = {
        "success": database == "connected",
        "backend": "online",
        "database": database,
        "scanner": scanner,
        "scannerStatus": status["status"],
        "setup_required": setup_required,
        "interface": status["interface"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if status["error"]:
        payload["scannerError"] = status["error"]

    return jsonify(payload), 200 if payload["success"] else 503
