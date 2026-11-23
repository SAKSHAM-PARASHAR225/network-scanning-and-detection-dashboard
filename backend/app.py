import logging

from flask import Flask, jsonify

from api import register_blueprints
from config import Config
from extensions import cors, db, migrate, socketio
from services import setup_service
from services.monitoring_service import monitoring_service
from services.signal_monitor import signal_monitor
from sockets import events


def create_app(config_object=Config, start_monitoring=None):
    app = Flask(__name__)
    app.config.from_object(config_object)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    socketio.init_app(app, cors_allowed_origins=app.config["CORS_ORIGINS"])

    import models  # noqa: F401  (registers the mappers with SQLAlchemy)

    register_blueprints(app)
    _register_error_handlers(app)
    _register_socket_handlers(app)

    monitoring_service.init_app(app)

    should_start = app.config["AUTO_START_MONITORING"] if start_monitoring is None else start_monitoring
    if should_start:
        monitoring_service.start()

    return app


def _register_error_handlers(app):
    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"success": False, "error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(error):
        app.logger.exception("Unhandled server error: %s", error)
        return jsonify({"success": False, "error": "Internal server error"}), 500


def _register_socket_handlers(app):
    @socketio.on("disconnect")
    def handle_disconnect(*_args):
        signal_monitor.client_disconnected()

    @socketio.on("connect")
    def handle_connect(_auth=None):
        """Push current state to a newly connected dashboard.

        Clients get the live picture on connect rather than waiting for the
        next scan cycle. Connecting never starts a scan - the single
        monitoring loop owns that.
        """
        signal_monitor.client_connected()
        with app.app_context():
            status = monitoring_service.status()
            events.broadcast_scanner_status(
                status["status"],
                last_scan=status["last_scan"],
                next_scan=status["next_scan"],
                interface=status["interface"],
                scan_interval=status["scanIntervalSeconds"],
            )

            count = setup_service.trusted_count()
            events.broadcast_setup_required(count == 0, count)
