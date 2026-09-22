"""Model registry.

Importing every model here is what populates db.metadata. Alembic autogenerate
only sees tables that have been imported, so a model missing from this list
silently never gets a migration.
"""

from app.models.audit import AuditLog
from app.models.club import Club, Team
from app.models.competition import Competition, Opponent, Season
from app.models.enums import (
    ArticleStatus,
    FixtureStatus,
    LineupRole,
    MatchEventType,
    MembershipCapacity,
    PlayerPosition,
    PlayerStatus,
    RoleKey,
    StaffRole,
    TeamCategory,
    TeamGender,
    Venue,
)
from app.models.identity import Role, TeamMembership, User, user_roles
from app.models.match import Fixture, LeagueStanding, MatchEvent, PlayerMatchStatistic
from app.models.media import MediaAsset
from app.models.news import Article, ArticleCategory
from app.models.people import Player, StaffMember

__all__ = [
    "Article",
    "ArticleCategory",
    "ArticleStatus",
    "AuditLog",
    "Club",
    "Competition",
    "Fixture",
    "FixtureStatus",
    "LeagueStanding",
    "LineupRole",
    "MatchEvent",
    "MatchEventType",
    "MediaAsset",
    "MembershipCapacity",
    "Opponent",
    "Player",
    "PlayerMatchStatistic",
    "PlayerPosition",
    "PlayerStatus",
    "Role",
    "RoleKey",
    "Season",
    "StaffMember",
    "StaffRole",
    "Team",
    "TeamCategory",
    "TeamGender",
    "TeamMembership",
    "User",
    "Venue",
    "user_roles",
]
