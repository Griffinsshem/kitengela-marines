from app import create_app
from app.boot_migrations import apply_pending_migrations
from app.config import get_settings

app = create_app()

if get_settings().auto_migrate:
    apply_pending_migrations(app)
