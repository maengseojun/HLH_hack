"""JSONL writer mirroring the CSV schema order."""

from __future__ import annotations

import json
import os
from typing import Any, Dict

from .io_csv import CSV_HEADERS, ensure_dir


def append_jsonl(row: Dict[str, Any], json_path: str) -> None:
    dir_ = os.path.dirname(json_path)
    if dir_:
        ensure_dir(dir_)
    ordered = {k: row.get(k, "") for k in CSV_HEADERS}
    with open(json_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(ordered, ensure_ascii=False, separators=(",", ":")) + "\n")

