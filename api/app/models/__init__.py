"""Model registry.

Importing every model here is what populates db.metadata. Alembic autogenerate
only sees tables that have been imported, so a model missing from this list
silently never gets a migration.
"""

from app.models.club import Club, Team
from app.models.enums import (
    MembershipCapacity,
    PlayerPosition,
    PlayerStatus,
    RoleKey,
    StaffRole,
    TeamCategory,
    TeamGender,
)
from app.models.identity import Role, TeamMembership, User, user_roles
from app.models.people import Player, StaffMember

__all__ = [
    "Club",
    "MembershipCapacity",
    "Player",
    "PlayerPosition",
    "PlayerStatus",
    "Role",
    "RoleKey",
    "StaffMember",
    "StaffRole",
    "Team",
    "TeamCategory",
    "TeamGender",
    "TeamMembership",
    "User",
    "user_roles",
]
