"""Linux fallback scanner built on wireless-tools (`iwlist <iface> scan`).

Usually requires root. Reports signal directly in dBm.
"""

import platform
import re

from models.enums import Encryption
from scanner.base import BaseScanner, ScannerError, ScannerUnavailableError

_CELL_RE = re.compile(r"Cell \d+ - Address:\s*([0-9A-Fa-f:]{17})")
_ESSID_RE = re.compile(r'ESSID:"(.*)"')
_SIGNAL_RE = re.compile(r"Signal level=(-?\d+)\s*dBm")
_CHANNEL_RE = re.compile(r"Channel:(\d+)")
_FREQ_RE = re.compile(r"Frequency:([\d.]+) GHz")
_ENCRYPTION_KEY_RE = re.compile(r"Encryption key:(on|off)")


class IwlistScanner(BaseScanner):
    name = "iwlist"

    def is_available(self):
        return platform.system() == "Linux" and self._which("iwlist") is not None

    def scan(self):
        if platform.system() != "Linux":
            raise ScannerUnavailableError(
                "IwlistScanner only runs on Linux; this host is " + platform.system()
            )
        if self._which("iwlist") is None:
            raise ScannerUnavailableError("iwlist was not found on PATH")
        if not self.interface:
            raise ScannerUnavailableError(
                "IwlistScanner needs an explicit wireless interface name (set WIFI_INTERFACE)"
            )

        try:
            output = self._run(["iwlist", self.interface, "scan"], timeout=60)
        except ScannerError as exc:
            if "operation not permitted" in str(exc).lower():
                raise ScannerUnavailableError(
                    "iwlist scanning requires root privileges on this host"
                ) from exc
            raise

        return self._parse(output)

    @classmethod
    def _parse(cls, output):
        records = []
        blocks = re.split(r"(?=Cell \d+ - Address:)", output)

        for block in blocks:
            address = _CELL_RE.search(block)
            if not address:
                continue

            essid = _ESSID_RE.search(block)
            signal = _SIGNAL_RE.search(block)
            channel = _CHANNEL_RE.search(block)
            frequency = _FREQ_RE.search(block)
            key_on = _ENCRYPTION_KEY_RE.search(block)

            if "WPA3" in block or "SAE" in block:
                encryption = Encryption.WPA3.value
            elif "WPA2" in block or "IEEE 802.11i/WPA2" in block:
                encryption = Encryption.WPA2.value
            elif "WPA" in block:
                encryption = Encryption.WPA.value
            elif key_on and key_on.group(1) == "off":
                encryption = Encryption.OPEN.value
            elif key_on and key_on.group(1) == "on":
                # Key on with no WPA/RSN information element means WEP.
                encryption = Encryption.WEP.value
            else:
                encryption = Encryption.UNKNOWN.value

            records.append(
                cls.build_record(
                    ssid=essid.group(1) if essid else "",
                    bssid=address.group(1),
                    signal_dbm=int(signal.group(1)) if signal else None,
                    channel=int(channel.group(1)) if channel else None,
                    frequency=int(float(frequency.group(1)) * 1000) if frequency else None,
                    encryption=encryption,
                )
            )
        return records
