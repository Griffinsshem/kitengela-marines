"""Spam and abuse checks for public forms.

Three cheap signals instead of a captcha. A captcha means loading a
third-party script onto the club's site and asking supporters to solve puzzles;
these cost the sender nothing and catch most automated submissions.

None of this is a security boundary. Validation, escaping and rate limiting do
that work. This only keeps the club's inbox usable.
"""

from __future__ import annotations

import time

# A field hidden from people by the form's own styling. A browser leaves it
# empty; a bot filling every input it finds does not.
HONEYPOT_FIELD = "website"

# Nobody reads a form and writes a message in under three seconds.
MINIMUM_SECONDS = 3.0

# A form left open for hours is likelier a stale tab than a real submission.
MAXIMUM_SECONDS = 60 * 60 * 6


class SubmissionRejectedError(Exception):
    """Raised when a submission looks automated."""


def check_not_automated(honeypot: str | None, rendered_at: float | None) -> None:
    if honeypot:
        raise SubmissionRejectedError("honeypot filled")

    if rendered_at is None:
        # Older clients and anything hand-rolled: allowed, since rate limiting
        # still applies and a missing timestamp is not evidence of a bot.
        return

    elapsed = time.time() - rendered_at
    if elapsed < MINIMUM_SECONDS:
        raise SubmissionRejectedError("submitted too quickly")
    if elapsed > MAXIMUM_SECONDS:
        raise SubmissionRejectedError("form expired")


def accepted_response() -> tuple[dict[str, object], int]:
    """What a sender sees, whether or not the submission was kept.

    A bot that learns which attempts were dropped can tune itself past the
    checks. A person whose message was wrongly dropped is better served by the
    club's phone number, which the contact page shows anyway.
    """
    return {"data": {"received": True}}, 202


def client_ip(headers: dict[str, str], remote_addr: str | None) -> str | None:
    forwarded = headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    return remote_addr
