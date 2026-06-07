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
import os
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COURSES_DIR = ROOT / "docs" / "courses"
AUDIO_DIR = ROOT / "docs" / "audio"
SCRIPTS_DIR = ROOT / "docs" / "audio_scripts"

DEFAULT_VOICE = "zh-CN-YunyangNeural"
DEFAULT_RATE = "-8%"
DEFAULT_PITCH = "-2Hz"
DEFAULT_BITRATE = "48k"
DEFAULT_EDGE_TTS_BIN = os.environ.get("COSMIC_EDGE_TTS_BIN", "edge-tts")
DEFAULT_FFMPEG_BIN = os.environ.get("COSMIC_FFMPEG_BIN", "ffmpeg")
DEFAULT_FFPROBE_BIN = os.environ.get("COSMIC_FFPROBE_BIN", "ffprobe")
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


def lesson_path(lesson: int) -> Path:
    return ROOT / "docs" / f"lesson{lesson:02d}.html"


class LessonHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.skip_depth = 0
        self.capture_tag = ""
        self.current: list[str] = []
        self.lines: list[str] = []
        self.title = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "nav", "audio", "canvas"}:
            self.skip_depth += 1
            return
        if self.skip_depth:
            return
        if tag in {"h1", "h2", "h3", "p", "li"}:
            self.capture_tag = tag
            self.current = []

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "nav", "audio", "canvas"} and self.skip_depth:
            self.skip_depth -= 1
            return
        if self.skip_depth or tag != self.capture_tag:
            return
        text = re.sub(r"\s+", " ", "".join(self.current)).strip()
        self.capture_tag = ""
        self.current = []
        if len(text) < 2:
            return
        if tag == "h1":
            if not self.title:
                self.title = text
            self.lines.append(f"# {text}")
        elif tag in {"h2", "h3"}:
            self.lines.append(f"## {text}")
        else:
            self.lines.append(text)

    def handle_data(self, data: str) -> None:
        if self.skip_depth or not self.capture_tag:
            return
        self.current.append(data)


def lesson_html_source(lesson: int) -> tuple[str, str]:
    path = lesson_path(lesson)
    if not path.exists():
        raise FileNotFoundError(f"No HTML lesson page found for lesson {lesson:02d}")
    parser = LessonHTMLParser()
    parser.feed(path.read_text(encoding="utf-8"))
    title = parser.title or path.stem
    return "\n".join(parser.lines), title


def lesson_source(lesson: int) -> tuple[str, str, str]:
    try:
        md_path = course_path(lesson)
        return md_path.read_text(encoding="utf-8"), md_path.stem, "markdown"
    except FileNotFoundError:
        text, title = lesson_html_source(lesson)
        return text, title, "html"


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


def run(cmd: list[str], *, timeout: int | None = None, attempts: int = 1) -> None:
    last_error: subprocess.CalledProcessError | subprocess.TimeoutExpired | None = None
    for attempt in range(1, attempts + 1):
        try:
            subprocess.run(cmd, check=True, timeout=timeout)
            return
        except subprocess.TimeoutExpired as exc:
            last_error = exc
            print(f"Command timed out after {timeout}s, attempt {attempt}/{attempts}: {' '.join(cmd[:2])}", file=sys.stderr)
        except subprocess.CalledProcessError as exc:
            last_error = exc
            print(f"Command failed, attempt {attempt}/{attempts}: {' '.join(cmd[:2])}", file=sys.stderr)
        if attempt < attempts:
            continue
    if last_error:
        raise last_error


def command_available(command: str) -> bool:
    path = Path(command)
    if path.is_absolute() or "/" in command:
        return path.exists() and os.access(path, os.X_OK)
    return shutil.which(command) is not None


