"""Slug generation for public URLs.

Slugs are generated once and then treated as immutable. A player's profile URL
gets shared on WhatsApp and indexed by search engines; regenerating it because
somebody corrected a spelling would break every existing link.
"""

from __future__ import annotations

from collections.abc import Callable

from slugify import slugify

MAX_SLUG_LENGTH = 120


def make_slug(value: str) -> str:
    return slugify(value, max_length=MAX_SLUG_LENGTH)


def unique_slug(value: str, exists: Callable[[str], bool]) -> str:
    """Append -2, -3, ... until the slug is free.

    `exists` is injected rather than the function querying a model directly, so
    the same helper serves players, articles, galleries and matches without
    knowing anything about them.
    """
    base = make_slug(value) or "item"
    if not exists(base):
        return base

    suffix = 2
    while True:
        candidate = f"{base[: MAX_SLUG_LENGTH - 5]}-{suffix}"
        if not exists(candidate):
            return candidate
        suffix += 1
