from flask_cors import CORS
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()

# threading mode keeps this working on modern Python without eventlet/gevent,
# which no longer build cleanly on 3.12+.
socketio = SocketIO(cors_allowed_origins="*", async_mode="threading")
