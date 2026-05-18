#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Audit Cosmic Lens core-course audio against the launch benchmark."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "docs" / "audio"
SCRIPTS_DIR = ROOT / "docs" / "audio_scripts"


def parse_lessons(value: str) -> list[int]:
    lessons: set[int] = set()
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            lessons.update(range(int(start), int(end) + 1))
        else:
            lessons.add(int(part))
    return sorted(lessons)


def text_len(path: Path) -> int:
    if not path.exists():
        return 0
    text = path.read_text(encoding="utf-8")
    return len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", text))


def ffprobe(path: Path) -> dict[str, object]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            str(path),
        ],
        check=True,
        text=True,
        capture_output=True,
    )
    data = json.loads(result.stdout)
    audio_stream = next(stream for stream in data["streams"] if stream.get("codec_type") == "audio")
    return {
        "duration": float(data["format"]["duration"]),
        "bit_rate": int(data["format"]["bit_rate"]),
        "sample_rate": int(audio_stream["sample_rate"]),
        "channels": int(audio_stream["channels"]),
        "codec": audio_stream["codec_name"],
    }


def grade(metrics: dict[str, object], script_chars: int, min_chars: int) -> tuple[str, list[str]]:
    issues: list[str] = []
    bit_rate = int(metrics["bit_rate"])
    if metrics["codec"] != "mp3":
        issues.append(f"codec={metrics['codec']}")
    if metrics["sample_rate"] != 24000:
        issues.append(f"sample_rate={metrics['sample_rate']}")
    if metrics["channels"] != 1:
        issues.append(f"channels={metrics['channels']}")
    if not (46000 <= bit_rate <= 66000):
        issues.append(f"bit_rate={bit_rate}")
    if script_chars < min_chars:
        issues.append(f"script_chars={script_chars}")
    return ("A" if not issues else "FAIL", issues)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lessons", default="1-20")
    parser.add_argument("--min-chars", type=int, default=500)
    parser.add_argument("--fail-on-problem", action="store_true")
    args = parser.parse_args()

    lessons = parse_lessons(args.lessons)
    rows: list[tuple[int, str, dict[str, object] | None, int, list[str]]] = []
    for lesson in lessons:
        audio_path = AUDIO_DIR / f"lesson{lesson:02d}.mp3"
        script_path = SCRIPTS_DIR / f"lesson{lesson:02d}.txt"
        script_chars = text_len(script_path)
        if not audio_path.exists():
            rows.append((lesson, "FAIL", None, script_chars, ["missing_audio"]))
            continue
        metrics = ffprobe(audio_path)
        item_grade, issues = grade(metrics, script_chars, args.min_chars)
        rows.append((lesson, item_grade, metrics, script_chars, issues))

    passed = sum(1 for _, item_grade, _, _, _ in rows if item_grade == "A")
    print(f"核心课程音频：{passed}/{len(rows)} A级")
    for lesson, item_grade, metrics, script_chars, issues in rows:
        if metrics is None:
            print(f"lesson{lesson:02d}, {item_grade}, script_chars={script_chars}, issues={';'.join(issues)}")
            continue
        print(
            "lesson{lesson:02d}, {grade}, {duration:.3f}s, {sample_rate}Hz, "
            "{channels}ch, {bitrate}bps, script_chars={chars}, issues={issues}".format(
                lesson=lesson,
                grade=item_grade,
                duration=float(metrics["duration"]),
                sample_rate=metrics["sample_rate"],
                channels=metrics["channels"],
                bitrate=metrics["bit_rate"],
                chars=script_chars,
                issues="none" if not issues else ";".join(issues),
            )
        )

    if args.fail_on_problem and passed != len(rows):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