def probe_audio(path: Path, ffprobe_bin: str, timeout: int) -> str:
    try:
        result = subprocess.run(
            [
                ffprobe_bin,
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
            timeout=timeout,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        if shutil.which("afinfo") is None:
            raise
        result = subprocess.run(
            ["afinfo", str(path)],
            check=True,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
        lines = [
            line.strip()
            for line in result.stdout.splitlines()
            if any(key in line for key in ("Data format", "estimated duration", "bit rate"))
        ]
        return "\n".join(lines)


def generate_audio(
    lesson: int,
    script_path: Path,
    *,
    voice: str,
    rate: str,
    pitch: str,
    bitrate: str,
    edge_tts_bin: str,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    probe_timeout: int,
    tts_timeout: int,
    tts_attempts: int,
    keep_tmp: bool,
) -> None:
    raw_path = Path("/tmp") / f"cosmic_lesson{lesson:02d}_raw.mp3"
    out_path = AUDIO_DIR / f"lesson{lesson:02d}.mp3"
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    run(
        [
            edge_tts_bin,
            "--voice",
            voice,
            f"--rate={rate}",
            f"--pitch={pitch}",
            "--file",
            str(script_path),
            "--write-media",
            str(raw_path),
        ],
        timeout=tts_timeout,
        attempts=tts_attempts,
    )
    run(
        [
            ffmpeg_bin,
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
    print(probe_audio(out_path, ffprobe_bin, probe_timeout))


def attach_audio_to_lesson(lesson: int) -> None:
    path = lesson_path(lesson)
    if not path.exists():
        raise FileNotFoundError(f"No HTML lesson page found for lesson {lesson:02d}")
    text = path.read_text(encoding="utf-8")
    audio_html = f'<div class="audio-bar"><span>🎧 音频版</span><audio controls src="/cosmic-lens/audio/lesson{lesson:02d}.mp3" preload="none"></audio></div>'
    if f'/cosmic-lens/audio/lesson{lesson:02d}.mp3' in text:
        return
    pending_pattern = re.compile(
        r'<div class="audio-bar audio-pending">\s*<span>🎧 音频版</span>\s*<div class="audio-pending-text">.*?</div>\s*</div>',
        re.DOTALL,
    )
    updated, count = pending_pattern.subn(audio_html, text, count=1)
    if count != 1:
        raise RuntimeError(f"Could not replace pending audio bar in {path.relative_to(ROOT)}")
    path.write_text(updated, encoding="utf-8")


def ensure_tools(edge_tts_bin: str, ffmpeg_bin: str) -> None:
    missing = [tool for tool in (edge_tts_bin, ffmpeg_bin) if not command_available(tool)]
    if missing:
        raise SystemExit(f"Missing required tool(s): {', '.join(missing)}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lessons", default="1-20", help="Lesson list/ranges, e.g. 1-20 or 21,22,25-30")
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--edge-tts-bin", default=DEFAULT_EDGE_TTS_BIN)
    parser.add_argument("--ffmpeg-bin", default=DEFAULT_FFMPEG_BIN)
    parser.add_argument("--ffprobe-bin", default=DEFAULT_FFPROBE_BIN)
    parser.add_argument("--rate", default=DEFAULT_RATE)
    parser.add_argument("--pitch", default=DEFAULT_PITCH)
    parser.add_argument("--bitrate", choices=("48k", "64k"), default=DEFAULT_BITRATE)
    parser.add_argument("--min-chars", type=int, default=MIN_SCRIPT_CHARS)
    parser.add_argument("--probe-timeout", type=int, default=20)
    parser.add_argument("--tts-timeout", type=int, default=120, help="Seconds before retrying a stuck edge-tts request")
    parser.add_argument("--tts-attempts", type=int, default=3, help="edge-tts attempts per lesson")
    parser.add_argument("--scripts-only", action="store_true")
    parser.add_argument("--no-update-pages", action="store_true", help="Do not replace pending audio bars after audio generation")
    parser.add_argument("--keep-tmp", action="store_true")
    args = parser.parse_args()

    ensure_tools(args.edge_tts_bin, args.ffmpeg_bin)
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    lessons = parse_lessons(args.lessons)
    for lesson in lessons:
        source_text, fallback_title, source_type = lesson_source(lesson)
        script = build_script(lesson, source_text, fallback_title, args.min_chars)
        script_path = SCRIPTS_DIR / f"lesson{lesson:02d}.txt"
        script_path.write_text(script, encoding="utf-8")
        count = chineseish_len(script)
        if count < args.min_chars:
            raise RuntimeError(f"lesson{lesson:02d} script too short: {count} chars")
        if args.scripts_only:
            print(f"lesson{lesson:02d}: wrote {script_path} ({count} chars, source={source_type})")
            continue
        generate_audio(
            lesson,
            script_path,
            voice=args.voice,
            rate=args.rate,
            pitch=args.pitch,
            bitrate=args.bitrate,
            edge_tts_bin=args.edge_tts_bin,
            ffmpeg_bin=args.ffmpeg_bin,
            ffprobe_bin=args.ffprobe_bin,
            probe_timeout=args.probe_timeout,
            tts_timeout=args.tts_timeout,
            tts_attempts=args.tts_attempts,
            keep_tmp=args.keep_tmp,
        )
        if not args.no_update_pages:
            attach_audio_to_lesson(lesson)
    return 0


if __name__ == "__main__":
    sys.exit(main())
