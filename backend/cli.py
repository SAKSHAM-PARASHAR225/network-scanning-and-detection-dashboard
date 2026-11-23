"""Management commands.

    flask --app cli init-db        create tables without Alembic (quick start)
    flask --app cli scan-once      run one real scan and print it (no DB writes)
    flask --app cli show-status    print scanner + setup status
    flask --app cli trust-bssid    add a BSSID to the trusted baseline
"""

import json

import click
from flask.cli import FlaskGroup

from app import create_app
from extensions import db
from scanner import ScannerError, detect_interface, get_scanner
from services import setup_service


def _create_app_no_monitor():
    # CLI commands must not spawn the monitoring loop.
    return create_app(start_monitoring=False)


cli = FlaskGroup(create_app=_create_app_no_monitor)


@cli.command("init-db")
def init_db():
    """Create all tables directly. Prefer `flask db upgrade` for real deployments."""
    db.create_all()
    click.echo("Tables created.")


@cli.command("scan-once")
def scan_once():
    """Perform one real Wi-Fi scan and print the normalized records."""
    try:
        scanner = get_scanner()
    except ScannerError as exc:
        raise SystemExit(f"No scanner available: {exc}")

    click.echo(f"scanner={scanner.name} interface={detect_interface(scanner)}")
    try:
        records = scanner.scan()
    except ScannerError as exc:
        raise SystemExit(f"Scan failed: {exc}")

    click.echo(f"{len(records)} access points detected")
    for record in records:
        click.echo(json.dumps(record))


@cli.command("show-status")
def show_status():
    from services.monitoring_service import monitoring_service

    click.echo(json.dumps(monitoring_service.status(), indent=2))
    click.echo(
        json.dumps(
            {
                "setup_required": setup_service.is_setup_required(),
                "trusted_network_count": setup_service.trusted_count(),
            },
            indent=2,
        )
    )


@cli.command("trust-bssid")
@click.argument("bssids", nargs=-1, required=True)
def trust_bssid(bssids):
    """Add one or more observed BSSIDs to the trusted baseline."""
    result = setup_service.verify_bssids(list(bssids))
    if result["error"]:
        raise SystemExit(result["error"])

    for trusted in result["verified"]:
        click.echo(f"trusted: {trusted.ssid or '(hidden)'} {trusted.bssid}")
    for skipped in result["skipped"]:
        click.echo(f"skipped: {skipped['bssid']} ({skipped['reason']})")


if __name__ == "__main__":
    cli()
