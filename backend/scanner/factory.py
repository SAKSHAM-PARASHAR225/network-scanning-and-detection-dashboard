"""Picks a concrete scanner for the current host."""

import platform

from scanner.base import BaseScanner, ScannerUnavailableError
from scanner.iwlist_scanner import IwlistScanner
from scanner.netsh_scanner import NetshScanner
from scanner.nmcli_scanner import NmcliScanner

SCANNERS = {
    "netsh": NetshScanner,
    "nmcli": NmcliScanner,
    "iwlist": IwlistScanner,
}

# Most reliable first, per platform.
_AUTO_ORDER = [NetshScanner, NmcliScanner, IwlistScanner]


def get_scanner(backend="auto", interface=None):
    """Return a usable scanner, or raise ScannerUnavailableError explaining why not."""
    backend = (backend or "auto").strip().lower()

    if backend != "auto":
        scanner_cls = SCANNERS.get(backend)
        if scanner_cls is None:
            raise ScannerUnavailableError(
                f"Unknown SCANNER_BACKEND '{backend}'. Valid values: {', '.join(SCANNERS)}, auto"
            )
        scanner = scanner_cls(interface=interface)
        if not scanner.is_available():
            raise ScannerUnavailableError(
                f"Scanner '{backend}' is not usable on this host "
                f"({platform.system()}). Check that its command-line tool is installed."
            )
        return scanner

    for scanner_cls in _AUTO_ORDER:
        scanner = scanner_cls(interface=interface)
        if scanner.is_available():
            return scanner

    raise ScannerUnavailableError(
        f"No real Wi-Fi scanner is available on this host ({platform.system()}). "
        "Windows needs netsh with the WLAN AutoConfig service running; Linux needs "
        "nmcli (NetworkManager) or iwlist (wireless-tools). No data will be "
        "fabricated in place of a real scan."
    )


def detect_interface(scanner):
    """Best-effort wireless interface name for display purposes."""
    if isinstance(scanner, NetshScanner):
        return scanner.detect_interface()
    return scanner.interface


__all__ = ["get_scanner", "detect_interface", "BaseScanner", "ScannerUnavailableError", "SCANNERS"]
