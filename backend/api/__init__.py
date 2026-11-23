from api import (
    alerts_routes,
    health_routes,
    networks_routes,
    scans_routes,
    settings_routes,
    setup_routes,
    trusted_aps_routes,
)

BLUEPRINTS = (
    setup_routes.bp,
    trusted_aps_routes.bp,
    networks_routes.bp,
    alerts_routes.bp,
    scans_routes.bp,
    settings_routes.bp,
    health_routes.bp,
)


def register_blueprints(app):
    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)


__all__ = ["BLUEPRINTS", "register_blueprints"]
