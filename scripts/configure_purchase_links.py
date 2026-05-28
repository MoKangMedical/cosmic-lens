#!/usr/bin/env python3
"""Configure public purchase links for Cosmic Lens.

This script only writes public checkout/payment URLs into the static frontend
config. Never put Stripe secret keys or webhook secrets in this project.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "docs" / "js" / "purchase-config.js"
PLAN_IDS = ("personal", "supporter", "institution")
SECRET_PATTERNS = (
    re.compile(r"sk_(test|live)_[A-Za-z0-9]+"),
    re.compile(r"rk_(test|live)_[A-Za-z0-9]+"),
    re.compile(r"whsec_[A-Za-z0-9]+"),
)


def valid_public_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def assert_no_secret(value: str) -> None:
    for pattern in SECRET_PATTERNS:
        if pattern.search(value):
            raise ValueError("Detected a secret-looking Stripe key. Use a public Payment Link URL, not an API key.")


def replace_plan_link(text: str, plan_id: str, link: str) -> str:
    pattern = re.compile(
        rf'({re.escape(plan_id)}:\s*\{{(?:(?!\n\s*\}}\n\s*(?:personal|supporter|institution|\}})).)*?paymentLink:\s*")([^"]*)(")',
        re.DOTALL,
    )
    updated, count = pattern.subn(rf"\g<1>{link}\g<3>", text, count=1)
    if count != 1:
        raise RuntimeError(f"Could not update paymentLink for plan: {plan_id}")
    return updated


def replace_support_email(text: str, email: str) -> str:
    updated, count = re.subn(r'(supportEmail:\s*")([^"]*)(")', rf"\g<1>{email}\g<3>", text, count=1)
    if count != 1:
        raise RuntimeError("Could not update supportEmail")
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(description="Write public checkout links into docs/js/purchase-config.js")
    for plan_id in PLAN_IDS:
        parser.add_argument(f"--{plan_id}", help=f"Public checkout URL for {plan_id}")
    parser.add_argument("--support-email", help="Optional support email shown in purchase config")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print planned changes without writing")
    args = parser.parse_args()

    if not CONFIG_PATH.exists():
        print(f"Missing config file: {CONFIG_PATH}", file=sys.stderr)
        return 1

    supplied = {plan_id: getattr(args, plan_id) for plan_id in PLAN_IDS if getattr(args, plan_id)}
    if not supplied and not args.support_email:
        parser.error("Provide at least one plan URL or --support-email")

    for plan_id, link in supplied.items():
        assert_no_secret(link)
        if not valid_public_url(link):
            print(f"Invalid URL for {plan_id}: {link}", file=sys.stderr)
            return 1

    if args.support_email:
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", args.support_email):
            print(f"Invalid support email: {args.support_email}", file=sys.stderr)
            return 1

    text = CONFIG_PATH.read_text(encoding="utf-8")
    for plan_id, link in supplied.items():
        text = replace_plan_link(text, plan_id, link)
    if args.support_email:
        text = replace_support_email(text, args.support_email)

    if args.dry_run:
        print("Validated purchase config updates:")
        for plan_id, link in supplied.items():
            print(f"- {plan_id}: {link}")
        if args.support_email:
            print(f"- supportEmail: {args.support_email}")
        return 0

    CONFIG_PATH.write_text(text, encoding="utf-8")
    print(f"Updated {CONFIG_PATH.relative_to(ROOT)}")
    for plan_id in supplied:
        print(f"- {plan_id}: configured")
    if args.support_email:
        print("- supportEmail: configured")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
