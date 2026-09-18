"""Controlled vocabularies shared by models, schemas and the API."""

from __future__ import annotations

from enum import StrEnum


class RoleKey(StrEnum):
    """Application-wide roles.

    SUPPORTER is declared but not issued in v1: supporters browse the public
    site without an account. Having the member present means adding supporter
    accounts later needs no migration of this constraint.
    """

    CLUB_ADMIN = "club_admin"
    MEDIA_OFFICER = "media_officer"
    TEAM_MANAGER = "team_manager"
    COACH = "coach"
    PLAYER = "player"
    SUPPORTER = "supporter"


class TeamCategory(StrEnum):
    """What kind of side a team is.

    ACADEMY, DEVELOPMENT and YOUTH are included now so the club can add an
    academy or U17 side by inserting a row rather than migrating a constraint.
    """

    SENIOR = "senior"
    DEVELOPMENT = "development"
    ACADEMY = "academy"
    YOUTH = "youth"


class TeamGender(StrEnum):
    MEN = "men"
    WOMEN = "women"
    MIXED = "mixed"


class MembershipCapacity(StrEnum):
    """The capacity in which a user is attached to a specific team."""

    MANAGER = "manager"
    COACH = "coach"
    PLAYER = "player"
    STAFF = "staff"


class PlayerPosition(StrEnum):
    """Primary position. Drives squad-page grouping and which stats are shown."""

    GOALKEEPER = "goalkeeper"
    DEFENDER = "defender"
    MIDFIELDER = "midfielder"
    FORWARD = "forward"


class PlayerStatus(StrEnum):
    """Squad status.

    FORMER is distinct from INACTIVE: a former player stays in the record for
    historical match data but leaves the current squad listing.
    """

    ACTIVE = "active"
    INJURED = "injured"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"
    FORMER = "former"


class StaffRole(StrEnum):
    HEAD_COACH = "head_coach"
    ASSISTANT_COACH = "assistant_coach"
    GOALKEEPING_COACH = "goalkeeping_coach"
    TEAM_MANAGER = "team_manager"
    PHYSIO = "physio"
    OFFICIAL = "official"
