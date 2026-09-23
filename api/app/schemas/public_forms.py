"""Public form submissions.

Everything here arrives from an anonymous stranger. Lengths are capped so a
single request cannot fill the database, and the honeypot and timing fields
are accepted but never stored.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field

PHONE_PATTERN = r"^[0-9+()\s-]*$"


class PublicForm(BaseModel):
    # extra="forbid" would reject the honeypot field, which must be accepted
    # and ignored, so these two are declared instead.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    website: str | None = Field(default=None, max_length=200)
    rendered_at: float | None = None


class ContactSubmission(PublicForm):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=32, pattern=PHONE_PATTERN)
    subject: str | None = Field(default=None, max_length=200)
    message: str = Field(min_length=10, max_length=5000)


class PartnershipSubmission(PublicForm):
    name: str = Field(min_length=1, max_length=160)
    organisation: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=32, pattern=PHONE_PATTERN)
    interest: str | None = Field(default=None, max_length=120)
    message: str = Field(min_length=10, max_length=5000)
