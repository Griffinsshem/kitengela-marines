"""Password hashing.

Argon2id via argon2-cffi. Parameters are named explicitly so a change is a
deliberate edit with a visible diff rather than a silent library upgrade.

The hashing cost is deliberately high, which makes every login in the test
suite expensive. Tests therefore select a cheap profile through the
PASSWORD_HASHING environment variable: the same Argon2id algorithm and the
same code path, with parameters that do not spend 64MB per call. app.config
refuses that profile when APP_ENV is production.
"""

from __future__ import annotations

import os
from typing import NamedTuple

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError


class _Profile(NamedTuple):
    time_cost: int
    memory_cost: int
    parallelism: int


_PROFILES: dict[str, _Profile] = {
    # Tracks current OWASP guidance.
    "default": _Profile(time_cost=3, memory_cost=65536, parallelism=4),
    # Test-only. Cheap enough to run hundreds of times in a suite.
    "fast": _Profile(time_cost=1, memory_cost=8192, parallelism=1),
}

_profile = _PROFILES.get(os.environ.get("PASSWORD_HASHING", "default"), _PROFILES["default"])

_hasher = PasswordHasher(
    time_cost=_profile.time_cost,
    memory_cost=_profile.memory_cost,
    parallelism=_profile.parallelism,
    hash_len=32,
    salt_len=16,
)


def hash_password(plaintext: str) -> str:
    return _hasher.hash(plaintext)


def verify_password(stored_hash: str, plaintext: str) -> bool:
    """Constant-time check. Returns False rather than raising on a bad hash."""
    try:
        return _hasher.verify(stored_hash, plaintext)
    except (VerifyMismatchError, InvalidHashError, ValueError):
        return False


def needs_rehash(stored_hash: str) -> bool:
    """True when the hash predates the current parameters, so login can upgrade it."""
    try:
        return _hasher.check_needs_rehash(stored_hash)
    except (InvalidHashError, ValueError):
        return True
