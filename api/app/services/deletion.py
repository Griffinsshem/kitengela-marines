"""What deleting a fixture or a player takes with it.

Deleting a played match or a player who has played changes the club's record:
results, goal tallies, appearances. That is sometimes exactly what is needed
(a result entered twice, a player added to the wrong squad, someone who left
and should no longer be listed), so a Club Admin may do it, but never by
accident. The rule is the same for both:

- Nothing in the record depends on it: delete straight away.
- Something does: the delete is refused with a `confirmation_required` error
  that says exactly what would go, and is carried out only when repeated with
  `?confirm=true`.

The admin pages ask for the same breakdown up front, so a person sees the
consequences before pressing anything.

The database does the actual clean-up. Every foreign key on a fixture or a
player already says what happens to rows that point at it: match events and
appearances are removed with their match; articles, galleries and videos keep
existing but lose their link; a player's goals stay in the match but lose
their scorer. Nothing here deletes rows by hand.
"""

from __future__ import annotations

from typing import Any

from flask import request
from sqlalchemy import func, or_, select

from app.extensions import db
from app.models.enums import FixtureStatus
from app.models.match import Fixture, MatchEvent, PlayerMatchStatistic
from app.models.media import Gallery, Video
from app.models.news import Article
from app.models.people import Player
from app.utils.errors import ApiError


def _count(stmt: Any) -> int:
    return int(db.session.scalar(stmt) or 0)


def fixture_impact(fixture: Fixture) -> dict[str, Any]:
    """Everything that depends on a fixture, counted."""
    events = _count(
        select(func.count()).select_from(MatchEvent).where(MatchEvent.fixture_id == fixture.id)
    )
    appearances = _count(
        select(func.count())
        .select_from(PlayerMatchStatistic)
        .where(PlayerMatchStatistic.fixture_id == fixture.id)
    )
    has_result = fixture.status == FixtureStatus.COMPLETED

    return {
        "has_result": has_result,
        "score": (
            {"ours": fixture.our_score, "theirs": fixture.their_score} if has_result else None
        ),
        # Removed with the match.
        "match_events": events,
        "appearances": appearances,
        # Kept, but no longer linked to the match.
        "linked_articles": _count(
            select(func.count()).select_from(Article).where(Article.fixture_id == fixture.id)
        ),
        "linked_galleries": _count(
            select(func.count()).select_from(Gallery).where(Gallery.fixture_id == fixture.id)
        ),
        "linked_videos": _count(
            select(func.count()).select_from(Video).where(Video.fixture_id == fixture.id)
        ),
        "requires_confirmation": has_result or events > 0 or appearances > 0,
    }


def player_impact(player: Player) -> dict[str, Any]:
    """Everything in the match record that names a player, counted."""
    appearances = _count(
        select(func.count())
        .select_from(PlayerMatchStatistic)
        .where(PlayerMatchStatistic.player_id == player.id)
    )
    events = _count(
        select(func.count())
        .select_from(MatchEvent)
        .where(or_(MatchEvent.player_id == player.id, MatchEvent.related_player_id == player.id))
    )
    player_of_the_match = _count(
        select(func.count()).select_from(Fixture).where(Fixture.player_of_the_match_id == player.id)
    )

    return {
        # Removed with the player.
        "appearances": appearances,
        # Kept in their matches, but no longer credited to anyone.
        "match_events": events,
        "player_of_the_match": player_of_the_match,
        # The login, if there is one, survives; it just no longer has a
        # player profile. Deactivating it is a separate, deliberate step.
        "has_login": player.user_id is not None,
        "requires_confirmation": appearances > 0 or events > 0 or player_of_the_match > 0,
    }


def confirmed() -> bool:
    """Whether the request explicitly confirmed a delete with consequences."""
    return request.args.get("confirm", "").lower() == "true"


def require_confirmation(impact: dict[str, Any], message: str) -> None:
    """Refuse a delete that has consequences unless it was confirmed."""
    if impact["requires_confirmation"] and not confirmed():
        raise ApiError(message, status_code=409, code="confirmation_required", details=impact)
