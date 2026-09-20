from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app.extensions import db
from app.models import (
    Fixture,
    FixtureStatus,
    LeagueStanding,
    LineupRole,
    MatchEvent,
    MatchEventType,
    MembershipCapacity,
    PlayerMatchStatistic,
    PlayerPosition,
    Role,
    RoleKey,
    TeamGender,
    TeamMembership,
    User,
    Venue,
)
from tests import factories

PASSWORD = "a-sufficiently-long-password"


@pytest.fixture
def roles(app: Flask) -> Iterator[dict[RoleKey, Role]]:
    keys = (RoleKey.CLUB_ADMIN, RoleKey.TEAM_MANAGER, RoleKey.COACH, RoleKey.MEDIA_OFFICER)
    with app.app_context():
        created = {key: Role(key=key, label=key.value) for key in keys}
        db.session.add_all(created.values())
        db.session.commit()
        yield created


def make_user(email: str, *role_keys: RoleKey) -> User:
    user = User(email=email, full_name="Test User")
    user.set_password(PASSWORD)
    for key in role_keys:
        user.roles.append(db.session.query(Role).filter_by(key=key).one())
    db.session.add(user)
    db.session.commit()
    return user


def attach(user: User, team: Any, capacity: MembershipCapacity) -> None:
    db.session.add(TeamMembership(user_id=user.id, team_id=team.id, capacity=capacity))
    db.session.commit()


