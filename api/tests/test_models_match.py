from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    Club,
    Competition,
    Fixture,
    FixtureStatus,
    LeagueStanding,
    LineupRole,
    MatchEvent,
    MatchEventType,
    Opponent,
    Player,
    PlayerMatchStatistic,
    PlayerPosition,
    Season,
    Team,
    TeamGender,
    Venue,
)


def make_season() -> Season:
    competition = Competition(
        name="Kajiado County League",
        short_name="County League",
        slug="kajiado-county-league",
    )
    db.session.add(competition)
    db.session.flush()
    season = Season(
        competition_id=competition.id,
        label="2026/27",
        slug="kajiado-county-league-2026-27",
        is_current=True,
    )
    db.session.add(season)
    db.session.flush()
    return season


def make_team(slug: str = "marines-men") -> Team:
    club = db.session.query(Club).first()
    if club is None:
        club = Club(name="Kitengela Marines", short_name="Marines", slug="kitengela-marines")
        db.session.add(club)
        db.session.flush()
    team = Team(
        club_id=club.id,
        name=slug,
        short_name=slug,
        slug=slug,
        gender=TeamGender.MEN,
        accent_key=slug,
    )
    db.session.add(team)
    db.session.flush()
    return team


def make_opponent(name: str = "Rivals FC") -> Opponent:
    opponent = Opponent(name=name, short_name=name, slug=name.lower().replace(" ", "-"))
    db.session.add(opponent)
    db.session.flush()
    return opponent


def make_fixture(**kwargs: object) -> Fixture:
    season = kwargs.pop("season", None) or make_season()
    team = kwargs.pop("team", None) or make_team()
    opponent = kwargs.pop("opponent", None) or make_opponent()
    fixture = Fixture(
        team_id=team.id,
        opponent_id=opponent.id,
        season_id=season.id,
        slug=kwargs.pop("slug", "marines-v-rivals"),
        venue=kwargs.pop("venue", Venue.HOME),
        kickoff_at=kwargs.pop("kickoff_at", datetime(2026, 10, 3, 15, 0, tzinfo=UTC)),
        **kwargs,
    )
    db.session.add(fixture)
    db.session.flush()
    return fixture


def test_one_row_serves_both_fixture_and_result_views(session: object) -> None:
    fixture = make_fixture()
    db.session.commit()

    assert fixture.is_upcoming is True
    assert fixture.is_completed is False
    assert fixture.result_letter is None

    # Entering the score is the only action. No second record is created.
    fixture.status = FixtureStatus.COMPLETED
    fixture.our_score = 2
    fixture.their_score = 1
    db.session.commit()

    assert db.session.query(Fixture).count() == 1
    assert fixture.is_upcoming is False
    assert fixture.is_completed is True
    assert fixture.result_letter == "W"


@pytest.mark.parametrize(
    ("ours", "theirs", "expected"),
    [(3, 0, "W"), (1, 1, "D"), (0, 2, "L")],
)
def test_result_letter_is_from_the_club_perspective(
    session: object, ours: int, theirs: int, expected: str
) -> None:
    fixture = make_fixture(status=FixtureStatus.COMPLETED, our_score=ours, their_score=theirs)
    db.session.commit()
    assert fixture.result_letter == expected


def test_away_scores_are_flipped_for_home_away_display(session: object) -> None:
    fixture = make_fixture(
        venue=Venue.AWAY,
        status=FixtureStatus.COMPLETED,
        our_score=2,
        their_score=1,
    )
    db.session.commit()

    # We won 2-1 away, so the scoreline reads 1-2.
    assert fixture.home_score == 1
    assert fixture.away_score == 2
    assert fixture.result_letter == "W"


def test_completed_fixture_requires_a_score(session: object) -> None:
    # make_fixture flushes, so the CHECK fires there rather than at commit.
    with pytest.raises(IntegrityError):
        make_fixture(status=FixtureStatus.COMPLETED)
    db.session.rollback()


def test_negative_scores_are_rejected(session: object) -> None:
    with pytest.raises(IntegrityError):
        make_fixture(status=FixtureStatus.COMPLETED, our_score=-1, their_score=0)
    db.session.rollback()


def test_events_order_by_minute_with_unminuted_last(session: object) -> None:
    fixture = make_fixture()
    db.session.add_all(
        [
            MatchEvent(fixture_id=fixture.id, event_type=MatchEventType.GOAL, minute=67),
            MatchEvent(fixture_id=fixture.id, event_type=MatchEventType.GOAL, minute=12),
            MatchEvent(fixture_id=fixture.id, event_type=MatchEventType.YELLOW_CARD),
        ]
    )
    db.session.commit()
    db.session.refresh(fixture)

    assert [event.minute for event in fixture.events] == [12, 67, None]


def test_opposition_goal_needs_no_player_of_ours(session: object) -> None:
    fixture = make_fixture()
    event = MatchEvent(
        fixture_id=fixture.id,
        event_type=MatchEventType.GOAL,
        minute=22,
        is_opposition=True,
    )
    db.session.add(event)
    db.session.commit()

    assert event.player_id is None
    assert event.is_opposition is True


def test_a_player_has_one_statistic_row_per_fixture(session: object) -> None:
    team = make_team()
    fixture = make_fixture(team=team)
    player = Player(
        team_id=team.id,
        first_name="Stat",
        last_name="Player",
        slug="stat-player",
        position=PlayerPosition.FORWARD,
    )
    db.session.add(player)
    db.session.flush()

    for _ in range(2):
        db.session.add(
            PlayerMatchStatistic(
                fixture_id=fixture.id,
                player_id=player.id,
                lineup_role=LineupRole.STARTER,
            )
        )
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_goalkeeper_only_stats_stay_null_for_outfield(session: object) -> None:
    team = make_team()
    fixture = make_fixture(team=team)
    player = Player(
        team_id=team.id,
        first_name="Out",
        last_name="Field",
        slug="out-field",
        position=PlayerPosition.MIDFIELDER,
    )
    db.session.add(player)
    db.session.flush()

    stat = PlayerMatchStatistic(
        fixture_id=fixture.id,
        player_id=player.id,
        lineup_role=LineupRole.STARTER,
        minutes_played=90,
        goals=1,
    )
    db.session.add(stat)
    db.session.commit()

    # Not applicable, rather than "kept no clean sheet".
    assert stat.clean_sheet is None
    assert stat.saves is None


def test_standing_names_exactly_one_club(session: object) -> None:
    season = make_season()
    team = make_team()
    opponent = make_opponent()

    ours = LeagueStanding(season_id=season.id, team_id=team.id, position=1, points=10)
    theirs = LeagueStanding(season_id=season.id, opponent_id=opponent.id, position=2, points=8)
    db.session.add_all([ours, theirs])
    db.session.commit()

    assert ours.is_our_club is True
    assert theirs.is_our_club is False

    db.session.add(
        LeagueStanding(
            season_id=season.id,
            team_id=team.id,
            opponent_id=opponent.id,
            position=3,
        )
    )
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_goal_difference_is_derived_not_stored(session: object) -> None:
    season = make_season()
    standing = LeagueStanding(
        season_id=season.id,
        team_id=make_team().id,
        position=1,
        goals_for=14,
        goals_against=5,
    )
    db.session.add(standing)
    db.session.commit()

    assert standing.goal_difference == 9
