from __future__ import annotations

from datetime import UTC, datetime

import pytest
from flask.testing import FlaskClient

from app.extensions import db
from app.models import (
    FixtureStatus,
    LeagueStanding,
    LineupRole,
    PlayerMatchStatistic,
    PlayerPosition,
    PlayerStatus,
    TeamGender,
    Venue,
)
from tests import factories


def test_empty_collections_return_200_not_404(session: object, client: FlaskClient) -> None:
    """A club with no data yet gets empty lists, so the UI shows empty states."""
    for path in ("/api/v1/teams", "/api/v1/fixtures", "/api/v1/results", "/api/v1/standings"):
        response = client.get(path)
        assert response.status_code == 200, path
        assert response.get_json()["data"] == [], path

    club_response = client.get("/api/v1/club")
    assert club_response.status_code == 200
    assert club_response.get_json()["data"] is None


def test_team_list_excludes_inactive_teams(session: object, client: FlaskClient) -> None:
    factories.team("marines-men", display_order=1)
    factories.team("starlets", gender=TeamGender.WOMEN, display_order=2)
    factories.team("retired-side", is_active=False, display_order=3)
    db.session.commit()

    data = client.get("/api/v1/teams").get_json()["data"]

    assert [team["slug"] for team in data] == ["marines-men", "starlets"]


def test_squad_is_grouped_by_position(session: object, client: FlaskClient) -> None:
    team = factories.team()
    factories.player(team, "Keeper", "One", position=PlayerPosition.GOALKEEPER, squad_number=1)
    factories.player(team, "Striker", "Two", position=PlayerPosition.FORWARD, squad_number=9)
    db.session.commit()

    data = client.get("/api/v1/teams/marines-men/players").get_json()["data"]

    assert [p["squad_number"] for p in data["goalkeepers"]] == [1]
    assert [p["squad_number"] for p in data["forwards"]] == [9]
    assert data["defenders"] == []


def test_former_players_leave_the_list_but_keep_their_url(
    session: object, client: FlaskClient
) -> None:
    team = factories.team()
    factories.player(team, "Former", "Player", status=PlayerStatus.FORMER)
    db.session.commit()

    listed = client.get("/api/v1/teams/marines-men/players").get_json()
    assert listed["meta"]["total"] == 0

    # The profile still resolves, so shared links and old reports do not break.
    profile = client.get("/api/v1/teams/marines-men/players/former-player")
    assert profile.status_code == 200


def test_player_payload_omits_private_fields(session: object, client: FlaskClient) -> None:
    team = factories.team()
    factories.player(
        team,
        "Private",
        "Fields",
        phone="+254700000000",
        internal_notes="internal",
        emergency_contact_name="Next Of Kin",
    )
    db.session.commit()

    data = client.get("/api/v1/teams/marines-men/players/private-fields").get_json()["data"]

    for private in ("phone", "internal_notes", "emergency_contact_name", "date_of_birth"):
        assert private not in data


def test_outfield_player_has_no_goalkeeping_statistics(
    session: object, client: FlaskClient
) -> None:
    team = factories.team()
    factories.player(team, "Out", "Field", position=PlayerPosition.MIDFIELDER)
    factories.player(team, "Keeper", "One", position=PlayerPosition.GOALKEEPER, slug="keeper-one")
    db.session.commit()

    outfield = client.get("/api/v1/teams/marines-men/players/out-field").get_json()["data"]
    keeper = client.get("/api/v1/teams/marines-men/players/keeper-one").get_json()["data"]

    assert "clean_sheets" not in outfield["statistics"]
    assert keeper["statistics"]["clean_sheets"] == 0


def test_statistics_aggregate_from_completed_matches_only(
    session: object, client: FlaskClient
) -> None:
    team = factories.team()
    current = factories.season()
    player = factories.player(team, "Goal", "Scorer")

    played = factories.fixture(
        team,
        current,
        slug="played",
        status=FixtureStatus.COMPLETED,
        our_score=2,
        their_score=0,
    )
    upcoming = factories.fixture(
        team, current, slug="upcoming", opponent=factories.opponent("Other FC")
    )

    db.session.add_all(
        [
            PlayerMatchStatistic(
                fixture_id=played.id,
                player_id=player.id,
                lineup_role=LineupRole.STARTER,
                minutes_played=90,
                goals=2,
            ),
            PlayerMatchStatistic(
                fixture_id=upcoming.id,
                player_id=player.id,
                lineup_role=LineupRole.STARTER,
                minutes_played=90,
                goals=5,
            ),
        ]
    )
    db.session.commit()

    stats = client.get("/api/v1/teams/marines-men/players/goal-scorer").get_json()["data"][
        "statistics"
    ]

    # The unplayed match contributes nothing.
    assert stats["appearances"] == 1
    assert stats["goals"] == 2


