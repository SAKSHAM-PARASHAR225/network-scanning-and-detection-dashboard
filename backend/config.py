import os

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/wireless_monitor",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # Scanner defaults. The persisted scan_settings row wins once it exists;
    # these only seed the first run.
    DEFAULT_SCAN_INTERVAL = int(os.getenv("SCAN_INTERVAL", "10"))
    DEFAULT_INTERFACE = os.getenv("WIFI_INTERFACE", "")
    SCANNER_BACKEND = os.getenv("SCANNER_BACKEND", "auto")

    # Retention cap for signal_readings, per network. 0 keeps every reading
    # forever (the default, so no observed history is ever discarded). Set a
    # positive value to trim the oldest rows on long-running deployments.
    SIGNAL_HISTORY_LIMIT = int(os.getenv("SIGNAL_HISTORY_LIMIT", "0"))

    AUTO_START_MONITORING = os.getenv("AUTO_START_MONITORING", "true").lower() == "true"
