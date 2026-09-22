"""Public response shapes.

Serialisation is an API concern, so it lives here rather than on the models.
Player and StaffMember still decide *which* columns may be published through
PUBLIC_FIELDS; these functions only decide how the published ones are shaped.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from app.models.club import Club, Team
from app.models.competition import Opponent, Season
from app.models.enums import LineupRole, PlayerPosition
from app.models.match import Fixture, LeagueStanding, MatchEvent, PlayerMatchStatistic
from app.models.news import Article
from app.models.people import Player, StaffMember
from app.utils.sanitize import sanitize_html


def _safe(value: Any) -> Any:
    """ISO 8601 for dates, strings for UUIDs.

    Flask's default JSON provider renders datetimes as RFC 822 HTTP dates,
    which JavaScript's Date constructor parses inconsistently across browsers.
    ISO 8601 is unambiguous.
    """
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def serialize_club(club: Club) -> dict[str, Any]:
    return {
        "name": club.name,
        "short_name": club.short_name,
        "slug": club.slug,
        "founded_year": club.founded_year,
        "home_ground": club.home_ground,
        "town": club.town,
        "county": club.county,
        "contact_email": club.contact_email,
        "contact_phone": club.contact_phone,
        "summary": club.summary,
        "mission": club.mission,
    }


def serialize_team(team: Team) -> dict[str, Any]:
    return {
        "id": str(team.id),
        "name": team.name,
        "short_name": team.short_name,
        "slug": team.slug,
        "category": team.category,
        "gender": team.gender,
        # Names the accent set; the colours live in the frontend design system.
        "accent_key": team.accent_key,
        "summary": team.summary,
    }


def team_ref(team: Team) -> dict[str, Any]:
    return {
        "name": team.name,
        "short_name": team.short_name,
        "slug": team.slug,
        "accent_key": team.accent_key,
    }


def opponent_ref(opponent: Opponent) -> dict[str, Any]:
    return {
        "name": opponent.name,
        "short_name": opponent.short_name,
        "slug": opponent.slug,
        "crest_url": opponent.crest_url,
    }


def player_ref(player: Player) -> dict[str, Any]:
    return {
        "display_name": player.display_name,
        "slug": player.slug,
        "squad_number": player.squad_number,
        "position": player.position,
    }


def serialize_player(player: Player) -> dict[str, Any]:
    data = {key: _safe(value) for key, value in player.public_dict().items()}
    data["team"] = team_ref(player.team)
    return data


def serialize_player_detail(player: Player, statistics: dict[str, Any]) -> dict[str, Any]:
    data = serialize_player(player)
    data["statistics"] = statistics
    return data


def serialize_staff(member: StaffMember) -> dict[str, Any]:
    data = {key: _safe(value) for key, value in member.public_dict().items()}
    data["team"] = team_ref(member.team) if member.team is not None else None
    return data


def serialize_season(season: Season) -> dict[str, Any]:
    return {
        "label": season.label,
        "slug": season.slug,
        "is_current": season.is_current,
        "competition": {
            "name": season.competition.name,
            "short_name": season.competition.short_name,
            "slug": season.competition.slug,
            "has_standings": season.competition.has_standings,
        },
    }


def serialize_fixture(fixture: Fixture) -> dict[str, Any]:
    season = fixture.season
    return {
        "slug": fixture.slug,
        "status": fixture.status,
        "venue": fixture.venue,
        "venue_name": fixture.venue_name,
        "kickoff_at": _safe(fixture.kickoff_at),
        "scheduled_on": _safe(fixture.scheduled_on),
        "team": team_ref(fixture.team),
        "opponent": opponent_ref(fixture.opponent),
        "competition": {
            "name": season.competition.name,
            "short_name": season.competition.short_name,
            "slug": season.competition.slug,
        },
        "season": season.label,
        "our_score": fixture.our_score,
        "their_score": fixture.their_score,
        # Same numbers re-expressed for a scoreline, so no consumer has to work
        # out which side we were.
        "home_score": fixture.home_score,
        "away_score": fixture.away_score,
        "result": fixture.result_letter,
        "is_completed": fixture.is_completed,
    }


def serialize_match_event(event: MatchEvent) -> dict[str, Any]:
    return {
        "type": event.event_type,
        "minute": event.minute,
        "added_time": event.added_time,
        "is_opposition": event.is_opposition,
        "player": player_ref(event.player) if event.player is not None else None,
        "related_player": (
            player_ref(event.related_player) if event.related_player is not None else None
        ),
        "note": event.note,
    }


def serialize_lineup_entry(stat: PlayerMatchStatistic) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "player": player_ref(stat.player),
        "role": stat.lineup_role,
        "minutes_played": stat.minutes_played,
        "goals": stat.goals,
        "assists": stat.assists,
        "yellow_cards": stat.yellow_cards,
        "red_cards": stat.red_cards,
    }
    # Goalkeeping numbers are omitted for outfield players rather than sent as
    # zeros, which would read as "kept no clean sheet".
    if stat.player.position == PlayerPosition.GOALKEEPER:
        entry["clean_sheet"] = stat.clean_sheet
        entry["goals_conceded"] = stat.goals_conceded
        entry["saves"] = stat.saves
    return entry


def serialize_match_detail(fixture: Fixture) -> dict[str, Any]:
    data = serialize_fixture(fixture)
    statistics = fixture.player_statistics
    data["report"] = fixture.report
    data["player_of_the_match"] = (
        player_ref(fixture.player_of_the_match) if fixture.player_of_the_match is not None else None
    )
    data["events"] = [serialize_match_event(event) for event in fixture.events]
    data["lineup"] = {
        "starters": [
            serialize_lineup_entry(s) for s in statistics if s.lineup_role == LineupRole.STARTER
        ],
        "substitutes": [
            serialize_lineup_entry(s) for s in statistics if s.lineup_role == LineupRole.SUBSTITUTE
        ],
        "unused_substitutes": [
            serialize_lineup_entry(s)
            for s in statistics
            if s.lineup_role == LineupRole.UNUSED_SUBSTITUTE
        ],
    }
    return data


def serialize_standing(standing: LeagueStanding) -> dict[str, Any]:
    if standing.team is not None:
        club = {
            "name": standing.team.name,
            "short_name": standing.team.short_name,
            "slug": standing.team.slug,
        }
    else:
        assert standing.opponent is not None  # noqa: S101 — guaranteed by CHECK
        club = {
            "name": standing.opponent.name,
            "short_name": standing.opponent.short_name,
            "slug": standing.opponent.slug,
        }

    return {
        "position": standing.position,
        "club": club,
        # A boolean, not a name match, so the table highlight cannot be fooled
        # by an opponent with a similar name.
        "is_our_club": standing.is_our_club,
        "played": standing.played,
        "won": standing.won,
        "drawn": standing.drawn,
        "lost": standing.lost,
        "goals_for": standing.goals_for,
        "goals_against": standing.goals_against,
        "goal_difference": standing.goal_difference,
        "points": standing.points,
    }


def serialize_player_admin(player: Player) -> dict[str, Any]:
    """Full record including club-internal fields.

    Only reachable behind VIEW_PRIVATE_PLAYER_DATA with team scope. Kept
    separate from serialize_player so the public shape cannot drift into
    exposing these by accident.
    """
    data = serialize_player(player)
    data.update(
        {
            "team_id": str(player.team_id),
            "date_of_birth": _safe(player.date_of_birth),
            "phone": player.phone,
            "emergency_contact_name": player.emergency_contact_name,
            "emergency_contact_phone": player.emergency_contact_phone,
            "internal_notes": player.internal_notes,
        }
    )
    return data


def serialize_staff_admin(member: StaffMember) -> dict[str, Any]:
    data = serialize_staff(member)
    data.update(
        {
            "team_id": str(member.team_id) if member.team_id else None,
            "is_active": member.is_active,
            "email": member.email,
            "phone": member.phone,
        }
    )
    return data


def serialize_article_summary(article: Article) -> dict[str, Any]:
    return {
        "slug": article.slug,
        "title": article.title,
        "summary": article.summary,
        "published_at": _safe(article.published_at),
        "category": {"name": article.category.name, "slug": article.category.slug},
        "team": team_ref(article.team) if article.team is not None else None,
        "author": article.display_author,
    }


def serialize_article(article: Article) -> dict[str, Any]:
    data = serialize_article_summary(article)
    # Sanitised again on the way out, not only on the way in. If the allow-list
    # is ever tightened, content saved under the old rules is cleaned too.
    data["body_html"] = sanitize_html(article.body_html)
    data["fixture"] = {"slug": article.fixture.slug} if article.fixture is not None else None
    return data


def serialize_article_admin(article: Article) -> dict[str, Any]:
    data = serialize_article(article)
    data.update(
        {
            "id": str(article.id),
            "status": article.status,
            "byline": article.byline,
            "category_id": str(article.category_id),
            "team_id": str(article.team_id) if article.team_id else None,
            "fixture_id": str(article.fixture_id) if article.fixture_id else None,
            "created_at": _safe(article.created_at),
            "updated_at": _safe(article.updated_at),
        }
    )
    return data
