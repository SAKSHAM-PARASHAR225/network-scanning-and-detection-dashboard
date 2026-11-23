"""Linux Wi-Fi scanner built on NetworkManager's nmcli.

Real scan, no monitor mode required. nmcli reports signal as a percentage and
exposes the frequency directly, so band is derived from the frequency.
"""

import platform

from scanner.base import BaseScanner, ScannerUnavailableError

_FIELDS = "SSID,BSSID,SIGNAL,CHAN,FREQ,SECURITY"


class NmcliScanner(BaseScanner):
    name = "nmcli"

    def is_available(self):
        return platform.system() == "Linux" and self._which("nmcli") is not None

    def scan(self):
        if platform.system() != "Linux":
            raise ScannerUnavailableError(
                "NmcliScanner only runs on Linux; this host is " + platform.system()
            )
        if self._which("nmcli") is None:
            raise ScannerUnavailableError("nmcli was not found on PATH")

        # --rescan yes forces a fresh sweep instead of returning cached results.
        return self._list("yes", timeout=60)

    def read_cached(self):
        if platform.system() != "Linux" or self._which("nmcli") is None:
            return None
        return self._list("no", timeout=5)

    def _list(self, rescan, timeout):
        command = [
            "nmcli",
            "--terse",
            "--escape", "no",
            "--fields", _FIELDS,
            "device", "wifi", "list", "--rescan", rescan,
        ]
        if self.interface:
            command.extend(["ifname", self.interface])

        return self._parse(self._run(command, timeout=timeout))

    @classmethod
    def _parse(cls, output):
        records = []
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue

            parts = line.split(":")
            # BSSID octets are themselves colon-separated, so rebuild by position.
            if len(parts) < 6 + 5:
                continue

            ssid = parts[0]
            bssid = ":".join(parts[1:7])
            try:
                signal_percent = int(parts[7]) if parts[7] else None
                channel = int(parts[8]) if parts[8] else None
            except ValueError:
                signal_percent, channel = None, None

            frequency = None
            if len(parts) > 9 and parts[9]:
                digits = "".join(ch for ch in parts[9] if ch.isdigit())
                frequency = int(digits) if digits else None

            security = parts[10] if len(parts) > 10 else ""
            encryption = cls._normalize_security(security)

            records.append(
                cls.build_record(
                    ssid=ssid,
                    bssid=bssid,
                    signal_dbm=cls.percent_to_dbm(signal_percent),
                    channel=channel,
                    frequency=frequency,
                    encryption=encryption,
                )
            )
        return records

    @staticmethod
    def _normalize_security(security):
        """nmcli reports '--' for open networks, otherwise e.g. 'WPA2 WPA3'."""
        text = (security or "").strip()
        if text in {"", "--"}:
            from models.enums import Encryption

            return Encryption.OPEN.value
        return BaseScanner.normalize_encryption(text)
