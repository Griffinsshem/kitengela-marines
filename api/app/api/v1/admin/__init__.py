"""Administrative write endpoints.

Everything here mounts under /api/v1/admin and every route is authenticated
and capability-checked. The prefix is organisational convenience only — the
security is the decorators, never the URL, because hiding a route from the
navigation is not access control.
"""

from __future__ import annotations

from app.api.v1.admin import audit as _audit  # noqa: F401
from app.api.v1.admin import fixtures as _fixtures  # noqa: F401
from app.api.v1.admin import news as _news  # noqa: F401
from app.api.v1.admin import players as _players  # noqa: F401
from app.api.v1.admin import staff as _staff  # noqa: F401
from app.api.v1.admin import teams as _teams  # noqa: F401

_admin_routes = (_audit, _fixtures, _news, _players, _staff, _teams)
