#!/usr/bin/env python3
"""Audit Cosmic Lens product and purchase readiness."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
PLAN_IDS = ("personal", "supporter", "institution")


class RefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[tuple[str, str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        for key in ("href", "src"):
            if values.get(key):
                self.refs.append((tag, key, values[key] or ""))


@dataclass
class Finding:
    level: str
    message: str


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def exists_ref(url: str, base_path: Path) -> bool:
    parsed = urlparse(url)
    if (
        not url
        or url.startswith("#")
        or parsed.scheme in {"http", "https", "mailto", "tel", "data", "javascript"}
    ):
        return True
    target = url.split("#", 1)[0].split("?", 1)[0]
    if not target.startswith("/cosmic-lens/"):
        return (base_path.parent / target).resolve().exists()
    if target.rstrip("/") == "/cosmic-lens":
        return (DOCS / "index.html").exists()
    return (DOCS / target.removeprefix("/cosmic-lens/")).exists()


def extract_payment_links(config_text: str) -> dict[str, str]:
    links: dict[str, str] = {}
    for plan_id in PLAN_IDS:
        match = re.search(
            rf'{plan_id}:\s*\{{(?:(?!\n\s*\}}\n\s*(?:personal|supporter|institution|\}})).)*?paymentLink:\s*"([^"]*)"',
            config_text,
            re.DOTALL,
        )
        links[plan_id] = match.group(1) if match else ""
    return links


def is_public_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def add(findings: list[Finding], level: str, message: str) -> None:
    findings.append(Finding(level, message))


def audit(strict_payments: bool) -> tuple[list[Finding], dict[str, int | str]]:
    findings: list[Finding] = []
    metrics: dict[str, int | str] = {}

    required_files = [
        DOCS / "index.html",
        DOCS / "courses.html",
        DOCS / "purchase.html",
        DOCS / "purchase-success.html",
        DOCS / "js" / "purchase-config.js",
        DOCS / "js" / "starfield-bg.js",
        DOCS / "assets" / "purchase-cosmos.jpg",
        ROOT / "scripts" / "create_stripe_payment_links.py",
        DOCS / "astronaut.html",
        DOCS / "astronaut-stories.html",
        DOCS / "astronaut-philosophy.html",
        DOCS / "astronaut-journal.html",
        DOCS / "astronaut-gallery.html",
        DOCS / "astronaut-timeline.html",
    ]
    for path in required_files:
        if not path.exists():
            add(findings, "FAIL", f"Missing required file: {path.relative_to(ROOT)}")

    lesson_files = sorted(DOCS.glob("lesson*.html"))
    metrics["lesson_files"] = len(lesson_files)
    if len(lesson_files) != 120:
        add(findings, "FAIL", f"Expected 120 lesson pages, found {len(lesson_files)}")

    courses_html = read(DOCS / "courses.html") if (DOCS / "courses.html").exists() else ""
    course_cards = courses_html.count('class="course-card"')
    lesson_links = set(re.findall(r"/cosmic-lens/lesson\d+\.html", courses_html))
    metrics["course_cards"] = course_cards
    metrics["unique_course_links"] = len(lesson_links)
    if course_cards != 120:
        add(findings, "FAIL", f"Expected 120 course cards, found {course_cards}")
    if len(lesson_links) != 120:
        add(findings, "FAIL", f"Expected 120 unique lesson links in courses.html, found {len(lesson_links)}")
    if "/cosmic-lens/docs/" in courses_html:
        add(findings, "FAIL", "courses.html contains /cosmic-lens/docs/ paths")

    index_html = read(DOCS / "index.html") if (DOCS / "index.html").exists() else ""
    index_required_links = [
        "/cosmic-lens/courses.html",
        "/cosmic-lens/astronaut.html",
        "/cosmic-lens/purchase.html",
        "/cosmic-lens/lesson01.html",
    ]
    index_primary_links = sum(1 for url in index_required_links if url in index_html)
    metrics["index_primary_links"] = index_primary_links
    if index_primary_links != len(index_required_links):
        add(findings, "FAIL", f"Expected homepage links for courses, astronaut, purchase, and lesson01; found {index_primary_links}/{len(index_required_links)}")

    astronaut_pages = [
        DOCS / "astronaut.html",
        DOCS / "astronaut-stories.html",
        DOCS / "astronaut-philosophy.html",
        DOCS / "astronaut-journal.html",
        DOCS / "astronaut-gallery.html",
        DOCS / "astronaut-timeline.html",
    ]
    astronaut_purchase_links = 0
    for page in astronaut_pages:
        if page.exists() and "/cosmic-lens/purchase.html" in read(page):
            astronaut_purchase_links += 1
    metrics["astronaut_purchase_links"] = astronaut_purchase_links
    if astronaut_purchase_links != len(astronaut_pages):
        add(findings, "FAIL", f"Expected purchase links on {len(astronaut_pages)} astronaut pages, found {astronaut_purchase_links}")

    purchase_links_in_lessons = 0
    audio_tags = 0
    pending_audio = 0
    missing_audio_refs: list[str] = []
    bad_titles: list[str] = []
    for lesson in lesson_files:
        text = read(lesson)
        if '/cosmic-lens/purchase.html" class="nav-buy"' in text:
            purchase_links_in_lessons += 1
        if "audio-pending-text" in text:
            pending_audio += 1
        for src in re.findall(r'<audio[^>]+src="([^"]+)"', text):
            audio_tags += 1
            local_path = DOCS / src.removeprefix("/cosmic-lens/")
            if not local_path.exists():
                missing_audio_refs.append(f"{lesson.name} -> {src}")
        number_match = re.search(r"lesson(\d+)\.html", lesson.name)
        title_match = re.search(r"<title>(.*?)</title>", text, re.DOTALL)
        if number_match and title_match and int(number_match.group(1)) > 20 and "三大物理Bug" in title_match.group(1):
            bad_titles.append(lesson.name)

    metrics["lesson_purchase_links"] = purchase_links_in_lessons
    metrics["audio_tags"] = audio_tags
    metrics["pending_audio_pages"] = pending_audio
    if purchase_links_in_lessons != 120:
        add(findings, "FAIL", f"Expected purchase nav on 120 lesson pages, found {purchase_links_in_lessons}")
    if missing_audio_refs:
        add(findings, "FAIL", f"Missing audio files referenced by pages: {missing_audio_refs[:5]}")
    if bad_titles:
        add(findings, "FAIL", f"Generated lesson titles still include lesson 1 suffix: {bad_titles[:5]}")

    html_files = sorted(DOCS.glob("*.html"))
    missing_refs: list[str] = []
    for path in html_files:
        parser = RefParser()
        parser.feed(read(path))
        for _tag, _key, url in parser.refs:
            if not exists_ref(url, path):
                missing_refs.append(f"{path.name} -> {url}")
    metrics["missing_local_refs"] = len(missing_refs)
    if missing_refs:
        add(findings, "FAIL", f"Missing local references: {missing_refs[:8]}")

    all_text = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in DOCS.rglob("*") if path.is_file() and path.suffix in {".html", ".js", ".md", ".txt"})
    if re.search(r"(sk|rk)_(test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+", all_text):
        add(findings, "FAIL", "Secret-looking Stripe key found under docs/")

    config_path = DOCS / "js" / "purchase-config.js"
    if config_path.exists():
        payment_links = extract_payment_links(read(config_path))
        configured = sum(1 for value in payment_links.values() if is_public_url(value))
        metrics["configured_payment_links"] = configured
        if configured != 3:
            level = "FAIL" if strict_payments else "WARN"
            add(findings, level, f"Configured payment links: {configured}/3. Run scripts/create_stripe_payment_links.py or scripts/configure_purchase_links.py after creating public Payment Links.")
        for plan_id, value in payment_links.items():
            if value and not is_public_url(value):
                add(findings, "FAIL", f"Invalid paymentLink for {plan_id}: {value}")

    return findings, metrics


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Cosmic Lens product readiness")
    parser.add_argument("--strict-payments", action="store_true", help="Fail if all three public payment links are not configured")
    args = parser.parse_args()

    findings, metrics = audit(strict_payments=args.strict_payments)
    failures = [f for f in findings if f.level == "FAIL"]
    warnings = [f for f in findings if f.level == "WARN"]

    print("Cosmic Lens product readiness audit")
    print("-----------------------------------")
    for key in sorted(metrics):
        print(f"{key}: {metrics[key]}")
    for finding in findings:
        print(f"{finding.level}: {finding.message}")

    if failures:
        print("\nRESULT: FAIL")
        return 1
    if warnings:
        print("\nRESULT: PASS_WITH_WARNINGS")
        return 0
    print("\nRESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
