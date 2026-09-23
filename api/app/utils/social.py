"""Social link validation.

A link labelled Facebook must point at Facebook. Hosts are matched exactly,
never by suffix, so facebook.com.evil.example does not pass. This mostly
catches typos, but a social icon that says one thing and goes somewhere else
is worth closing off.
"""

from __future__ import annotations

from urllib.parse import urlparse

from app.models.enums import SocialPlatform

PLATFORM_HOSTS: dict[SocialPlatform, frozenset[str]] = {
    SocialPlatform.FACEBOOK: frozenset(
        {"facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com"}
    ),
    SocialPlatform.X: frozenset({"x.com", "www.x.com", "twitter.com", "www.twitter.com"}),
    SocialPlatform.INSTAGRAM: frozenset({"instagram.com", "www.instagram.com"}),
    SocialPlatform.YOUTUBE: frozenset(
        {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
    ),
    SocialPlatform.TIKTOK: frozenset({"tiktok.com", "www.tiktok.com"}),
    SocialPlatform.WHATSAPP: frozenset({"wa.me", "chat.whatsapp.com", "api.whatsapp.com"}),
    SocialPlatform.LINKEDIN: frozenset({"linkedin.com", "www.linkedin.com"}),
}


def is_valid_social_url(platform: SocialPlatform, url: str) -> bool:
    parsed = urlparse(url.strip())
    if parsed.scheme != "https":
        return False
    return (parsed.hostname or "").lower() in PLATFORM_HOSTS[platform]
