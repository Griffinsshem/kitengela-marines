"""Request bodies for administrative writes.

Each schema is an explicit allow-list. extra="forbid" rejects anything not
named, which is the mass-assignment guard required by the brief: a Coach cannot
move a player between teams by adding team_id to a PATCH body, because the
request fails validation before any attribute is assigned.

Create and Update schemas are separate. On create, required fields are
required; on update every field is optional, and exclude_unset later
distinguishes an omitted field from one explicitly set to null.
"""

from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import (
    PlayerPosition,
    PlayerStatus,
    StaffRole,
    TeamCategory,
    TeamGender,
)

NAME = Field(min_length=1, max_length=80)
OPTIONAL_URL = Field(default=None, max_length=500)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# --- Teams -----------------------------------------------------------------


class TeamCreate(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    short_name: str = Field(min_length=1, max_length=60)
    slug: str | None = Field(default=None, max_length=120)
    category: TeamCategory = TeamCategory.SENIOR
    gender: TeamGender
    accent_key: str = Field(min_length=1, max_length=40)
    summary: str | None = None
    display_order: int = Field(default=0, ge=0, le=999)


class TeamUpdate(StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    short_name: str | None = Field(default=None, min_length=1, max_length=60)
    category: TeamCategory | None = None
    gender: TeamGender | None = None
    accent_key: str | None = Field(default=None, min_length=1, max_length=40)
    summary: str | None = None
    is_active: bool | None = None
    display_order: int | None = Field(default=None, ge=0, le=999)

    # slug is absent by design. It is in published URLs, and changing it would
    # break every shared link and search result pointing at the team.


# --- Players ---------------------------------------------------------------


class PlayerCreate(StrictModel):
    team_id: uuid.UUID
    first_name: str = NAME
    last_name: str = NAME
    known_as: str | None = Field(default=None, max_length=120)
    squad_number: int | None = Field(default=None, ge=1, le=99)
    position: PlayerPosition
    status: PlayerStatus = PlayerStatus.ACTIVE
    nationality: str | None = Field(default=None, max_length=80)
    biography: str | None = None
    photo_url: str | None = OPTIONAL_URL
    joined_on: date | None = None

    # Club-internal. Accepted here, never returned by a public endpoint.
    date_of_birth: date | None = None
    phone: str | None = Field(default=None, max_length=32)
    emergency_contact_name: str | None = Field(default=None, max_length=160)
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    internal_notes: str | None = None

    @field_validator("date_of_birth")
    @classmethod
    def _not_in_the_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Date of birth cannot be in the future.")
        return value


class PlayerUpdate(StrictModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, min_length=1, max_length=80)
    known_as: str | None = Field(default=None, max_length=120)
    squad_number: int | None = Field(default=None, ge=1, le=99)
    position: PlayerPosition | None = None
    status: PlayerStatus | None = None
    nationality: str | None = Field(default=None, max_length=80)
    biography: str | None = None
    photo_url: str | None = OPTIONAL_URL
    joined_on: date | None = None
    date_of_birth: date | None = None
    phone: str | None = Field(default=None, max_length=32)
    emergency_contact_name: str | None = Field(default=None, max_length=160)
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    internal_notes: str | None = None

    # team_id and slug are absent. A transfer between squads is a deliberate
    # operation with its own endpoint and its own scope check on both teams.


class PlayerTransfer(StrictModel):
    """Move a player to another team. Requires scope on the destination too."""

    team_id: uuid.UUID


class PlayerSelfUpdate(StrictModel):
    """What a player may change on their own profile.

    Three fields. Position, squad number, status and team are football
    decisions belonging to the coach and team manager, and statistics are
    derived from match records rather than typed.
    """

    known_as: str | None = Field(default=None, max_length=120)
    biography: str | None = None
    phone: str | None = Field(default=None, max_length=32)


# --- Staff -----------------------------------------------------------------


class StaffCreate(StrictModel):
    team_id: uuid.UUID | None = None
    first_name: str = NAME
    last_name: str = NAME
    role: StaffRole
    biography: str | None = None
    photo_url: str | None = OPTIONAL_URL
    display_order: int = Field(default=0, ge=0, le=999)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=32)


class StaffUpdate(StrictModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, min_length=1, max_length=80)
    role: StaffRole | None = None
    biography: str | None = None
    photo_url: str | None = OPTIONAL_URL
    is_active: bool | None = None
    display_order: int | None = Field(default=None, ge=0, le=999)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=32)
