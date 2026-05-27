from __future__ import annotations

from functools import lru_cache

from joint.settings import Settings


@lru_cache
def get_settings():
    return Settings()  # type: ignore
