"""A small, realistic club for local work and the end-to-end tests.

`flask seed demo` builds it on an empty database: the club, both teams, a
current season, a few players, one fixture still to play and one result.
Enough for every public page to render real content instead of empty states.

Refused in production, where it would put invented matches on the real site.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.extensions import db
from app.models import (
    Club,
    Competition,
    Fixture,
    FixtureStatus,
    Opponent,
    Player,
    PlayerPosition,
    Season,
    Team,
    TeamCategory,
    TeamGender,
    Venue,
)


class DemoDataRefusedError(Exception):
    pass


def build_demo_club(*, now: datetime | None = None) -> None:
    if db.session.query(Club).first() is not None:
        raise DemoDataRefusedError("This database already has a club; demo data is for empty ones.")

    now = now or datetime.now(UTC)
    noon = now.replace(hour=12, minute=0, second=0, microsecond=0)

    club = Club(
        name="Kitengela Marines",
        short_name="Marines",
        slug="kitengela-marines",
        founded_year=2015,
        home_ground="Kitengela Stadium",
        town="Kitengela",
        county="Kajiado County",
        summary="A community football club from Kitengela.",
    )
    db.session.add(club)
    db.session.flush()

    men = Team(
        club_id=club.id,
        name="Kitengela Marines",
        short_name="Marines",
        slug="marines-men",
        category=TeamCategory.SENIOR,
        gender=TeamGender.MEN,
        accent_key="marines-men",
        summary="The men's first team.",
        display_order=0,
    )
    starlets = Team(
        club_id=club.id,
        name="Marines Starlets",
        short_name="Starlets",
        slug="starlets",
        category=TeamCategory.SENIOR,
        gender=TeamGender.WOMEN,
        accent_key="starlets",
        summary="The women's first team.",
        display_order=1,
    )
    db.session.add_all([men, starlets])

    competition = Competition(
        name="Kajiado County League", short_name="County League", slug="kajiado-county-league"
    )
    db.session.add(competition)
    db.session.flush()
    season = Season(
        competition_id=competition.id,
        label="2026/27",
        slug="kajiado-county-league-2026-27",
        is_current=True,
    )
    rovers = Opponent(name="Isinya Rovers", short_name="Rovers", slug="isinya-rovers")
    united = Opponent(name="Athi River United", short_name="Athi River", slug="athi-river-united")
    db.session.add_all([season, rovers, united])
    db.session.flush()

    squads = {
        men: [
            ("Brian", "Otieno", PlayerPosition.GOALKEEPER),
            ("Kevin", "Mutua", PlayerPosition.FORWARD),
        ],
        starlets: [
            ("Faith", "Wanjiru", PlayerPosition.DEFENDER),
            ("Mercy", "Akinyi", PlayerPosition.MIDFIELDER),
        ],
    }
    for team, names in squads.items():
        for number, (first, last, position) in enumerate(names, start=1):
            db.session.add(
                Player(
                    team_id=team.id,
                    first_name=first,
                    last_name=last,
                    slug=f"{first}-{last}".lower(),
                    position=position,
                    squad_number=number,
                )
            )

    db.session.add_all(
        [
            Fixture(
                team_id=men.id,
                opponent_id=rovers.id,
                season_id=season.id,
                slug="marines-v-isinya-rovers",
                venue=Venue.HOME,
                venue_name="Kitengela Stadium",
                kickoff_at=noon + timedelta(days=7),
                status=FixtureStatus.SCHEDULED,
            ),
            Fixture(
                team_id=starlets.id,
                opponent_id=united.id,
                season_id=season.id,
                slug="athi-river-united-v-starlets",
                venue=Venue.AWAY,
                kickoff_at=noon - timedelta(days=7),
                status=FixtureStatus.COMPLETED,
                our_score=2,
                their_score=1,
                report="A late winner on the road.",
            ),
        ]
    )
    db.session.commit()
