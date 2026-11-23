"""Windows Wi-Fi scanner built on `netsh wlan show networks mode=bssid`.

This is a real scan performed by the OS against the physical adapter. It needs
no monitor mode and no extra drivers, but it only reports APs that Windows
itself surfaces, and it gives link quality as a percentage rather than dBm.
"""

import logging
import platform
import re
import time

from scanner.base import BaseScanner, ScannerError, ScannerUnavailableError
from scanner.wlan_api import SCAN_SETTLE_SECONDS, request_scan

log = logging.getLogger(__name__)

_SSID_RE = re.compile(r"^SSID\s+(\d+)\s*:\s*(.*)$", re.IGNORECASE)
_BSSID_RE = re.compile(r"^\s*BSSID\s+\d+\s*:\s*([0-9a-fA-F:]{17})\s*$", re.IGNORECASE)
_AUTH_RE = re.compile(r"^\s*Authentication\s*:\s*(.*)$", re.IGNORECASE)
_CIPHER_RE = re.compile(r"^\s*Encryption\s*:\s*(.*)$", re.IGNORECASE)
_SIGNAL_RE = re.compile(r"^\s*Signal\s*:\s*(\d+)\s*%", re.IGNORECASE)
_CHANNEL_RE = re.compile(r"^\s*Channel\s*:\s*(\d+)", re.IGNORECASE)
_BAND_RE = re.compile(r"^\s*Band\s*:\s*(.*)$", re.IGNORECASE)
_IFACE_NAME_RE = re.compile(r"^\s*Name\s*:\s*(.*)$", re.IGNORECASE)
_IFACE_STATE_RE = re.compile(r"^\s*State\s*:\s*(.*)$", re.IGNORECASE)


class NetshScanner(BaseScanner):
    name = "netsh"

    def __init__(self, interface=None, force_scan=True):
        super().__init__(interface=interface)
        # Without this, netsh returns Windows' throttled cache, which decays to
        # just the associated AP while connected.
        self.force_scan = force_scan

    def is_available(self):
        return platform.system() == "Windows" and self._which("netsh") is not None

    def detect_interface(self):
        """Return the name of the first wireless interface netsh reports."""
        try:
            output = self._run(["netsh", "wlan", "show", "interfaces"], timeout=20)
        except ScannerError:
            return None

        for line in output.splitlines():
            match = _IFACE_NAME_RE.match(line)
            if match:
                return match.group(1).strip()
        return None

    def interface_state(self):
        try:
            output = self._run(["netsh", "wlan", "show", "interfaces"], timeout=20)
        except ScannerError:
            return None
        for line in output.splitlines():
            match = _IFACE_STATE_RE.match(line)
            if match:
                return match.group(1).strip()
        return None

    def scan(self):
        if platform.system() != "Windows":
            raise ScannerUnavailableError(
                "NetshScanner only runs on Windows; this host is " + platform.system()
            )
        if self._which("netsh") is None:
            raise ScannerUnavailableError("netsh was not found on PATH")

        if self.force_scan:
            triggered, detail = request_scan(self.interface)
            if triggered:
                # WlanScan is asynchronous; give the driver time to finish
                # before reading the refreshed cache.
                time.sleep(SCAN_SETTLE_SECONDS)
            else:
                log.debug("Could not force a fresh scan (%s); reading cached results", detail)

        return self._read_networks(timeout=60)

    def read_cached(self):
        """Current OS cache only - no WlanScan, no settle delay. Fast enough to
        call every second. Windows refreshes the connected AP's signal
        continuously; neighbours refresh whenever the adapter sweeps."""
        if platform.system() != "Windows" or self._which("netsh") is None:
            return None
        return self._read_networks(timeout=5)

    def _read_networks(self, timeout):
        command = ["netsh", "wlan", "show", "networks", "mode=bssid"]
        if self.interface:
            command.append(f"interface={self.interface}")

        output = self._run(command, timeout=timeout)

        if "wireless" in output.lower() and "not running" in output.lower():
            raise ScannerUnavailableError(
                "The Windows WLAN AutoConfig service is not running, so no scan is possible"
            )
        if "no interface" in output.lower() or "there is no wireless interface" in output.lower():
            raise ScannerUnavailableError(
                "Windows reports no wireless interface on this host, so no scan is possible"
            )

        return self._parse(output)

    @staticmethod
    def _parse(output):
        """Parse netsh output into normalized records.

        Layout: each `SSID n :` block carries authentication/encryption and one
        or more `BSSID n :` sub-blocks, each with its own signal/channel/band.
        """
        records = []

        ssid = None
        authentication = None
        cipher = None

        current = None

        def flush():
            if current and current.get("bssid"):
                records.append(
                    BaseScanner.build_record(
                        ssid=current["ssid"],
                        bssid=current["bssid"],
                        signal_dbm=BaseScanner.percent_to_dbm(current.get("signal_percent")),
                        channel=current.get("channel"),
                        band=current.get("band"),
                        encryption=BaseScanner.normalize_encryption(
                            current.get("authentication"), current.get("cipher")
                        ),
                    )
                )

        for raw_line in output.splitlines():
            line = raw_line.rstrip()

            ssid_match = _SSID_RE.match(line)
            if ssid_match:
                flush()
                current = None
                ssid = ssid_match.group(2).strip()
                authentication = None
                cipher = None
                continue

            auth_match = _AUTH_RE.match(line)
            if auth_match and current is None:
                authentication = auth_match.group(1).strip()
                continue

            cipher_match = _CIPHER_RE.match(line)
            if cipher_match and current is None:
                cipher = cipher_match.group(1).strip()
                continue

            bssid_match = _BSSID_RE.match(line)
            if bssid_match:
                flush()
                current = {
                    "ssid": ssid or "",
                    "bssid": bssid_match.group(1),
                    "authentication": authentication,
                    "cipher": cipher,
                }
                continue

            if current is None:
                continue

            signal_match = _SIGNAL_RE.match(line)
            if signal_match:
                current["signal_percent"] = int(signal_match.group(1))
                continue

            channel_match = _CHANNEL_RE.match(line)
            if channel_match:
                current["channel"] = int(channel_match.group(1))
                continue

            band_match = _BAND_RE.match(line)
            if band_match:
                current["band"] = band_match.group(1).strip()
                continue

        flush()
        return records
