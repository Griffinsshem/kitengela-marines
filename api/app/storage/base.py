"""Storage interface.

Two drivers implement it: local disk for development, Cloudinary for
production. Everything above this line stores a key and a URL and never learns
which one it is talking to, so a third driver later is one new file.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class StoredFile:
    # How the driver addresses the file again, e.g. to delete it.
    key: str
    # Where a browser fetches it.
    url: str


class Storage(Protocol):
    def save(self, data: bytes, *, key: str, content_type: str) -> StoredFile: ...

    def delete(self, key: str) -> None: ...
