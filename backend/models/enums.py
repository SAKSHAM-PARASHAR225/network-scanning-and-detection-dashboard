import enum


class SecurityStatus(str, enum.Enum):
    """Classification assigned by the security analyzer.

    VERIFIED is only ever granted by an administrator through the trusted
    baseline - the scanner never promotes an AP to VERIFIED on its own.
    """

    VERIFIED = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"
    SUSPICIOUS = "SUSPICIOUS"
    POSSIBLE_EVIL_TWIN = "POSSIBLE_EVIL_TWIN"
    ROGUE = "ROGUE"


class Encryption(str, enum.Enum):
    WPA3 = "WPA3"
    WPA2 = "WPA2"
    WPA = "WPA"
    WEP = "WEP"
    OPEN = "OPEN"
    UNKNOWN = "UNKNOWN"


WEAK_ENCRYPTION = {Encryption.OPEN, Encryption.WEP}


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertType(str, enum.Enum):
    ROGUE_AP = "ROGUE_AP"
    POSSIBLE_EVIL_TWIN = "POSSIBLE_EVIL_TWIN"
    UNKNOWN_AP = "UNKNOWN_AP"
    WEAK_ENCRYPTION = "WEAK_ENCRYPTION"
    SIGNAL_ANOMALY = "SIGNAL_ANOMALY"


class AlertSeverity(str, enum.Enum):
    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertStatus(str, enum.Enum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class ScanStatus(str, enum.Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ScannerState(str, enum.Enum):
    STARTING = "STARTING"
    WAITING_FOR_SETUP = "WAITING_FOR_SETUP"
    SCANNING = "SCANNING"
    IDLE = "IDLE"
    ERROR = "ERROR"
    OFFLINE = "OFFLINE"
