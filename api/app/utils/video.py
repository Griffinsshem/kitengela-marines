"""YouTube link handling.

Only the eleven-character video id is stored, never a URL. The site puts that
id inside an iframe, so accepting a URL would mean framing whatever an admin
pasted. Accepting only an id means the site can only ever frame YouTube.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")

HOSTS = frozenset(
    {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
        "www.youtu.be",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
    }
)

PATH_PREFIXES = ("/embed/", "/shorts/", "/live/", "/v/")


def _checked(candidate: str) -> str | None:
    return candidate if VIDEO_ID.match(candidate) else None


def parse_youtube_id(value: str) -> str | None:
    """The video id from a YouTube link in any of its shapes, or None."""
    candidate = value.strip()
    if VIDEO_ID.match(candidate):
        return candidate

    parsed = urlparse(candidate if "//" in candidate else f"https://{candidate}")
    host = (parsed.hostname or "").lower()
    if host not in HOSTS:
        return None

    if host.endswith("youtu.be"):
        return _checked(parsed.path.lstrip("/").split("/")[0])

    if parsed.path == "/watch":
        values = parse_qs(parsed.query).get("v", [])
        return _checked(values[0]) if values else None

    for prefix in PATH_PREFIXES:
        if parsed.path.startswith(prefix):
            return _checked(parsed.path[len(prefix) :].split("/")[0])

    return None
