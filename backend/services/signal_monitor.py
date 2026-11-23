"""1-second live signal feed.

Runs independently of the 10-second scan loop. Each tick reads the operating
system's current per-BSSID signal table (no forced sweep, no database writes)
and pushes it to dashboards as `signal_tick`. The persisted history still comes
only from the full scans.

Only one loop exists per process, and it does no work while no dashboard is
connected or while monitoring isn't actively running.
"""

import logging
import threading
import time
from datetime import datetime, timezone

from extensions import socketio
from models import ScannerState
from scanner import ScannerError
from sockets import events

log = logging.getLogger(__name__)

SIGNAL_TICK_SECONDS = 1.0
_INACTIVE_STATES = {ScannerState.WAITING_FOR_SETUP.value, ScannerState.OFFLINE.value}


class SignalMonitor:
    def __init__(self):
        self._lock = threading.Lock()
        self._thread = None
        self._stop_event = threading.Event()
        self._clients = 0
        self._monitoring = None

    def client_connected(self):
        with self._lock:
            self._clients += 1

    def client_disconnected(self):
        with self._lock:
            self._clients = max(0, self._clients - 1)

    def start(self, monitoring):
        """Idempotent: a second call while running does nothing."""
        with self._lock:
            self._monitoring = monitoring
            if self._thread is not None and self._thread.is_alive():
                return False
            self._stop_event.clear()
            self._thread = socketio.start_background_task(self._run)
            log.info("Signal monitor started (%.0fs tick)", SIGNAL_TICK_SECONDS)
            return True

    def stop(self):
        self._stop_event.set()

    def _should_read(self):
        monitoring = self._monitoring
        return (
            self._clients > 0
            and monitoring is not None
            and monitoring.is_running
            and monitoring.state not in _INACTIVE_STATES
        )

    def _run(self):
        next_tick = time.monotonic()
        while not self._stop_event.is_set():
            if self._should_read():
                self._tick()

            # Fixed-rate schedule; if a read overran, skip the missed ticks
            # rather than firing several back-to-back.
            next_tick += SIGNAL_TICK_SECONDS
            delay = next_tick - time.monotonic()
            if delay < 0:
                next_tick = time.monotonic()
                delay = 0
            self._stop_event.wait(delay)

    def _tick(self):
        try:
            records = self._monitoring.read_signal_cache()
        except ScannerError as exc:
            log.debug("Signal cache read failed: %s", exc)
            return
        if records is None:
            return

        readings = [
            {"bssid": record["bssid"], "signal": record["signal_dbm"]}
            for record in records
            if record.get("bssid") and record.get("signal_dbm") is not None
        ]
        events.broadcast_signal_tick(datetime.now(timezone.utc).isoformat(), readings)


signal_monitor = SignalMonitor()
