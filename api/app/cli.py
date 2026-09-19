"""Administrative CLI commands."""

from __future__ import annotations

import click
from flask import Flask
from flask.cli import AppGroup

from app.extensions import db
from app.models.enums import RoleKey
from app.models.identity import Role, User

ROLE_LABELS: dict[RoleKey, str] = {
    RoleKey.CLUB_ADMIN: "Club Admin",
    RoleKey.MEDIA_OFFICER: "Media Officer",
    RoleKey.TEAM_MANAGER: "Team Manager",
    RoleKey.COACH: "Coach",
    RoleKey.PLAYER: "Player",
    RoleKey.SUPPORTER: "Supporter",
}


def register_cli(app: Flask) -> None:
    seed = AppGroup("seed", help="Seed reference data.")

    @seed.command("roles")
    def seed_roles() -> None:
        """Insert any missing role rows. Safe to run repeatedly."""
        created = 0
        for key, label in ROLE_LABELS.items():
            if db.session.query(Role).filter_by(key=key).first() is None:
                db.session.add(Role(key=key, label=label))
                created += 1
        db.session.commit()
        click.echo(f"Roles seeded. {created} created.")

    @seed.command("admin")
    @click.option("--email", required=True)
    @click.option("--name", required=True)
    @click.password_option(confirmation_prompt=True)
    def seed_admin(email: str, name: str, password: str) -> None:
        if len(password) < 12:
            raise click.ClickException("Password must be at least 12 characters.")

        if db.session.query(User).filter_by(email=email.lower()).first() is not None:
            raise click.ClickException("A user with that email already exists.")

        role = db.session.query(Role).filter_by(key=RoleKey.CLUB_ADMIN).first()
        if role is None:
            raise click.ClickException("Run 'flask seed roles' first.")

        user = User(email=email, full_name=name)
        user.set_password(password)
        user.roles.append(role)
        db.session.add(user)
        db.session.commit()

        click.echo(f"Club Admin created: {user.email}")

    app.cli.add_command(seed)
