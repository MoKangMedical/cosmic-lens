#!/usr/bin/env python3
"""Create Stripe Payment Links for Cosmic Lens and write public URLs to config.

This script calls Stripe from a local terminal using STRIPE_SECRET_KEY, then
stores only the returned public Payment Link URLs in docs/js/purchase-config.js.
Never commit Stripe secret keys, webhook secrets, or restricted keys.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

from configure_purchase_links import replace_plan_link, replace_support_email, valid_public_url


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "docs" / "js" / "purchase-config.js"
STRIPE_API_BASE = "https://api.stripe.com/v1"
PLAN_IDS = ("personal", "supporter", "institution")

ZERO_DECIMAL_CURRENCIES = {
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf",
}


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    price: float
    subtitle: str
    payment_link: str


@dataclass(frozen=True)
class PurchaseConfig:
    currency: str
    success_url: str
    support_email: str
    plans: list[Plan]


def extract_js_block(text: str, key: str) -> str:
    start = text.find(f"{key}:")
    if start == -1:
        raise ValueError(f"Could not find config block for {key}")
    brace_start = text.find("{", start)
    if brace_start == -1:
        raise ValueError(f"Could not find opening brace for {key}")

    depth = 0
    in_string = False
    escape = False
    for index in range(brace_start, len(text)):
        char = text[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[brace_start : index + 1]
    raise ValueError(f"Could not find closing brace for {key}")


def extract_string(text: str, field: str, default: str = "") -> str:
    match = re.search(rf"\b{re.escape(field)}\s*:\s*\"([^\"]*)\"", text)
    return match.group(1) if match else default


def extract_number(text: str, field: str) -> float:
    match = re.search(rf"\b{re.escape(field)}\s*:\s*([0-9]+(?:\.[0-9]+)?)", text)
    if not match:
        raise ValueError(f"Could not find numeric field: {field}")
    return float(match.group(1))


def read_purchase_config() -> PurchaseConfig:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    currency = extract_string(text, "currency", "CNY").lower()
    success_url = extract_string(text, "successUrl")
    support_email = extract_string(text, "supportEmail")
    if not success_url:
        raise ValueError("successUrl is required in docs/js/purchase-config.js")

    plans: list[Plan] = []
    for plan_id in PLAN_IDS:
        block = extract_js_block(text, plan_id)
        plans.append(
            Plan(
                id=plan_id,
                name=extract_string(block, "name"),
                price=extract_number(block, "price"),
                subtitle=extract_string(block, "subtitle"),
                payment_link=extract_string(block, "paymentLink"),
            )
        )
    return PurchaseConfig(currency=currency, success_url=success_url, support_email=support_email, plans=plans)


def amount_for_stripe(price: float, currency: str) -> int:
    if currency.lower() in ZERO_DECIMAL_CURRENCIES:
        return int(round(price))
    return int(round(price * 100))


def require_secret_key(dry_run: bool) -> str:
    key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    if dry_run:
        return key
    if not key:
        raise ValueError("Missing STRIPE_SECRET_KEY. Export a Stripe secret key before creating Payment Links.")
    if not key.startswith(("sk_test_", "sk_live_")):
        raise ValueError("STRIPE_SECRET_KEY must look like a Stripe secret key starting with sk_test_ or sk_live_.")
    return key


def stripe_post(endpoint: str, secret_key: str, fields: dict[str, str], idempotency_key: str) -> dict:
    auth = base64.b64encode(f"{secret_key}:".encode("utf-8")).decode("ascii")
    request = Request(
        f"{STRIPE_API_BASE}{endpoint}",
        data=urlencode(fields).encode("utf-8"),
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": idempotency_key,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(body)
            message = payload.get("error", {}).get("message") or body
        except json.JSONDecodeError:
            message = body
        raise RuntimeError(f"Stripe API error {error.code}: {message}") from error
    except URLError as error:
        raise RuntimeError(f"Stripe API request failed: {error.reason}") from error


def success_url_for_plan(success_url: str, plan_id: str) -> str:
    parsed = urlparse(success_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["plan"] = plan_id
    return urlunparse(parsed._replace(query=urlencode(query)))


def payment_link_fields(plan: Plan, config: PurchaseConfig, success_url: str) -> dict[str, str]:
    amount = amount_for_stripe(plan.price, config.currency)
    product_name = f"宇宙之镜 · {plan.name}"
    description = plan.subtitle or "Cosmic Lens Academy course access"
    return {
        "line_items[0][price_data][product_data][name]": product_name,
        "line_items[0][price_data][product_data][description]": description,
        "line_items[0][price_data][currency]": config.currency.lower(),
        "line_items[0][price_data][unit_amount]": str(amount),
        "line_items[0][quantity]": "1",
        "after_completion[type]": "redirect",
        "after_completion[redirect][url]": success_url,
        "metadata[cosmic_lens_plan]": plan.id,
        "metadata[cosmic_lens_site]": "cosmic-lens",
    }


def idempotency_key_for(plan: Plan, config: PurchaseConfig, success_url: str) -> str:
    raw = f"{plan.id}:{config.currency}:{plan.price}:{success_url}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"cosmic-lens-payment-link-{digest}"


def selected_plans(config: PurchaseConfig, requested: Iterable[str] | None) -> list[Plan]:
    requested_ids = set(requested or PLAN_IDS)
    return [plan for plan in config.plans if plan.id in requested_ids]


def write_links(links: dict[str, str], support_email: str | None) -> None:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    for plan_id, link in links.items():
        text = replace_plan_link(text, plan_id, link)
    if support_email:
        text = replace_support_email(text, support_email)
    CONFIG_PATH.write_text(text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create Stripe Payment Links for Cosmic Lens plans and write public URLs into docs/js/purchase-config.js"
    )
    parser.add_argument("--plan", choices=PLAN_IDS, action="append", help="Create only the selected plan. Repeat for multiple plans.")
    parser.add_argument("--success-url", help="Override success redirect URL for newly created Payment Links.")
    parser.add_argument("--support-email", help="Optionally write supportEmail into docs/js/purchase-config.js after successful creation.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned Stripe payloads without calling Stripe.")
    parser.add_argument("--force", action="store_true", help="Create links even when a selected plan already has paymentLink configured.")
    parser.add_argument("--no-write-config", action="store_true", help="Print created public links without editing docs/js/purchase-config.js.")
    args = parser.parse_args()

    if not CONFIG_PATH.exists():
        print(f"Missing config file: {CONFIG_PATH}", file=sys.stderr)
        return 1

    try:
        config = read_purchase_config()
        secret_key = require_secret_key(args.dry_run)
        success_url = args.success_url or config.success_url
        if not valid_public_url(success_url):
            raise ValueError(f"Invalid success URL: {success_url}")
        if args.support_email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", args.support_email):
            raise ValueError(f"Invalid support email: {args.support_email}")

        created_links: dict[str, str] = {}
        skipped: list[str] = []
        for plan in selected_plans(config, args.plan):
            if plan.payment_link and not args.force:
                skipped.append(plan.id)
                continue

            plan_success_url = success_url_for_plan(success_url, plan.id)
            fields = payment_link_fields(plan, config, plan_success_url)
            if args.dry_run:
                print(f"[dry-run] {plan.id} {plan.name}: {config.currency.upper()} {plan.price:g}")
                print(json.dumps(fields, ensure_ascii=False, indent=2))
                continue

            response = stripe_post(
                "/payment_links",
                secret_key,
                fields,
                idempotency_key_for(plan, config, plan_success_url),
            )
            public_url = response.get("url", "")
            if not valid_public_url(public_url):
                raise RuntimeError(f"Stripe response for {plan.id} did not contain a valid public URL.")
            created_links[plan.id] = public_url
            print(f"Created {plan.id}: {public_url}")

        if skipped:
            print("Skipped already-configured plans: " + ", ".join(skipped))
            print("Use --force to create replacement Payment Links.")

        if created_links and not args.no_write_config:
            write_links(created_links, args.support_email)
            print(f"Updated {CONFIG_PATH.relative_to(ROOT)}")
            print("Next: python3 scripts/audit_product_readiness.py --strict-payments")
        elif created_links:
            print("Config not written because --no-write-config was set.")
            for plan_id, link in created_links.items():
                print(f'python3 scripts/configure_purchase_links.py --{plan_id} "{link}"')

        if args.dry_run:
            print("Dry run complete. Export STRIPE_SECRET_KEY and rerun without --dry-run to create public links.")
        return 0
    except (ValueError, RuntimeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
