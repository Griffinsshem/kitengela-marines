"""Version 1 of the public and administrative API.

Everything mounts under /api/v1 so a future v2 can ship alongside it rather
than breaking supporters' bookmarks and the deployed frontend.
"""

from __future__ import annotations

from flask import Blueprint

api_v1 = Blueprint("api_v1", __name__, url_prefix="/api/v1")

# Imported at the bottom for their side effect: each module registers its
# routes on the blueprint above, so the blueprint must exist first.
from app.api.v1 import auth as _auth  # noqa: E402,F401
from app.api.v1 import forms as _forms  # noqa: E402,F401
from app.api.v1 import health as _health  # noqa: E402,F401
from app.api.v1 import media as _media  # noqa: E402,F401
from app.api.v1 import news as _news  # noqa: E402,F401
from app.api.v1 import public as _public  # noqa: E402,F401
from app.api.v1 import support as _support  # noqa: E402,F401
from app.api.v1.admin import _admin_routes  # noqa: E402,F401
