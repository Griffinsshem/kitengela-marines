"""Fixtures, match events, per-player statistics and league standings.

A fixture and a result are the same row. Status decides which public view it
appears in, so entering a score moves a match from the fixtures page to the
results page without a second data entry and without two records that can
disagree.

Scores are stored from the club's perspective — our_score and their_score —
rather than home_score and away_score. Every one of these matches involves one
of our teams, and this removes a whole class of "which side were we?" bugs from
every consumer of the data.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.base import Timestamped, UUIDPrimaryKey, enum_column
from app.models.enums import FixtureStatus, LineupRole, MatchEventType, Venue

if TYPE_CHECKING:
    from app.models.club import Team
    from app.models.competition import Opponent, Season
    from app.models.people import Player


class Fixture(UUIDPrimaryKey, Timestamped, Base):
    """One match involving one of the club's teams."""

    __tablename__ = "fixtures"
    __table_args__ = (
        CheckConstraint(
            "(status <> 'completed') OR (our_score IS NOT NULL AND their_score IS NOT NULL)",
            name="ck_fixtures_completed_has_score",
        ),
        CheckConstraint(
            "(our_score IS NULL OR our_score >= 0) AND (their_score IS NULL OR their_score >= 0)",
            name="ck_fixtures_scores_non_negative",
        ),
    )

    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    opponent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("opponents.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    season_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False, index=True
    )

    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)

    kickoff_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    # Date without a confirmed kickoff time — common before a county league
    # releases its schedule in full.
    scheduled_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    venue: Mapped[Venue] = mapped_column(enum_column(Venue, "ck_fixtures_venue"), nullable=False)
    venue_name: Mapped[str | None] = mapped_column(String(160), nullable=True)

    status: Mapped[FixtureStatus] = mapped_column(
        enum_column(FixtureStatus, "ck_fixtures_status"),
        nullable=False,
        default=FixtureStatus.SCHEDULED,
        index=True,
    )

    our_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    their_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    report: Mapped[str | None] = mapped_column(Text, nullable=True)
    player_of_the_match_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"), nullable=True
    )

    team: Mapped[Team] = relationship()
    opponent: Mapped[Opponent] = relationship()
    season: Mapped[Season] = relationship(back_populates="fixtures")
    player_of_the_match: Mapped[Player | None] = relationship(foreign_keys=[player_of_the_match_id])

    events: Mapped[list[MatchEvent]] = relationship(
        back_populates="fixture",
        cascade="all, delete-orphan",
        order_by="(MatchEvent.minute.is_(None), MatchEvent.minute)",
    )
    player_statistics: Mapped[list[PlayerMatchStatistic]] = relationship(
        back_populates="fixture", cascade="all, delete-orphan"
    )

    @property
    def is_completed(self) -> bool:
        return self.status == FixtureStatus.COMPLETED

    @property
    def is_upcoming(self) -> bool:
        """Anything not yet played, including postponed matches awaiting a date."""
        return self.status in (FixtureStatus.SCHEDULED, FixtureStatus.POSTPONED)

    @property
    def result_letter(self) -> str | None:
        """W, D or L from the club's perspective. None until a score exists."""
        if not self.is_completed or self.our_score is None or self.their_score is None:
            return None
        if self.our_score > self.their_score:
            return "W"
        if self.our_score < self.their_score:
            return "L"
        return "D"

    @property
    def home_score(self) -> int | None:
        """Scores re-expressed as home/away for display."""
        if self.venue == Venue.AWAY:
            return self.their_score
        return self.our_score

    @property
    def away_score(self) -> int | None:
        if self.venue == Venue.AWAY:
            return self.our_score
        return self.their_score

    def __repr__(self) -> str:
        return f"<Fixture {self.slug} {self.status}>"


