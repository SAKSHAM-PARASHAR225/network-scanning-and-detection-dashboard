"""Scanner abstraction.

    BaseScanner
        |-- NetshScanner    (Windows, netsh wlan)
        |-- NmcliScanner    (Linux, NetworkManager)
        `-- IwlistScanner   (Linux, wireless-tools)

Scanning logic lives behind this interface so the monitoring service never
knows which OS tool produced a result.
"""

import shutil
import subprocess
from abc import ABC, abstractmethod

from models.enums import Encryption
from scanner.channels import channel_to_frequency, frequency_to_band, normalize_band


class ScannerError(RuntimeError):
    """A scan was attempted and failed."""


class ScannerUnavailableError(ScannerError):
    """No real scan is possible in this environment.

    Raised instead of returning invented data - callers surface the reason to
    the operator rather than pretending a scan succeeded.
    """


class BaseScanner(ABC):
    name = "base"

    def __init__(self, interface=None):
        self.interface = interface or None

    @abstractmethod
    def is_available(self):
        """True when this scanner can run on the current host."""

    @abstractmethod
    def scan(self):
        """Perform one real scan.

        Returns a list of normalized dicts:
            ssid, bssid, signal_dbm, channel, frequency, band, encryption

        Raises ScannerError / ScannerUnavailableError on failure. Never
        returns fabricated results.
        """

    def read_cached(self):
        """Read the OS's current per-BSSID results without forcing a new sweep.

        Used for the 1-second live signal feed. Scanners that can't do this
        cheaply return None, and the live feed simply stays quiet.
        """
        return None

    # -- shared helpers -------------------------------------------------

    @staticmethod
    def _which(binary):
        return shutil.which(binary)

    @staticmethod
    def _run(command, timeout=45):
        """Run a scan command and return stdout.

        The command is always a fixed argument list built by the caller, never
        a shell string, so SSIDs and interface names can't inject commands.
        """
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                timeout=timeout,
                shell=False,
                check=False,
            )
        except FileNotFoundError as exc:
            raise ScannerUnavailableError(f"{command[0]} is not installed on this host") from exc
        except subprocess.TimeoutExpired as exc:
            raise ScannerError(f"{command[0]} timed out after {timeout}s") from exc

        stdout = completed.stdout.decode("utf-8", errors="replace")
        stderr = completed.stderr.decode("utf-8", errors="replace")

        if completed.returncode != 0:
            raise ScannerError(
                f"{command[0]} exited with code {completed.returncode}: {stderr.strip() or stdout.strip()}"
            )
        return stdout

    @staticmethod
    def percent_to_dbm(percent):
        """Convert a 0-100 link-quality percentage to dBm.

        Windows reports quality, not dBm. This is the standard linear mapping
        used by wpa_supplicant/NetworkManager: 0% = -100 dBm, 100% = -50 dBm.
        """
        if percent is None:
            return None
        percent = max(0, min(100, int(percent)))
        return int(percent / 2) - 100

    @staticmethod
    def normalize_encryption(authentication, cipher=None):
        """Map adapter auth/cipher strings onto our Encryption vocabulary.

        Anything unrecognised becomes UNKNOWN - never OPEN and never a
        silently "secure" value.
        """
        auth = (authentication or "").strip().upper()
        ciph = (cipher or "").strip().upper()

        if not auth and not ciph:
            return Encryption.UNKNOWN.value

        if "WPA3" in auth or "SAE" in auth or "OWE" in auth:
            return Encryption.WPA3.value
        if "RSN" in auth or "WPA2" in auth:
            return Encryption.WPA2.value
        if "WPA" in auth:
            return Encryption.WPA.value
        if "WEP" in auth or "WEP" in ciph:
            return Encryption.WEP.value
        if auth in {"OPEN", "NONE", "OPEN SYSTEM"} and ciph in {"NONE", "", "OPEN"}:
            return Encryption.OPEN.value
        if "OPEN" in auth and "WEP" not in ciph and ciph in {"NONE", ""}:
            return Encryption.OPEN.value
        return Encryption.UNKNOWN.value

    @classmethod
    def build_record(cls, ssid, bssid, signal_dbm, channel, band=None, frequency=None, encryption=None):
        """Assemble a normalized record, deriving band/frequency when absent."""
        band = normalize_band(band)
        if frequency is None:
            frequency = channel_to_frequency(channel, band)
        if band is None:
            band = frequency_to_band(frequency)

        return {
            "ssid": (ssid or "").strip(),
            "bssid": (bssid or "").strip().lower(),
            "signal_dbm": signal_dbm,
            "channel": channel,
            "frequency": frequency,
            "band": band,
            "encryption": encryption or Encryption.UNKNOWN.value,
        }
