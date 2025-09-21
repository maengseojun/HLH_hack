"""Timezone helpers (Asia/Seoul) and time formatting."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))


def now_kst_iso() -> str:
    return datetime.now(KST).isoformat()


def kst_daystamp() -> str:
    return datetime.now(KST).strftime("%Y%m%d")

