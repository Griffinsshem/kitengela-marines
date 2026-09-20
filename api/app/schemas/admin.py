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
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import (
    FixtureStatus,
    LineupRole,
    MatchEventType,
    PlayerPosition,
    PlayerStatus,
    StaffRole,
    TeamCategory,
    TeamGender,
    Venue,
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


# --- Competitions and seasons ----------------------------------------------


class CompetitionCreate(StrictModel):
    name: str = Field(min_length=1, max_length=160)
    short_name: str = Field(min_length=1, max_length=60)
    has_standings: bool = True


class SeasonCreate(StrictModel):
    competition_id: uuid.UUID
    label: str = Field(min_length=1, max_length=40)
    starts_on: date | None = None
    ends_on: date | None = None
    is_current: bool = False

    @model_validator(mode="after")
    def _ends_after_start(self) -> SeasonCreate:
        if self.starts_on and self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("ends_on cannot be before starts_on.")
        return self


class OpponentCreate(StrictModel):
    name: str = Field(min_length=1, max_length=160)
    short_name: str | None = Field(default=None, max_length=60)
    crest_url: str | None = OPTIONAL_URL
    home_ground: str | None = Field(default=None, max_length=160)


# --- Fixtures --------------------------------------------------------------


class FixtureCreate(StrictModel):
    team_id: uuid.UUID
    opponent_id: uuid.UUID
    season_id: uuid.UUID
    venue: Venue
    venue_name: str | None = Field(default=None, max_length=160)
    kickoff_at: datetime | None = None
    # A county league often announces a date before confirming a kickoff time.
    scheduled_on: date | None = None

    @model_validator(mode="after")
    def _needs_a_date(self) -> FixtureCreate:
        if self.kickoff_at is None and self.scheduled_on is None:
            raise ValueError("Provide kickoff_at or scheduled_on.")
        return self


class FixtureUpdate(StrictModel):
    """Scheduling changes only. Results go through the result endpoint."""

    opponent_id: uuid.UUID | None = None
    venue: Venue | None = None
    venue_name: str | None = Field(default=None, max_length=160)
    kickoff_at: datetime | None = None
    scheduled_on: date | None = None
    status: FixtureStatus | None = None

    @field_validator("status")
    @classmethod
    def _not_completed_here(cls, value: FixtureStatus | None) -> FixtureStatus | None:
        # Completing a match requires a score, so it has its own endpoint.
        if value == FixtureStatus.COMPLETED:
            raise ValueError("Use the result endpoint to complete a fixture.")
        return value


class MatchEventInput(StrictModel):
    event_type: MatchEventType
    minute: int | None = Field(default=None, ge=1, le=130)
    added_time: int | None = Field(default=None, ge=1, le=30)
    player_id: uuid.UUID | None = None
    related_player_id: uuid.UUID | None = None
    is_opposition: bool = False
    note: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _our_events_name_a_player(self) -> MatchEventInput:
        if not self.is_opposition and self.player_id is None:
            raise ValueError("A player is required unless the event is an opposition one.")
        return self


class LineupEntryInput(StrictModel):
    player_id: uuid.UUID
    lineup_role: LineupRole
    minutes_played: int = Field(default=0, ge=0, le=130)
    goals: int = Field(default=0, ge=0, le=20)
    assists: int = Field(default=0, ge=0, le=20)
    yellow_cards: int = Field(default=0, ge=0, le=2)
    red_cards: int = Field(default=0, ge=0, le=1)
    clean_sheet: bool | None = None
    goals_conceded: int | None = Field(default=None, ge=0, le=30)
    saves: int | None = Field(default=None, ge=0, le=50)


class ResultInput(StrictModel):
    """A completed match, entered in one request.

    Score, events and lineup commit together. Entered separately, a supporter
    refreshing mid-entry would see a completed match with no scorers.
    """

    our_score: int = Field(ge=0, le=30)
    their_score: int = Field(ge=0, le=30)
    report: str | None = None
    player_of_the_match_id: uuid.UUID | None = None
    events: list[MatchEventInput] | None = None
    lineup: list[LineupEntryInput] | None = None

    @model_validator(mode="after")
    def _starting_eleven_at_most(self) -> ResultInput:
        if self.lineup is None:
            return self
        starters = [e for e in self.lineup if e.lineup_role == LineupRole.STARTER]
        if len(starters) > 11:
            raise ValueError("A starting line-up cannot exceed eleven players.")
        seen = {entry.player_id for entry in self.lineup}
        if len(seen) != len(self.lineup):
            raise ValueError("Each player may appear once in the line-up.")
        return self


# --- Standings -------------------------------------------------------------


class StandingRow(StrictModel):
    position: int = Field(ge=1, le=60)
    team_id: uuid.UUID | None = None
    opponent_id: uuid.UUID | None = None
    played: int = Field(default=0, ge=0, le=100)
    won: int = Field(default=0, ge=0, le=100)
    drawn: int = Field(default=0, ge=0, le=100)
    lost: int = Field(default=0, ge=0, le=100)
    goals_for: int = Field(default=0, ge=0, le=500)
    goals_against: int = Field(default=0, ge=0, le=500)
    points: int = Field(default=0, ge=0, le=300)

    @model_validator(mode="after")
    def _one_club_and_consistent_record(self) -> StandingRow:
        if (self.team_id is None) == (self.opponent_id is None):
            raise ValueError("Name exactly one of team_id or opponent_id.")
        if self.won + self.drawn + self.lost != self.played:
            raise ValueError("won + drawn + lost must equal played.")
        return self


class StandingsReplace(StrictModel):
    """The whole table for one season, replaced in one transaction.

    A league table is a single artefact. Editing rows individually would allow
    a half-updated table to be published, and there is no moment when a table
    is correct with only some of its rows refreshed.
    """

    season_id: uuid.UUID
    rows: list[StandingRow]

    @model_validator(mode="after")
    def _positions_are_a_sequence(self) -> StandingsReplace:
        positions = sorted(row.position for row in self.rows)
        if positions != list(range(1, len(self.rows) + 1)):
            raise ValueError("Positions must run from 1 with no gaps or duplicates.")

        clubs = [(row.team_id, row.opponent_id) for row in self.rows]
        if len(set(clubs)) != len(clubs):
            raise ValueError("Each club may appear once in the table.")
        return self
