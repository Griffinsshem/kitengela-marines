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


class FixtureStatus(StrEnum):
    """Where a fixture is in its lifecycle.

    The public fixtures list is everything not yet COMPLETED; the results list
    is everything COMPLETED. One row, two views, no duplicate entry.
    """

    SCHEDULED = "scheduled"
    POSTPONED = "postponed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class Venue(StrEnum):
    HOME = "home"
    AWAY = "away"
    NEUTRAL = "neutral"


class MatchEventType(StrEnum):
    GOAL = "goal"
    OWN_GOAL = "own_goal"
    PENALTY_SCORED = "penalty_scored"
    PENALTY_MISSED = "penalty_missed"
    YELLOW_CARD = "yellow_card"
    SECOND_YELLOW = "second_yellow"
    RED_CARD = "red_card"
    SUBSTITUTION = "substitution"


class LineupRole(StrEnum):
    STARTER = "starter"
    SUBSTITUTE = "substitute"
    UNUSED_SUBSTITUTE = "unused_substitute"


class ArticleStatus(StrEnum):
    """Publication state.

    A published article with a future published_at is scheduled: it stays out
    of every public response until that moment, so match-day content can be
    prepared in advance.
    """

    DRAFT = "draft"
    PUBLISHED = "published"


class SocialPlatform(StrEnum):
    FACEBOOK = "facebook"
    X = "x"
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    WHATSAPP = "whatsapp"
    LINKEDIN = "linkedin"


class SupportMethodKind(StrEnum):
    """How supporters can give.

    M-Pesa is separated by type because a paybill, a till and a send-money
    number are entered differently by the person paying.
    """

    MPESA_PAYBILL = "mpesa_paybill"
    MPESA_TILL = "mpesa_till"
    MPESA_SEND_MONEY = "mpesa_send_money"
    BANK_TRANSFER = "bank_transfer"
    IN_KIND = "in_kind"
    OTHER = "other"
