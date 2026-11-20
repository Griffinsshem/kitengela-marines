"""Response headers that make the API's answers inert in a browser.

The API returns JSON and, in development, uploaded images. Nothing it sends
should ever run as a page, be framed, or be guessed into another type, so the
policy is as strict as it gets: no sources at all, no framing, no sniffing.
The website sets its own, looser policy; these apply to the API origin only.
"""

from __future__ import annotations

from flask import Flask, Response

from app.config import Settings

_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}

# Two years, the HSTS preload list's minimum. Production only: a laptop on
# plain http://localhost must not be told to refuse plain HTTP for two years.
_HSTS = "max-age=63072000; includeSubDomains"


def register_security_headers(app: Flask, settings: Settings) -> None:
    @app.after_request
    def _set_security_headers(response: Response) -> Response:
        for name, value in _HEADERS.items():
            response.headers.setdefault(name, value)
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", _HSTS)
        return response
