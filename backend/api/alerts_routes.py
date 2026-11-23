"""Security alert endpoints."""

from flask import Blueprint, jsonify, request

from extensions import db
from models import Alert
from services import alert_service

bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")


@bp.get("")
def list_alerts():
    query = db.session.query(Alert)

    severity = request.args.get("severity")
    if severity:
        query = query.filter(Alert.severity == severity.strip().upper())

    status = request.args.get("status")
    if status:
        query = query.filter(Alert.status == status.strip().upper())

    alert_type = request.args.get("type")
    if alert_type:
        query = query.filter(Alert.type == alert_type.strip().upper())

    alerts = query.order_by(Alert.created_at.desc()).all()
    return jsonify([alert.to_dict() for alert in alerts])


@bp.get("/<int:alert_id>")
def get_alert(alert_id):
    alert = db.session.get(Alert, alert_id)
    if alert is None:
        return jsonify({"success": False, "error": "Alert not found"}), 404
    return jsonify(alert.to_dict())


@bp.post("/<int:alert_id>/resolve")
def resolve(alert_id):
    alert = alert_service.resolve_alert(alert_id)
    if alert is None:
        return jsonify({"success": False, "error": "Alert not found"}), 404

    db.session.commit()
    return jsonify({"success": True, "data": alert.to_dict()})
