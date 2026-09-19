"""Cache headers for public reads."""

from __future__ import annotations

from flask import Response


def cached(response: Response, seconds: int) -> Response:
    """Let an edge cache absorb read traffic without serving stale scores.

    max-age=0 keeps the browser honest, so a supporter refreshing after full
    time sees the result the moment it is entered. s-maxage lets any CDN in
    front of Render answer most requests without touching the instance, and
    stale-while-revalidate keeps the page fast while the edge refetches.
    """
    response.headers["Cache-Control"] = (
        f"public, max-age=0, s-maxage={seconds}, stale-while-revalidate={seconds * 2}"
    )
    return response
