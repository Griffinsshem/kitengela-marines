"""Player statistics, aggregated from match records.

Nothing is stored on the player. Correcting a scoresheet corrects every total
that derives from it, which is the only way totals stay honest when results are
entered by hand.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import case, func, select

from app.extensions import db
from app.models.enums import FixtureStatus, LineupRole, PlayerPosition
from app.models.match import Fixture, PlayerMatchStatistic
from app.models.people import Player


def season_statistics(player: Player, season_id: uuid.UUID | None = None) -> dict[str, Any]:
    """Totals over completed matches, optionally scoped to one season.

    Only completed fixtures count, so a provisional line-up on a postponed
    match cannot inflate an appearance record.
    """
    appeared = PlayerMatchStatistic.lineup_role != LineupRole.UNUSED_SUBSTITUTE
    started = PlayerMatchStatistic.lineup_role == LineupRole.STARTER

    stmt = (
        select(
            func.coalesce(func.sum(case((appeared, 1), else_=0)), 0),
            func.coalesce(func.sum(case((started, 1), else_=0)), 0),
            func.coalesce(func.sum(PlayerMatchStatistic.minutes_played), 0),
            func.coalesce(func.sum(PlayerMatchStatistic.goals), 0),
            func.coalesce(func.sum(PlayerMatchStatistic.assists), 0),
            func.coalesce(func.sum(PlayerMatchStatistic.yellow_cards), 0),
            func.coalesce(func.sum(PlayerMatchStatistic.red_cards), 0),
            func.coalesce(
                func.sum(case((PlayerMatchStatistic.clean_sheet.is_(True), 1), else_=0)), 0
            ),
            func.coalesce(func.sum(PlayerMatchStatistic.goals_conceded), 0),
            func.coalesce(func.sum(PlayerMatchStatistic.saves), 0),
        )
        .join(Fixture, Fixture.id == PlayerMatchStatistic.fixture_id)
        .where(
            PlayerMatchStatistic.player_id == player.id,
            Fixture.status == FixtureStatus.COMPLETED,
        )
    )
    if season_id is not None:
        stmt = stmt.where(Fixture.season_id == season_id)

    row = db.session.execute(stmt).one()

    totals: dict[str, Any] = {
        "appearances": row[0],
        "starts": row[1],
        "minutes_played": row[2],
        "goals": row[3],
        "assists": row[4],
        "yellow_cards": row[5],
        "red_cards": row[6],
    }
    if player.position == PlayerPosition.GOALKEEPER:
        totals["clean_sheets"] = row[7]
        totals["goals_conceded"] = row[8]
        totals["saves"] = row[9]
    return totals
