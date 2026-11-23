"""Forces a real Wi-Fi scan on Windows via the Native Wifi API (wlanapi.dll).

Windows throttles background scanning while associated, so
`netsh wlan show networks` often returns a decayed cache - sometimes only the
connected AP. WlanScan() asks the driver to sweep the air for real; results
land in the OS cache a few seconds later and netsh can then read them.

Needs no administrator rights and no third-party packages. If the call fails we
say so and let the caller read whatever the cache holds, rather than inventing
networks.
"""

import ctypes
import logging
import platform
from ctypes import POINTER, byref, wintypes

log = logging.getLogger(__name__)

# WlanScan is asynchronous. Microsoft documents the driver as completing a scan
# within 4 seconds, after which the cached list is fresh.
SCAN_SETTLE_SECONDS = 4.0

ERROR_SUCCESS = 0
WLAN_API_VERSION_2_0 = 2


class GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", ctypes.c_ubyte * 8),
    ]


class WLAN_INTERFACE_INFO(ctypes.Structure):
    _fields_ = [
        ("InterfaceGuid", GUID),
        ("strInterfaceDescription", ctypes.c_wchar * 256),
        ("isState", wintypes.DWORD),
    ]


class WLAN_INTERFACE_INFO_LIST(ctypes.Structure):
    # Trailing array is variable length; index past item 0 by pointer maths.
    _fields_ = [
        ("dwNumberOfItems", wintypes.DWORD),
        ("dwIndex", wintypes.DWORD),
        ("InterfaceInfo", WLAN_INTERFACE_INFO * 1),
    ]


def _load_wlanapi():
    if platform.system() != "Windows":
        return None
    try:
        return ctypes.windll.wlanapi
    except (AttributeError, OSError) as exc:
        log.debug("wlanapi.dll unavailable: %s", exc)
        return None


def request_scan(interface_description=None):
    """Ask the driver to perform a fresh scan.

    Returns (triggered, detail). triggered is False when the API could not be
    used - the caller should then fall back to reading the existing cache.
    """
    wlanapi = _load_wlanapi()
    if wlanapi is None:
        return False, "Native Wifi API is not available on this host"

    handle = wintypes.HANDLE()
    negotiated = wintypes.DWORD()

    result = wlanapi.WlanOpenHandle(
        WLAN_API_VERSION_2_0, None, byref(negotiated), byref(handle)
    )
    if result != ERROR_SUCCESS:
        return False, f"WlanOpenHandle failed with code {result}"

    try:
        interface_list = POINTER(WLAN_INTERFACE_INFO_LIST)()
        result = wlanapi.WlanEnumInterfaces(handle, None, byref(interface_list))
        if result != ERROR_SUCCESS:
            return False, f"WlanEnumInterfaces failed with code {result}"

        try:
            count = interface_list.contents.dwNumberOfItems
            if count == 0:
                return False, "No wireless interfaces reported by the Native Wifi API"

            base = ctypes.addressof(interface_list.contents.InterfaceInfo)
            chosen = None
            for index in range(count):
                info = WLAN_INTERFACE_INFO.from_address(
                    base + index * ctypes.sizeof(WLAN_INTERFACE_INFO)
                )
                if chosen is None:
                    chosen = info
                if (
                    interface_description
                    and interface_description.lower() in info.strInterfaceDescription.lower()
                ):
                    chosen = info
                    break

            scan_result = wlanapi.WlanScan(
                handle, byref(chosen.InterfaceGuid), None, None, None
            )
            if scan_result != ERROR_SUCCESS:
                return False, f"WlanScan failed with code {scan_result}"

            return True, chosen.strInterfaceDescription
        finally:
            wlanapi.WlanFreeMemory(interface_list)
    finally:
        wlanapi.WlanCloseHandle(handle, None)
