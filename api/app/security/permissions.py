from __future__ import annotations

from enum import StrEnum

from app.models.enums import MembershipCapacity, RoleKey


class Capability(StrEnum):
    """A discrete thing the API lets someone do."""

    MANAGE_USERS = "manage_users"
    MANAGE_CLUB = "manage_club"
    MANAGE_TEAMS = "manage_teams"
    MANAGE_SQUAD = "manage_squad"
    MANAGE_STAFF = "manage_staff"
    MANAGE_FIXTURES = "manage_fixtures"
    MANAGE_RESULTS = "manage_results"
    MANAGE_STANDINGS = "manage_standings"
    MANAGE_NEWS = "manage_news"
    PUBLISH_NEWS = "publish_news"
    MANAGE_MEDIA = "manage_media"
    MANAGE_SPONSORS = "manage_sponsors"
    VIEW_PRIVATE_PLAYER_DATA = "view_private_player_data"
    EDIT_OWN_PLAYER_PROFILE = "edit_own_player_profile"


TEAM_SCOPED: frozenset[Capability] = frozenset(
    {
        Capability.MANAGE_SQUAD,
        Capability.MANAGE_STAFF,
        Capability.MANAGE_FIXTURES,
        Capability.MANAGE_RESULTS,
        Capability.VIEW_PRIVATE_PLAYER_DATA,
    }
)


ROLE_CAPABILITIES: dict[RoleKey, frozenset[Capability]] = {
    RoleKey.CLUB_ADMIN: frozenset(Capability),
    RoleKey.MEDIA_OFFICER: frozenset(
        {
            Capability.MANAGE_NEWS,
            Capability.PUBLISH_NEWS,
            Capability.MANAGE_MEDIA,
        }
    ),
    RoleKey.TEAM_MANAGER: frozenset(
        {
            Capability.MANAGE_FIXTURES,
            Capability.MANAGE_RESULTS,
            Capability.MANAGE_STANDINGS,
            Capability.MANAGE_SQUAD,
            Capability.VIEW_PRIVATE_PLAYER_DATA,
        }
    ),
    RoleKey.COACH: frozenset(
        {
            Capability.MANAGE_SQUAD,
            Capability.VIEW_PRIVATE_PLAYER_DATA,
        }
    ),
    RoleKey.PLAYER: frozenset({Capability.EDIT_OWN_PLAYER_PROFILE}),
    RoleKey.SUPPORTER: frozenset(),
}


CAPABILITY_CAPACITIES: dict[Capability, frozenset[MembershipCapacity]] = {
    Capability.MANAGE_SQUAD: frozenset({MembershipCapacity.MANAGER, MembershipCapacity.COACH}),
    Capability.MANAGE_STAFF: frozenset({MembershipCapacity.MANAGER}),
    Capability.MANAGE_FIXTURES: frozenset({MembershipCapacity.MANAGER}),
    Capability.MANAGE_RESULTS: frozenset({MembershipCapacity.MANAGER}),
    Capability.VIEW_PRIVATE_PLAYER_DATA: frozenset(
        {MembershipCapacity.MANAGER, MembershipCapacity.COACH, MembershipCapacity.STAFF}
    ),
}


def capabilities_for(role_keys: set[RoleKey]) -> frozenset[Capability]:
    granted: set[Capability] = set()
    for key in role_keys:
        granted |= ROLE_CAPABILITIES.get(key, frozenset())
    return frozenset(granted)
