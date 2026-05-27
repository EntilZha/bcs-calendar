# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright>=1.40"]
# ///
"""Sanity-check the API-derived data against the live Tockify web calendar.

The pipeline (crawl_calendar.py) builds events.json from Tockify's ICS feed.
This script independently loads the *rendered* public agenda in a real browser,
scrapes the events it shows, and confirms our data matches — so we can show
staff the redesign reflects the real calendar, not a stale or divergent copy.

Matching is by the event's detail URL path (/detail/<series>/<instanceMs>),
which both the ICS `URL` field and the rendered page expose. The trailing
number is the event's start time in epoch-ms, used to restrict the comparison
to the date window the ICS feed actually covers.

Run:  uv run scripts/sanity_check.py
First run may need:  uv run --with playwright python -m playwright install chromium
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

AGENDA_URL = "https://tockify.com/birds.connect.sea/agenda"
EVENTS_JSON = Path(__file__).resolve().parent.parent / "src" / "data" / "events.json"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
DETAIL_RE = re.compile(r"/detail/(\d+)/(\d+)")


def detail_key(url: str) -> str | None:
    """Return 'series/instance' from a Tockify detail URL, or None."""
    m = DETAIL_RE.search(url or "")
    return f"{m.group(1)}/{m.group(2)}" if m else None


def load_api_events() -> dict[str, dict]:
    events = json.loads(EVENTS_JSON.read_text(encoding="utf-8"))
    out: dict[str, dict] = {}
    for ev in events:
        key = detail_key(ev.get("detailUrl", ""))
        if key:
            out[key] = ev
    return out


async def scrape_web_events() -> dict[str, str]:
    """Return {detail_key: title} for events shown on the live agenda."""
    found: dict[str, str] = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=["--disable-blink-features=AutomationControlled"]
        )
        ctx = await browser.new_context(
            user_agent=UA, locale="en-US", viewport={"width": 1200, "height": 1400}
        )
        page = await ctx.new_page()
        resp = await page.goto(AGENDA_URL, wait_until="networkidle")
        if not resp or resp.status != 200:
            print(f"  ! agenda returned status {resp.status if resp else 'none'}")
        await page.wait_for_timeout(4000)

        # The agenda paginates behind a "Load More Events" button. It re-renders
        # (Angular) on each click, so clicks can transiently fail; keep going
        # until the number of loaded events stops growing.
        prev = -1
        stable = 0
        for _ in range(40):
            count = await page.locator("a[href*='/detail/']").count()
            stable = stable + 1 if count == prev else 0
            prev = count
            if stable >= 4:
                break
            btn = page.locator("a.btn-loadMore:visible").first
            if await btn.count() == 0:
                await page.wait_for_timeout(800)
                continue
            try:
                await btn.scroll_into_view_if_needed()
                await btn.click(timeout=3000)
            except Exception:
                pass
            await page.wait_for_timeout(900)

        anchors = page.locator("a[href*='/detail/']")
        count = await anchors.count()
        for i in range(count):
            href = await anchors.nth(i).get_attribute("href") or ""
            key = detail_key(href)
            if not key:
                continue
            if key not in found:
                text = (await anchors.nth(i).inner_text()).strip()
                found[key] = text.split("\n")[0].strip() if text else ""

        await browser.close()
    return found


def main() -> None:
    if not EVENTS_JSON.exists():
        sys.exit("events.json not found — run scripts/crawl_calendar.py first.")

    api = load_api_events()
    api_instances = [int(k.split("/")[1]) for k in api]
    api_max_ms = max(api_instances) if api_instances else 0
    print(f"API events (from events.json): {len(api)}")
    print(f"API horizon (latest start):    {api_max_ms} ms")

    print(f"\nScraping live agenda: {AGENDA_URL}")
    web = asyncio.run(scrape_web_events())
    print(f"Web events scraped:            {len(web)}")

    # Only compare events within the horizon the ICS feed covers; the live
    # agenda can page further into the future than the feed window.
    in_window = {k: t for k, t in web.items() if int(k.split("/")[1]) <= api_max_ms}
    missing = {k: t for k, t in in_window.items() if k not in api}

    print(f"\nWeb events within API horizon: {len(in_window)}")
    print(f"  matched in API:              {len(in_window) - len(missing)}")
    print(f"  missing from API:            {len(missing)}")

    if missing:
        print("\n  ⚠ Present on live site but absent from API:")
        for k, t in list(missing.items())[:20]:
            print(f"    - {t[:70]!r}  ({k})")

    # Spot-check a few title matches for events present in both.
    overlap = [k for k in in_window if k in api]
    print("\nTitle spot-check (web vs API):")
    for k in overlap[:5]:
        wt = re.sub(r"\s+", " ", in_window[k]).strip().lower()
        at = re.sub(r"\s+", " ", api[k]["title"]).strip().lower()
        ok = wt[:25] in at or at[:25] in wt
        print(f"  [{'OK' if ok else '??'}] {api[k]['title'][:60]!r}")

    if missing:
        print("\nRESULT: ⚠ MISMATCH — see events missing from API above.")
        sys.exit(1)
    print(f"\nRESULT: ✅ PASS — all {len(in_window)} live events within the feed "
          "window are present in the API data.")


if __name__ == "__main__":
    main()
