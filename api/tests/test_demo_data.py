from __future__ import annotations

import pytest

from app.demo_data import DemoDataRefusedError, build_demo_club
from app.extensions import db
from app.models import Club, Fixture, Player, Team


def test_demo_club_fills_an_empty_database(session: object) -> None:
    build_demo_club()

    assert db.session.query(Club).count() == 1
    assert {t.slug for t in db.session.query(Team)} == {"marines-men", "starlets"}
    assert db.session.query(Player).count() == 4
    assert sorted(f.is_completed for f in db.session.query(Fixture)) == [False, True]


def test_demo_club_refuses_a_database_that_already_has_one(session: object) -> None:
    build_demo_club()
    with pytest.raises(DemoDataRefusedError):
        build_demo_club()