def auth(client: FlaskClient, email: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {response.get_json()['access_token']}"}


# --- fixtures --------------------------------------------------------------


@pytest.mark.rbac
def test_manager_creates_a_fixture_for_their_own_team(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    opponent = factories.opponent()
    manager = make_user("manager@example.com", RoleKey.TEAM_MANAGER)
    attach(manager, team, MembershipCapacity.MANAGER)

    response = client.post(
        "/api/v1/admin/fixtures",
        json={
            "team_id": str(team.id),
            "opponent_id": str(opponent.id),
            "season_id": str(current.id),
            "venue": Venue.HOME.value,
            "kickoff_at": "2026-10-03T15:00:00+00:00",
        },
        headers=auth(client, "manager@example.com"),
    )

    assert response.status_code == 201
    assert response.get_json()["data"]["status"] == "scheduled"


@pytest.mark.rbac
def test_manager_cannot_create_a_fixture_for_another_team(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    starlets = factories.team("starlets", gender=TeamGender.WOMEN)
    men = factories.team("marines-men")
    current = factories.season()
    opponent = factories.opponent()
    manager = make_user("manager@example.com", RoleKey.TEAM_MANAGER)
    attach(manager, starlets, MembershipCapacity.MANAGER)

    response = client.post(
        "/api/v1/admin/fixtures",
        json={
            "team_id": str(men.id),
            "opponent_id": str(opponent.id),
            "season_id": str(current.id),
            "venue": Venue.AWAY.value,
            "scheduled_on": "2026-10-03",
        },
        headers=auth(client, "manager@example.com"),
    )

    assert response.status_code == 403
    assert db.session.query(Fixture).count() == 0


@pytest.mark.rbac
def test_coach_cannot_manage_fixtures(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    opponent = factories.opponent()
    coach = make_user("coach@example.com", RoleKey.COACH)
    attach(coach, team, MembershipCapacity.COACH)

    response = client.post(
        "/api/v1/admin/fixtures",
        json={
            "team_id": str(team.id),
            "opponent_id": str(opponent.id),
            "season_id": str(current.id),
            "venue": Venue.HOME.value,
            "scheduled_on": "2026-10-03",
        },
        headers=auth(client, "coach@example.com"),
    )

    assert response.status_code == 403


def test_fixture_needs_a_date(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    opponent = factories.opponent()
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    response = client.post(
        "/api/v1/admin/fixtures",
        json={
            "team_id": str(team.id),
            "opponent_id": str(opponent.id),
            "season_id": str(current.id),
            "venue": Venue.HOME.value,
        },
        headers=auth(client, "admin@example.com"),
    )

    assert response.status_code == 422


def test_fixture_patch_cannot_complete_a_match(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    match = factories.fixture(team, current)
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    response = client.patch(
        f"/api/v1/admin/fixtures/{match.id}",
        json={"status": FixtureStatus.COMPLETED.value},
        headers=auth(client, "admin@example.com"),
    )

    # Completing requires a score, so it must go through the result endpoint.
    assert response.status_code == 422
    db.session.refresh(match)
    assert match.status == FixtureStatus.SCHEDULED


# --- results ---------------------------------------------------------------


@pytest.mark.rbac
def test_entering_a_result_moves_the_fixture_in_one_request(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    match = factories.fixture(team, current)
    scorer = factories.player(team, "Goal", "Scorer", position=PlayerPosition.FORWARD)
    keeper = factories.player(
        team, "Safe", "Hands", slug="safe-hands", position=PlayerPosition.GOALKEEPER
    )
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    response = client.put(
        f"/api/v1/admin/fixtures/{match.id}/result",
        json={
            "our_score": 2,
            "their_score": 1,
            "report": "A hard-fought win.",
            "player_of_the_match_id": str(scorer.id),
            "events": [
                {
                    "event_type": MatchEventType.GOAL.value,
                    "minute": 23,
                    "player_id": str(scorer.id),
                },
                {
                    "event_type": MatchEventType.GOAL.value,
                    "minute": 55,
                    "is_opposition": True,
                },
            ],
            "lineup": [
                {
                    "player_id": str(scorer.id),
                    "lineup_role": LineupRole.STARTER.value,
                    "minutes_played": 90,
                    "goals": 2,
                },
                {
                    "player_id": str(keeper.id),
                    "lineup_role": LineupRole.STARTER.value,
                    "minutes_played": 90,
                    "clean_sheet": False,
                    "goals_conceded": 1,
                    "saves": 4,
                },
            ],
        },
        headers=auth(client, "admin@example.com"),
    )

    assert response.status_code == 200
    body = response.get_json()["data"]
    assert body["result"] == "W"
    assert len(body["events"]) == 2

    # One write. Both public views react.
    assert client.get("/api/v1/fixtures").get_json()["data"] == []
    assert len(client.get("/api/v1/results").get_json()["data"]) == 1


def test_outfield_goalkeeping_numbers_are_discarded(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    match = factories.fixture(team, current)
    outfield = factories.player(team, "Out", "Field", position=PlayerPosition.DEFENDER)
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    client.put(
        f"/api/v1/admin/fixtures/{match.id}/result",
        json={
            "our_score": 1,
            "their_score": 0,
            "lineup": [
                {
                    "player_id": str(outfield.id),
                    "lineup_role": LineupRole.STARTER.value,
                    "minutes_played": 90,
                    "clean_sheet": True,
                    "saves": 8,
                }
            ],
        },
        headers=auth(client, "admin@example.com"),
    )

    stat = db.session.query(PlayerMatchStatistic).one()
    # Not applicable, rather than a defender credited with saves.
    assert stat.clean_sheet is None
    assert stat.saves is None


def test_result_rejects_players_from_another_squad(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    other = factories.team("starlets", gender=TeamGender.WOMEN)
    current = factories.season()
    match = factories.fixture(team, current)
    outsider = factories.player(other, "Wrong", "Squad")
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    response = client.put(
        f"/api/v1/admin/fixtures/{match.id}/result",
        json={
            "our_score": 1,
            "their_score": 0,
            "lineup": [{"player_id": str(outsider.id), "lineup_role": LineupRole.STARTER.value}],
        },
        headers=auth(client, "admin@example.com"),
    )

    assert response.status_code == 422
    # Nothing was written: the fixture is untouched.
    db.session.refresh(match)
    assert match.status == FixtureStatus.SCHEDULED
    assert match.our_score is None


def test_resubmitting_a_result_replaces_events_and_lineup(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    match = factories.fixture(team, current)
    player = factories.player(team, "Goal", "Scorer", position=PlayerPosition.FORWARD)
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()
    headers = auth(client, "admin@example.com")

    body = {
        "our_score": 3,
        "their_score": 0,
        "events": [
            {"event_type": MatchEventType.GOAL.value, "minute": m, "player_id": str(player.id)}
            for m in (10, 20, 30)
        ],
        "lineup": [
            {"player_id": str(player.id), "lineup_role": LineupRole.STARTER.value, "goals": 3}
        ],
    }
    client.put(f"/api/v1/admin/fixtures/{match.id}/result", json=body, headers=headers)
    assert db.session.query(MatchEvent).count() == 3

    # A correction: it was actually 2-0.
    body["our_score"] = 2
    body["events"] = body["events"][:2]
    body["lineup"][0]["goals"] = 2
    client.put(f"/api/v1/admin/fixtures/{match.id}/result", json=body, headers=headers)

    assert db.session.query(MatchEvent).count() == 2
    assert db.session.query(PlayerMatchStatistic).one().goals == 2


def test_starting_eleven_is_capped(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    match = factories.fixture(team, current)
    squad = [factories.player(team, f"Player{i}", "Test", slug=f"player-{i}") for i in range(12)]
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    response = client.put(
        f"/api/v1/admin/fixtures/{match.id}/result",
        json={
            "our_score": 0,
            "their_score": 0,
            "lineup": [
                {"player_id": str(p.id), "lineup_role": LineupRole.STARTER.value} for p in squad
            ],
        },
        headers=auth(client, "admin@example.com"),
    )

    assert response.status_code == 422


def test_completed_match_cannot_be_deleted(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    match = factories.fixture(
        team, current, status=FixtureStatus.COMPLETED, our_score=1, their_score=0
    )
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    response = client.delete(
        f"/api/v1/admin/fixtures/{match.id}", headers=auth(client, "admin@example.com")
    )

    assert response.status_code == 409
    assert db.session.query(Fixture).count() == 1


# --- standings -------------------------------------------------------------


def _standings_body(season: Any, team: Any, opponent: Any) -> dict[str, Any]:
    return {
        "season_id": str(season.id),
        "rows": [
            {
                "position": 1,
                "opponent_id": str(opponent.id),
                "played": 3,
                "won": 3,
                "drawn": 0,
                "lost": 0,
                "goals_for": 7,
                "goals_against": 1,
                "points": 9,
            },
            {
                "position": 2,
                "team_id": str(team.id),
                "played": 3,
                "won": 2,
                "drawn": 0,
                "lost": 1,
                "goals_for": 5,
                "goals_against": 3,
                "points": 6,
            },
        ],
    }


@pytest.mark.rbac
def test_manager_replaces_the_league_table(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    opponent = factories.opponent("Leaders FC")
    manager = make_user("manager@example.com", RoleKey.TEAM_MANAGER)
    attach(manager, team, MembershipCapacity.MANAGER)

    response = client.put(
        "/api/v1/admin/standings",
        json=_standings_body(current, team, opponent),
        headers=auth(client, "manager@example.com"),
    )

    assert response.status_code == 200
    rows = response.get_json()["data"]
    assert [row["is_our_club"] for row in rows] == [False, True]
    assert rows[1]["goal_difference"] == 2


@pytest.mark.parametrize(
    "mutate",
    [
        pytest.param(lambda body: body["rows"][0].update({"won": 2}), id="record-does-not-add-up"),
        pytest.param(lambda body: body["rows"][1].update({"position": 1}), id="duplicate-position"),
        pytest.param(lambda body: body["rows"][1].update({"position": 5}), id="gap-in-positions"),
    ],
)
def test_inconsistent_tables_are_rejected(
    session: object,
    client: FlaskClient,
    roles: dict[RoleKey, Role],
    mutate: Any,
) -> None:
    team = factories.team()
    current = factories.season()
    opponent = factories.opponent("Leaders FC")
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    body = _standings_body(current, team, opponent)
    mutate(body)

    response = client.put(
        "/api/v1/admin/standings", json=body, headers=auth(client, "admin@example.com")
    )

    assert response.status_code == 422
    assert db.session.query(LeagueStanding).count() == 0


def test_media_officer_cannot_touch_standings(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    opponent = factories.opponent("Leaders FC")
    make_user("media@example.com", RoleKey.MEDIA_OFFICER)
    db.session.commit()

    response = client.put(
        "/api/v1/admin/standings",
        json=_standings_body(current, team, opponent),
        headers=auth(client, "media@example.com"),
    )

    assert response.status_code == 403
