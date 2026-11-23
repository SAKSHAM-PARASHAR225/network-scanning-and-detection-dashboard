"""Outbound Socket.IO broadcasts.

All emits go through here so payload shapes stay in one place and match what
the React dashboard subscribes to.
"""

from datetime import datetime, timezone

from extensions import socketio


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def broadcast_network_update(networks):
    """networks: list of Network.to_dict() payloads."""
    socketio.emit("network_update", {"networks": networks})


def broadcast_signal_update(network_id, ssid, bssid, signal, timestamp=None):
    socketio.emit(
        "signal_update",
        {
            "network_id": network_id,
            "networkId": network_id,
            "ssid": ssid,
            "bssid": bssid,
            "signal": signal,
            "timestamp": timestamp or _now_iso(),
        },
    )


def broadcast_signal_tick(timestamp, readings):
    """readings: [{"bssid": str, "signal": int dBm}, ...] from one cache read."""
    socketio.emit("signal_tick", {"timestamp": timestamp, "readings": readings})


def broadcast_alert_created(alert_payload):
    socketio.emit("alert_created", alert_payload)


def broadcast_scan_started(scan_payload):
    socketio.emit("scan_started", scan_payload)


def broadcast_scan_completed(scan_payload):
    socketio.emit("scan_completed", {"scan": scan_payload, **scan_payload})


def broadcast_scanner_status(status, last_scan=None, next_scan=None, interface=None,
                             scan_interval=None, message=None):
    payload = {
        "status": status,
        "last_scan": last_scan,
        "next_scan": next_scan,
        "interface": interface,
        # camelCase aliases so the existing React client reads the same values.
        "lastScanAt": last_scan,
        "nextScanAt": next_scan,
        "interfaceName": interface,
        "scanIntervalSeconds": scan_interval,
    }
    if message:
        payload["message"] = message
    socketio.emit("scanner_status", payload)


def broadcast_setup_required(setup_required, trusted_network_count):
    """Tells connected clients whether first-run baseline setup is pending."""
    socketio.emit(
        "setup_status",
        {"setup_required": setup_required, "trusted_network_count": trusted_network_count},
    )
