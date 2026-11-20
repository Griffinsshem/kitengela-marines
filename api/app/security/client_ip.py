"""Who a request came from.

Every request reaches the app from 127.0.0.1: Render's proxy sits in front of
gunicorn. So `request.remote_addr` names the proxy, and anything keyed on it
(rate limits, the audit log, form records) treats every visitor as one person.

The real address comes from a header, and the choice of header matters:

- X-Forwarded-For is not trustworthy here. Render's proxy appends to it rather
  than replacing it, so its first entry is whatever the client chose to send.
- True-Client-IP is set by Cloudflare, which sits in front of every Render
  service, from the connection it actually received. Render's support
  recommends it for exactly this.

Outside production (a laptop, CI) there is no Cloudflare, so the header is not
trusted at all and the socket address is used: a local client could otherwise
set it and walk around the limits under test.
"""

from __future__ import annotations

import ipaddress

from flask import current_app, request

TRUSTED_HEADER = "True-Client-IP"


def client_ip() -> str:
    """The visitor's address, as reliably as the platform allows."""
    settings = current_app.extensions.get("settings")
    if settings is not None and settings.trust_client_ip_header:
        candidate = request.headers.get(TRUSTED_HEADER, "").strip()
        if _is_ip(candidate):
            return candidate
    return request.remote_addr or "unknown"


def _is_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return False
    return True
