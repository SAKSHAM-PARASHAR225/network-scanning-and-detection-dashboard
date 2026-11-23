"""Development entrypoint.

    python run.py

The Werkzeug reloader is deliberately disabled: it runs the module twice,
which would start a second monitoring loop in the parent process. There must
be exactly one scanner per backend.
"""

import os

from app import create_app
from extensions import socketio

app = create_app()

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"

    socketio.run(
        app,
        host=host,
        port=port,
        debug=debug,
        use_reloader=False,
        allow_unsafe_werkzeug=True,
    )