class MatchEvent(UUIDPrimaryKey, Timestamped, Base):
    """A goal, card or substitution within a match.

    player_id is nullable because an opposition goal has no player of ours
    attached; is_opposition marks which side the event belongs to.
    """

    __tablename__ = "match_events"

    fixture_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("fixtures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    player_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"), nullable=True, index=True
    )
    related_player_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"), nullable=True
    )

    event_type: Mapped[MatchEventType] = mapped_column(
        enum_column(MatchEventType, "ck_match_events_type", length=40), nullable=False
    )
    minute: Mapped[int | None] = mapped_column(Integer, nullable=True)
    added_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_opposition: Mapped[bool] = mapped_column(
        default=False, nullable=False, server_default="false"
    )
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    fixture: Mapped[Fixture] = relationship(back_populates="events")
    player: Mapped[Player | None] = relationship(foreign_keys=[player_id])
    related_player: Mapped[Player | None] = relationship(foreign_keys=[related_player_id])

    def __repr__(self) -> str:
        return f"<MatchEvent {self.event_type} {self.minute}'>"


class PlayerMatchStatistic(UUIDPrimaryKey, Timestamped, Base):
    """One player's contribution to one match.

    Season totals are aggregated from these rows rather than stored on the
    player, so correcting a match corrects every total that derives from it.
    """

    __tablename__ = "player_match_statistics"
    __table_args__ = (
        UniqueConstraint("fixture_id", "player_id", name="uq_player_stat_fixture_player"),
        CheckConstraint(
            "goals >= 0 AND assists >= 0 AND minutes_played >= 0",
            name="ck_player_stat_non_negative",
        ),
    )

    fixture_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("fixtures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True
    )

    lineup_role: Mapped[LineupRole] = mapped_column(
        enum_column(LineupRole, "ck_player_stat_lineup_role", length=40), nullable=False
    )
    minutes_played: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    goals: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assists: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    yellow_cards: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    red_cards: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Goalkeeper-only. Nullable rather than 0 so an outfield player's record
    # reads "not applicable" instead of "kept no clean sheet".
    clean_sheet: Mapped[bool | None] = mapped_column(nullable=True)
    goals_conceded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    saves: Mapped[int | None] = mapped_column(Integer, nullable=True)

    fixture: Mapped[Fixture] = relationship(back_populates="player_statistics")
    player: Mapped[Player] = relationship()

    def __repr__(self) -> str:
        return f"<PlayerMatchStatistic player={self.player_id} fixture={self.fixture_id}>"


class LeagueStanding(UUIDPrimaryKey, Timestamped, Base):
    """One row of a league table, maintained by hand.

    The county league publishes no data feed, so a Club Admin or Team Manager
    enters the table. Rows reference either one of our teams or an opponent —
    never both, never neither — so the table can name our side without
    duplicating it as an opponent record.
    """

    __tablename__ = "league_standings"
    __table_args__ = (
        UniqueConstraint("season_id", "position", name="uq_standing_season_position"),
        CheckConstraint(
            "(team_id IS NOT NULL AND opponent_id IS NULL) OR "
            "(team_id IS NULL AND opponent_id IS NOT NULL)",
            name="ck_standing_exactly_one_club",
        ),
    )

    season_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), nullable=True
    )
    opponent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("opponents.id", ondelete="CASCADE"), nullable=True
    )

    position: Mapped[int] = mapped_column(Integer, nullable=False)
    played: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    won: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    drawn: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lost: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    goals_for: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    goals_against: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    season: Mapped[Season] = relationship(back_populates="standings")
    team: Mapped[Team | None] = relationship()
    opponent: Mapped[Opponent | None] = relationship()

    @property
    def goal_difference(self) -> int:
        return self.goals_for - self.goals_against

    @property
    def is_our_club(self) -> bool:
        """Drives the row highlight, without relying on a name match."""
        return self.team_id is not None

    def __repr__(self) -> str:
        return f"<LeagueStanding {self.position} season={self.season_id}>"
