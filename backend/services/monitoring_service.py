"""The continuous monitoring loop.

Exactly one instance of this loop runs per backend process, regardless of how
many dashboards are open. Browsers are subscribers; they never drive scanning.

    create scan session -> scan -> analyze -> persist -> broadcast -> wait
"""

import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import SQLAlchemyError

from analyzer import analyze_network, detect_signal_anomaly
from extensions import db, socketio
from models import (
    Network,
    ScanSession,
    ScanSettings,
    ScanStatus,
    ScannerState,
    SecurityStatus,
    SignalReading,
)
from scanner import ScannerError, ScannerUnavailableError, detect_interface, get_scanner
from services import alert_service, setup_service
from services.signal_monitor import signal_monitor
from sockets import events

log = logging.getLogger(__name__)

NETWORK_BROADCAST_LIMIT = 250

# The scan cadence is fixed by design. ScanSettings.scan_interval is still
# stored and accepted by the API for compatibility, but the loop ignores it.
FIXED_SCAN_INTERVAL_SECONDS = 10


def _utcnow():
    return datetime.now(timezone.utc)


class MonitoringService:
    """Owns the scan loop. Start/stop are idempotent and thread-safe."""

    def __init__(self):
        self._app = None
        self._thread = None
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._trigger_event = threading.Event()
        self._state = ScannerState.OFFLINE.value
        self._last_scan_at = None
        self._next_scan_at = None
        self._interface = None
        self._scan_interval = FIXED_SCAN_INTERVAL_SECONDS
        self._last_error = None
        self._scanner = None

    # -- lifecycle ------------------------------------------------------

    def init_app(self, app):
        self._app = app
        self._interface = app.config["DEFAULT_INTERFACE"] or None

        # The schema may not exist yet (first boot, or a `flask db` command
        # running before `upgrade`). Fall back to config defaults; the loop
        # re-reads settings from the database every cycle once it is there.
        with app.app_context():
            try:
                settings = ScanSettings.get_or_create(
                    default_interval=app.config["DEFAULT_SCAN_INTERVAL"],
                    default_interface=app.config["DEFAULT_INTERFACE"],
                )
                self._interface = settings.interface or self._interface
            except SQLAlchemyError:
                db.session.rollback()
                log.warning(
                    "scan_settings is unavailable (has `flask db upgrade` run?); "
                    "using configured defaults until the schema exists"
                )
            finally:
                db.session.remove()

        self._resolve_interface()

    def trigger_scan_now(self):
        """Wake the loop immediately instead of waiting out the current interval.

        Used by the dashboard's "Scan Now" button - it does not start a second
        scanner, it just asks the one real loop to run its next cycle now.
        Returns False if a scan is already in flight (SCANNING state) or the
        loop isn't running, so the caller can say why nothing happened.
        """
        if not self.is_running:
            return False
        if self._state == ScannerState.SCANNING.value:
            return False
        self._trigger_event.set()
        return True

    def notify_setup_complete(self):
        """Push an immediate status update once a trusted baseline is saved.

        Without this, the dashboard keeps showing WAITING_FOR_SETUP until the
        next scan tick (up to scan_interval seconds later) overwrites the
        stale scanner_status broadcast from the discovery loop.
        """
        if self._state == ScannerState.WAITING_FOR_SETUP.value:
            self._set_state(ScannerState.IDLE.value)

    def start(self):
        """Start the loop if it is not already running. Safe to call repeatedly."""
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                log.info("Monitoring service already running; not starting a second loop")
                return False

            self._stop_event.clear()
            self._set_state(ScannerState.STARTING.value)
            self._thread = socketio.start_background_task(self._run)
            signal_monitor.start(self)
            log.info("Monitoring service started")
            return True

    def stop(self):
        with self._lock:
            self._stop_event.set()
            self._set_state(ScannerState.IDLE.value)
            log.info("Monitoring service stop requested")
            return True

    @property
    def is_running(self):
        return self._thread is not None and self._thread.is_alive() and not self._stop_event.is_set()

    # -- status ---------------------------------------------------------

    def status(self):
        return {
            "status": self._state,
            "last_scan": self._last_scan_at.isoformat() if self._last_scan_at else None,
            "next_scan": self._next_scan_at.isoformat() if self._next_scan_at else None,
            "interface": self._interface,
            "lastScanAt": self._last_scan_at.isoformat() if self._last_scan_at else None,
            "nextScanAt": self._next_scan_at.isoformat() if self._next_scan_at else None,
            "interfaceName": self._interface,
            "scanIntervalSeconds": self._scan_interval,
            "running": self.is_running,
            "error": self._last_error,
        }

    def _set_state(self, state, message=None):
        self._state = state
        events.broadcast_scanner_status(
            state,
            last_scan=self._last_scan_at.isoformat() if self._last_scan_at else None,
            next_scan=self._next_scan_at.isoformat() if self._next_scan_at else None,
            interface=self._interface,
            scan_interval=self._scan_interval,
            message=message,
        )

    def _resolve_interface(self):
        """Ask the active scanner what wireless interface it is using."""
        try:
            scanner = self._get_scanner()
            detected = detect_interface(scanner)
            if detected:
                self._interface = detected
        except ScannerError as exc:
            self._last_error = str(exc)

    def _get_scanner(self):
        if self._scanner is None:
            backend = self._app.config["SCANNER_BACKEND"] if self._app else "auto"
            self._scanner = get_scanner(backend, interface=self._interface)
        return self._scanner

    # -- main loop ------------------------------------------------------

    def _run(self):
        while not self._stop_event.is_set():
            # Cycles are scheduled start-to-start, so a scan that takes 6s is
            # followed by a 4s wait rather than a full 10s one. Setting
            # next_scan_at up front means every status broadcast during this
            # cycle already carries the real time the next one will begin.
            cycle_started = time.monotonic()
            self._next_scan_at = _utcnow() + timedelta(seconds=self._scan_interval)
            try:
                # db.session is bound to the app context, so it must be
                # released inside the context that created it.
                with self._app.app_context():
                    try:
                        self._tick()
                    finally:
                        db.session.remove()
            except Exception:  # keep the loop alive across unexpected failures
                log.exception("Unhandled error in monitoring loop")
                self._last_error = "Unhandled error in monitoring loop"
                self._set_state(ScannerState.ERROR.value)

            remaining = self._scan_interval - (time.monotonic() - cycle_started)
            if remaining <= 0:
                # The scan overran the interval: start the next one right away
                # instead of stacking a second scan on top of this one.
                continue
            self._wait_for_next_cycle(remaining)

        self._set_state(ScannerState.IDLE.value)

    def _wait_for_next_cycle(self, wait_seconds):
        """Sleep until the interval elapses, stop is requested, or a manual
        trigger arrives - whichever comes first. Polling in short slices (Event
        objects can't be waited on together) keeps "Scan Now" responsive
        without adding a second thread or a race on the deadline."""
        deadline = time.monotonic() + wait_seconds
        while time.monotonic() < deadline:
            if self._stop_event.is_set():
                return
            if self._trigger_event.is_set():
                self._trigger_event.clear()
                return
            time.sleep(min(0.25, max(0.0, deadline - time.monotonic())))

    def _tick(self):
        """One pass of the loop."""
        settings = ScanSettings.get_or_create(
            default_interval=self._app.config["DEFAULT_SCAN_INTERVAL"],
            default_interface=self._app.config["DEFAULT_INTERFACE"],
        )
        if settings.interface and settings.interface != self._interface:
            self._interface = settings.interface
            self._scanner = None  # rebuild against the new interface

        if not settings.monitoring_enabled:
            self._set_state(ScannerState.IDLE.value, message="Monitoring is disabled in settings")
            return

        # No trusted baseline yet: keep discovering so the setup screen has
        # live results, but do not classify anything as rogue.
        if setup_service.is_setup_required():
            self._discovery_tick()
            return

        self._scan_cycle(settings.to_analyzer_flags())

    def read_signal_cache(self):
        """Cheap read of the OS's current per-BSSID signal values, used by the
        1-second signal monitor. Returns None when the active scanner can't do
        this, so the monitor stays idle instead of guessing."""
        return self._get_scanner().read_cached()

    @property
    def state(self):
        return self._state

    def _discovery_tick(self):
        self._set_state(
            ScannerState.WAITING_FOR_SETUP.value,
            message="Waiting for an administrator to verify the trusted baseline",
        )
        try:
            scanner = self._get_scanner()
            records = setup_service.run_discovery(scanner)
            self._last_error = None
            events.broadcast_setup_required(True, setup_service.trusted_count())
            log.info("Discovery scan found %d access points (awaiting verification)", len(records))
        except ScannerError as exc:
            self._last_error = str(exc)
            self._set_state(ScannerState.ERROR.value, message=str(exc))
            log.error("Discovery scan failed: %s", exc)

    def _scan_cycle(self, analyzer_flags=None):
        session = ScanSession(started_at=_utcnow(), status=ScanStatus.RUNNING.value)
        db.session.add(session)
        db.session.commit()

        events.broadcast_scan_started(session.to_dict())
        self._set_state(ScannerState.SCANNING.value)

        started = _utcnow()
        try:
            scanner = self._get_scanner()
            records = scanner.scan()
            self._last_error = None
        except ScannerUnavailableError as exc:
            self._fail_session(session, started, str(exc))
            self._last_error = str(exc)
            self._set_state(ScannerState.ERROR.value, message=str(exc))
            log.error("Scan unavailable: %s", exc)
            return
        except ScannerError as exc:
            self._fail_session(session, started, str(exc))
            self._last_error = str(exc)
            self._set_state(ScannerState.ERROR.value, message=str(exc))
            log.error("Scan failed: %s", exc)
            return

        new_alerts, status_counts = self._process_results(records, analyzer_flags)

        session.completed_at = _utcnow()
        session.duration = (session.completed_at - started).total_seconds()
        session.networks_found = len(records)
        session.alerts_generated = len(new_alerts)
        # Grouped the same way the rest of the dashboard colors these statuses:
        # UNVERIFIED/SUSPICIOUS read as "suspicious" (amber), ROGUE and
        # POSSIBLE_EVIL_TWIN both read as "critical" (red).
        session.verified_count = status_counts["VERIFIED"]
        session.suspicious_count = status_counts["UNVERIFIED"] + status_counts["SUSPICIOUS"]
        session.rogue_count = status_counts["ROGUE"] + status_counts["POSSIBLE_EVIL_TWIN"]
        session.status = ScanStatus.COMPLETED.value
        db.session.commit()

        self._last_scan_at = session.completed_at

        for payload in new_alerts:
            events.broadcast_alert_created(payload)

        events.broadcast_network_update(self._network_payloads())
        events.broadcast_scan_completed(session.to_dict())
        self._set_state(ScannerState.IDLE.value)

        log.info(
            "Scan %s complete: %d networks, %d new alerts, %.2fs",
            session.to_dict()["scanId"], len(records), len(new_alerts), session.duration or 0.0,
        )

    def _fail_session(self, session, started, error):
        session.completed_at = _utcnow()
        session.duration = (session.completed_at - started).total_seconds()
        session.status = ScanStatus.FAILED.value
        session.error = error
        db.session.commit()
        events.broadcast_scan_completed(session.to_dict())

    def _process_results(self, records, analyzer_flags=None):
        """Persist one scan's worth of results.

        Returns (new_alert_payloads, status_counts) - status_counts tallies
        this cycle's classifications for the ScanSession row.
        """
        trusted_data = setup_service.get_trusted_data()
        history_limit = self._app.config["SIGNAL_HISTORY_LIMIT"]
        now = _utcnow()
        seen_bssids = []
        new_alert_payloads = []
        status_counts = {status.value: 0 for status in SecurityStatus}

        for record in records:
            bssid = record.get("bssid")
            if not bssid:
                continue
            seen_bssids.append(bssid)

            network = db.session.query(Network).filter(Network.bssid == bssid).first()
            if network is None:
                network = Network(bssid=bssid, ssid=record.get("ssid") or "", first_seen=now)
                db.session.add(network)
                db.session.flush()

            network.ssid = record.get("ssid") or ""
            network.channel = record.get("channel")
            network.frequency = record.get("frequency")
            network.band = record.get("band")
            network.encryption = record.get("encryption")
            network.signal_dbm = record.get("signal_dbm")
            network.last_seen = now
            network.is_currently_visible = True

            history = self._signal_history(network.id)

            if record.get("signal_dbm") is not None:
                db.session.add(
                    SignalReading(
                        network_id=network.id,
                        signal_dbm=record["signal_dbm"],
                        timestamp=now,
                    )
                )
                history.append(record["signal_dbm"])
                if history_limit:
                    self._trim_signal_history(network.id, history_limit)

            result = analyze_network(record, trusted_data, history, analyzer_flags)
            network.security_status = result.security_status
            network.risk_score = result.risk_score
            network.risk_level = result.risk_level
            status_counts[result.security_status] = status_counts.get(result.security_status, 0) + 1

            intents = list(result.alerts)
            anomaly = detect_signal_anomaly(network.ssid, network.bssid, history)
            if anomaly is not None:
                intents.append(anomaly)

            for intent in intents:
                alert, created = alert_service.upsert_alert(network, intent)
                if created:
                    db.session.flush()
                    new_alert_payloads.append(alert.to_dict())

            events.broadcast_signal_update(
                network.id, network.ssid, network.bssid, network.signal_dbm, now.isoformat()
            )

        self._mark_missing_networks(seen_bssids)
        db.session.commit()
        return new_alert_payloads, status_counts

    @staticmethod
    def _signal_history(network_id, limit=60):
        rows = (
            db.session.query(SignalReading.signal_dbm)
            .filter(SignalReading.network_id == network_id)
            .order_by(SignalReading.timestamp.desc())
            .limit(limit)
            .all()
        )
        return [row[0] for row in reversed(rows)]

    @staticmethod
    def _trim_signal_history(network_id, keep):
        """Retention cap. Disabled by default (SIGNAL_HISTORY_LIMIT=0)."""
        cutoff = (
            db.session.query(SignalReading.id)
            .filter(SignalReading.network_id == network_id)
            .order_by(SignalReading.timestamp.desc())
            .offset(keep)
            .limit(1)
            .first()
        )
        if cutoff is None:
            return
        db.session.query(SignalReading).filter(
            SignalReading.network_id == network_id,
            SignalReading.id <= cutoff[0],
        ).delete(synchronize_session=False)

    @staticmethod
    def _mark_missing_networks(seen_bssids):
        """APs that dropped out of range stay in the database, just not visible."""
        query = db.session.query(Network).filter(Network.is_currently_visible.is_(True))
        if seen_bssids:
            query = query.filter(~Network.bssid.in_(seen_bssids))
        query.update({Network.is_currently_visible: False}, synchronize_session=False)

    @staticmethod
    def _network_payloads():
        networks = (
            db.session.query(Network)
            .order_by(Network.is_currently_visible.desc(), Network.last_seen.desc())
            .limit(NETWORK_BROADCAST_LIMIT)
            .all()
        )
        return [network.to_dict() for network in networks]

    # -- one-shot scans used by the setup endpoints ---------------------

    def run_single_discovery(self):
        """Run one discovery scan on demand (setup screen rescan)."""
        scanner = self._get_scanner()
        records = setup_service.run_discovery(scanner)
        self._last_scan_at = _utcnow()
        return records


monitoring_service = MonitoringService()
