from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.extensions import db
from app.models.base import Timestamped, UUIDPrimaryKey, enum_column
from app.models.enums import MembershipCapacity, RoleKey
from app.security.passwords import hash_password, verify_password

if TYPE_CHECKING:
    from app.models.club import Team


user_roles = Table(
    "user_roles",
    db.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


class Role(UUIDPrimaryKey, Timestamped, db.Model):
    __tablename__ = "roles"

    key: Mapped[RoleKey] = mapped_column(
        enum_column(RoleKey, "ck_roles_key"), nullable=False, unique=True, index=True
    )
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    users: Mapped[list[User]] = relationship(secondary=user_roles, back_populates="roles")

    def __repr__(self) -> str:
        return f"<Role {self.key}>"


class User(UUIDPrimaryKey, Timestamped, db.Model):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    roles: Mapped[list[Role]] = relationship(secondary=user_roles, back_populates="users")
    memberships: Mapped[list[TeamMembership]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @validates("email")
    def _normalise_email(self, _key: str, value: str) -> str:
        return value.strip().lower()

    def set_password(self, plaintext: str) -> None:
        self.password_hash = hash_password(plaintext)

    def check_password(self, plaintext: str) -> bool:
        return verify_password(self.password_hash, plaintext)

    @property
    def role_keys(self) -> set[RoleKey]:
        return {role.key for role in self.roles}

    def has_role(self, key: RoleKey) -> bool:
        return key in self.role_keys

    @property
    def is_club_admin(self) -> bool:
        return self.has_role(RoleKey.CLUB_ADMIN)

    def team_ids_for(self, *capacities: MembershipCapacity) -> set[uuid.UUID]:
        wanted = set(capacities)
        return {
            membership.team_id
            for membership in self.memberships
            if membership.is_active and (not wanted or membership.capacity in wanted)
        }

    def __repr__(self) -> str:
        return f"<User {self.email}>"


class TeamMembership(UUIDPrimaryKey, Timestamped, db.Model):
    __tablename__ = "team_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "team_id", "capacity", name="uq_membership_user_team_capacity"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    capacity: Mapped[MembershipCapacity] = mapped_column(
        enum_column(MembershipCapacity, "ck_membership_capacity"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    user: Mapped[User] = relationship(back_populates="memberships")
    team: Mapped[Team] = relationship(back_populates="memberships")

    def __repr__(self) -> str:
        return f"<TeamMembership {self.capacity} team={self.team_id}>"