def test_one_row_moves_from_fixtures_to_results(session: object, client: FlaskClient) -> None:
    team = factories.team()
    current = factories.season()
    match = factories.fixture(team, current)
    db.session.commit()

    assert len(client.get("/api/v1/fixtures").get_json()["data"]) == 1
    assert client.get("/api/v1/results").get_json()["data"] == []

    match.status = FixtureStatus.COMPLETED
    match.our_score = 2
    match.their_score = 1
    db.session.commit()

    assert client.get("/api/v1/fixtures").get_json()["data"] == []
    results = client.get("/api/v1/results").get_json()["data"]
    assert len(results) == 1
    assert results[0]["result"] == "W"


def test_away_result_reads_as_a_scoreline(session: object, client: FlaskClient) -> None:
    team = factories.team()
    current = factories.season()
    factories.fixture(
        team,
        current,
        venue=Venue.AWAY,
        status=FixtureStatus.COMPLETED,
        our_score=2,
        their_score=1,
    )
    db.session.commit()

    result = client.get("/api/v1/results").get_json()["data"][0]

    assert result["home_score"] == 1
    assert result["away_score"] == 2
    assert result["result"] == "W"


def test_fixtures_can_be_filtered_by_team(session: object, client: FlaskClient) -> None:
    men = factories.team("marines-men")
    starlets = factories.team("starlets", gender=TeamGender.WOMEN)
    current = factories.season()
    factories.fixture(men, current, slug="men-match")
    factories.fixture(
        starlets, current, slug="starlets-match", opponent=factories.opponent("Other FC")
    )
    db.session.commit()

    data = client.get("/api/v1/fixtures?team=starlets").get_json()["data"]

    assert [f["slug"] for f in data] == ["starlets-match"]


def test_dates_are_iso_8601(session: object, client: FlaskClient) -> None:
    team = factories.team()
    current = factories.season()
    factories.fixture(team, current, kickoff_at=datetime(2026, 10, 3, 15, 0, tzinfo=UTC))
    db.session.commit()

    kickoff = client.get("/api/v1/fixtures").get_json()["data"][0]["kickoff_at"]

    # Parseable ISO 8601 with an explicit offset, not an RFC 822 HTTP date.
    # The rendered offset follows the database session timezone, so assert on
    # the instant rather than the wall-clock text.
    parsed = datetime.fromisoformat(kickoff)
    assert parsed.tzinfo is not None
    assert parsed.astimezone(UTC) == datetime(2026, 10, 3, 15, 0, tzinfo=UTC)


def test_pagination_meta_and_cap(session: object, client: FlaskClient) -> None:
    team = factories.team()
    current = factories.season()
    for index in range(5):
        factories.fixture(
            team,
            current,
            slug=f"match-{index}",
            opponent=factories.opponent(f"Club {index}"),
        )
    db.session.commit()

    body = client.get("/api/v1/fixtures?page=2&per_page=2").get_json()
    assert body["meta"] == {"page": 2, "per_page": 2, "total": 5, "pages": 3}
    assert len(body["data"]) == 2

    # An unbounded page size is refused.
    capped = client.get("/api/v1/fixtures?per_page=5000").get_json()
    assert capped["meta"]["per_page"] == 100


@pytest.mark.parametrize("query", ["page=0", "page=abc"])
def test_bad_pagination_arguments_are_rejected(
    session: object, client: FlaskClient, query: str
) -> None:
    response = client.get(f"/api/v1/fixtures?{query}")

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "bad_request"


def test_standings_highlight_our_club_without_name_matching(
    session: object, client: FlaskClient
) -> None:
    team = factories.team()
    current = factories.season()
    db.session.add_all(
        [
            LeagueStanding(
                season_id=current.id,
                opponent_id=factories.opponent("Leaders FC").id,
                position=1,
                points=12,
                goals_for=10,
                goals_against=3,
            ),
            LeagueStanding(
                season_id=current.id,
                team_id=team.id,
                position=2,
                points=10,
                goals_for=8,
                goals_against=4,
            ),
        ]
    )
    db.session.commit()

    body = client.get("/api/v1/standings").get_json()

    assert [row["position"] for row in body["data"]] == [1, 2]
    assert [row["is_our_club"] for row in body["data"]] == [False, True]
    assert body["data"][1]["goal_difference"] == 4
    assert body["meta"]["season"]["label"] == "2026/27"


def test_unknown_slug_returns_the_error_envelope(session: object, client: FlaskClient) -> None:
    response = client.get("/api/v1/teams/does-not-exist")

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "not_found"


def test_public_reads_carry_cache_headers(session: object, client: FlaskClient) -> None:
    response = client.get("/api/v1/teams")

    cache_control = response.headers["Cache-Control"]
    # The browser revalidates; the edge absorbs the traffic.
    assert "max-age=0" in cache_control
    assert "s-maxage=300" in cache_control
