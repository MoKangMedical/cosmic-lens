#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate Cosmic Lens core-course narration and neural audio.

Pipeline:
1. Build a >=500 Chinese-character narration script from each course Markdown.
2. Synthesize with edge-tts using zh-CN-YunyangNeural.
3. Normalize and encode with ffmpeg to 24kHz mono MP3 at 48k/64k.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COURSES_DIR = ROOT / "docs" / "courses"
AUDIO_DIR = ROOT / "docs" / "audio"
SCRIPTS_DIR = ROOT / "docs" / "audio_scripts"

DEFAULT_VOICE = "zh-CN-YunyangNeural"
DEFAULT_RATE = "-8%"
DEFAULT_PITCH = "-2Hz"
DEFAULT_BITRATE = "48k"
MIN_SCRIPT_CHARS = 520
MAX_SCRIPT_CHARS = 900


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


def course_path(lesson: int) -> Path:
    matches = sorted(COURSES_DIR.glob(f"{lesson:02d}-*.md"))
    if not matches:
        raise FileNotFoundError(f"No Markdown course found for lesson {lesson:02d}")
    return matches[0]


def strip_markdown(text: str) -> str:
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    text = re.sub(r"<details>.*?</details>", "", text, flags=re.S)
    text = re.sub(r"<pre>.*?</pre>", "", text, flags=re.S)
    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("|") or line.startswith("---"):
            continue
        if line.startswith(">"):
            continue
        line = re.sub(r"^#+\s*", "", line)
        line = re.sub(r"\*\*(.*?)\*\*", r"\1", line)
        line = re.sub(r"\*(.*?)\*", r"\1", line)
        line = re.sub(r"`([^`]+)`", r"\1", line)
        line = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", line)
        line = re.sub(r"[#*_`<>]", "", line)
        line = re.sub(r"\s+", " ", line)
        if len(line) >= 8:
            lines.append(line)
    return "\n".join(lines)


def chineseish_len(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", text))


def title_from_markdown(text: str, fallback: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


def headings_from_markdown(text: str) -> list[str]:
    headings: list[str] = []
    for line in text.splitlines():
        if line.startswith("## ") and not any(skip in line for skip in ("练习", "知识连接", "数据总览")):
            clean = re.sub(r"^#+\s*", "", line).strip()
            clean = clean.replace("🖋️", "").replace("🎯", "").strip()
            if clean and clean not in headings:
                headings.append(clean)
        if len(headings) >= 6:
            break
    return headings


def sentence_chunks(text: str) -> list[str]:
    flat = re.sub(r"\s+", "", text)
    chunks = re.split(r"(?<=[。！？；])", flat)
    return [chunk for chunk in chunks if chineseish_len(chunk) >= 18]


def build_script(lesson: int, markdown: str, fallback_title: str, min_chars: int) -> str:
    title = title_from_markdown(markdown, fallback_title)
    headings = headings_from_markdown(markdown)
    plain = strip_markdown(markdown)
    chunks = sentence_chunks(plain)

    intro = (
        f"第{lesson}课，《{title}》。"
        "这是一段课程化讲解，不是照读网页正文。"
        "我们会先建立问题意识，再把关键概念、数量级和模拟假说之间的关系串起来。"
    )
    if headings:
        intro += "本课的主线包括：" + "、".join(headings[:5]) + "。"

    selected: list[str] = []
    for chunk in chunks:
        if "点击查看参考答案" in chunk or "练习" in chunk[:6]:
            continue
        selected.append(chunk)
        current = chineseish_len(intro + "".join(selected))
        if current >= MAX_SCRIPT_CHARS:
            break

    script = intro + "".join(selected)
    if chineseish_len(script) < min_chars:
        script += (
            "听这一课时，请特别注意三件事：第一，概念不要只记名字，要知道它回答了哪个问题；"
            "第二，数量级不是装饰，它决定一个想法在工程上是否付得起成本；"
            "第三，模拟假说不是一句结论，而是一组需要物理、计算、意识和证据共同支撑的判断。"
            "如果你能把本课内容放回前后课程的框架中，就说明你已经不只是听懂一个知识点，而是在搭建完整宇宙观。"
        )

    if chineseish_len(script) > MAX_SCRIPT_CHARS:
        trimmed = ""
        for chunk in sentence_chunks(script):
            if chineseish_len(trimmed + chunk) > MAX_SCRIPT_CHARS:
                break
            trimmed += chunk
        script = trimmed or script[:MAX_SCRIPT_CHARS]

    return script.strip() + "\n"


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def ffprobe(path: Path) -> str:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "quiet",
            "-show_entries",
            "stream=sample_rate,channels",
            "-show_entries",
            "format=duration,bit_rate",
            "-of",
            "default=noprint_wrappers=1",
            str(path),
        ],
        check=True,
        text=True,
        capture_output=True,
    )
    return result.stdout.strip()


def generate_audio(
    lesson: int,
    script_path: Path,
    *,
    voice: str,
    rate: str,
    pitch: str,
    bitrate: str,
    keep_tmp: bool,
) -> None:
    raw_path = Path("/tmp") / f"cosmic_lesson{lesson:02d}_raw.mp3"
    out_path = AUDIO_DIR / f"lesson{lesson:02d}.mp3"
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    run(
        [
            "edge-tts",
            "--voice",
            voice,
            f"--rate={rate}",
            f"--pitch={pitch}",
            "--file",
            str(script_path),
            "--write-media",
            str(raw_path),
        ]
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(raw_path),
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=9",
            "-ar",
            "24000",
            "-ac",
            "1",
            "-b:a",
            bitrate,
            str(out_path),
        ]
    )
    if not keep_tmp:
        raw_path.unlink(missing_ok=True)
    print(f"lesson{lesson:02d}: {chineseish_len(script_path.read_text(encoding='utf-8'))} chars")
    print(ffprobe(out_path))


def ensure_tools() -> None:
    missing = [tool for tool in ("edge-tts", "ffmpeg", "ffprobe") if shutil.which(tool) is None]
    if missing:
        raise SystemExit(f"Missing required tool(s): {', '.join(missing)}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lessons", default="1-20", help="Lesson list/ranges, e.g. 1-20 or 21,22,25-30")
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--rate", default=DEFAULT_RATE)
    parser.add_argument("--pitch", default=DEFAULT_PITCH)
    parser.add_argument("--bitrate", choices=("48k", "64k"), default=DEFAULT_BITRATE)
    parser.add_argument("--min-chars", type=int, default=MIN_SCRIPT_CHARS)
    parser.add_argument("--scripts-only", action="store_true")
    parser.add_argument("--keep-tmp", action="store_true")
    args = parser.parse_args()

    ensure_tools()
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    lessons = parse_lessons(args.lessons)
    for lesson in lessons:
        md_path = course_path(lesson)
        markdown = md_path.read_text(encoding="utf-8")
        script = build_script(lesson, markdown, md_path.stem, args.min_chars)
        script_path = SCRIPTS_DIR / f"lesson{lesson:02d}.txt"
        script_path.write_text(script, encoding="utf-8")
        count = chineseish_len(script)
        if count < args.min_chars:
            raise RuntimeError(f"lesson{lesson:02d} script too short: {count} chars")
        if args.scripts_only:
            print(f"lesson{lesson:02d}: wrote {script_path} ({count} chars)")
            continue
        generate_audio(
            lesson,
            script_path,
            voice=args.voice,
            rate=args.rate,
            pitch=args.pitch,
            bitrate=args.bitrate,
            keep_tmp=args.keep_tmp,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
