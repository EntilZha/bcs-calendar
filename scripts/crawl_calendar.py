# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "icalendar>=6.0",
#   "requests>=2.31",
# ]
# ///
"""Crawl the Birds Connect Seattle calendar and dump normalized event data.

The live calendar at birdsconnectsea.org/calendar/ embeds a Tockify widget
(tockify.com/birds.connect.sea). Tockify publishes a complete public iCalendar
feed, which is a far cleaner source than scraping the JS-rendered widget:

    https://tockify.com/api/feeds/ics/birds.connect.sea

This script fetches that feed, normalizes each event, downloads the featured
images so the demo site is self-contained, and writes:

    src/data/events.json   - one normalized record per event (sorted by start)
    src/data/meta.json     - crawl metadata (timestamp, source, counts)
    src/assets/events/<id>.<ext>  - downloaded featured images

Run:  uv run scripts/crawl_calendar.py
      uv run scripts/crawl_calendar.py --no-images   # skip image download
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from icalendar import Calendar

ICS_URL = "https://tockify.com/api/feeds/ics/birds.connect.sea"
CALENDAR_NAME = "birds.connect.sea"
SEATTLE = ZoneInfo("America/Los_Angeles")

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "src" / "data"
IMAGE_DIR = ROOT / "src" / "assets" / "events"


def event_id(uid: str) -> str:
    """Stable, filesystem-safe id derived from the Tockify UID."""
    return hashlib.sha1(uid.encode("utf-8")).hexdigest()[:12]


def get_categories(comp) -> list[str]:
    """CATEGORIES may be a single vCategory, a list, or comma-joined text."""
    raw = comp.get("CATEGORIES")
    if raw is None:
        return []
    items = raw if isinstance(raw, list) else [raw]
    out: list[str] = []
    for it in items:
        cats = getattr(it, "cats", None)
        if cats:
            out.extend(str(c).strip() for c in cats)
        else:
            out.extend(s.strip() for s in str(it).split(","))
    return [c for c in out if c]


def get_promotion(comp) -> dict | None:
    """X-TKF-PROMOTION-BUTTON carries a registration/ticket/donate link.

    Value is the URL; the label lives in the `label` parameter.
    """
    raw = comp.get("X-TKF-PROMOTION-BUTTON")
    if raw is None:
        return None
    label = "Register"
    try:
        label = str(raw.params.get("label") or label)
    except AttributeError:
        pass
    url = str(raw).strip()
    if not url:
        return None
    return {"label": label, "url": url}


def normalize_dt(value) -> tuple[str, str, bool]:
    """Return (iso, date_str, all_day) for a DTSTART/DTEND value.

    All-day events use VALUE=DATE (a plain `date`). Timed events are converted
    to Seattle local time so the site renders correct times regardless of the
    viewer's timezone.
    """
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=SEATTLE)
        local = value.astimezone(SEATTLE)
        return local.isoformat(), local.date().isoformat(), False
    # plain date -> all-day
    return value.isoformat(), value.isoformat(), True


def parse_event(comp) -> dict | None:
    summary = str(comp.get("SUMMARY") or "").strip()
    dtstart_prop = comp.get("DTSTART")
    if not summary or dtstart_prop is None:
        return None

    start_iso, start_date, all_day = normalize_dt(dtstart_prop.dt)

    end_iso = end_date = None
    dtend_prop = comp.get("DTEND")
    if dtend_prop is not None:
        end_iso, end_date, _ = normalize_dt(dtend_prop.dt)
        # ICS all-day DTEND is exclusive; make the last day inclusive.
        if all_day and isinstance(dtend_prop.dt, date) and not isinstance(
            dtend_prop.dt, datetime
        ):
            inclusive = dtend_prop.dt - timedelta(days=1)
            end_date = inclusive.isoformat()
            end_iso = inclusive.isoformat()

    uid = str(comp.get("UID") or summary)
    eid = event_id(uid)

    image_url = str(comp.get("X-TKF-FEATURED-IMAGE") or "").strip() or None

    return {
        "id": eid,
        "uid": uid,
        "title": summary,
        "start": start_iso,
        "end": end_iso,
        "startDate": start_date,
        "endDate": end_date or start_date,
        "allDay": all_day,
        "multiDay": bool(end_date and end_date != start_date),
        "description": str(comp.get("DESCRIPTION") or "").strip(),
        "location": str(comp.get("LOCATION") or "").strip(),
        "detailUrl": str(comp.get("URL") or "").strip(),
        "status": str(comp.get("STATUS") or "").strip(),
        "categories": get_categories(comp),
        "registration": get_promotion(comp),
        "imageUrl": image_url,   # remote source; replaced with local path below
        "image": None,           # local bundled path (set by download_images)
    }


# Calendar-level headers Tockify emits with invalid durations (e.g. "P15M"
# instead of "PT15M"), which the strict icalendar parser rejects. They carry
# no event data, so we drop them before parsing.
_BAD_HEADER_PREFIXES = ("X-PUBLISHED-TTL", "REFRESH-INTERVAL")


def fetch_ics() -> str:
    resp = requests.get(ICS_URL, timeout=30)
    resp.raise_for_status()
    return resp.text


def clean_ics(text: str) -> str:
    lines = [
        ln
        for ln in text.splitlines()
        if not ln.startswith(_BAD_HEADER_PREFIXES)
    ]
    return "\r\n".join(lines)


def download_images(events: list[dict], force: bool) -> int:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    downloaded = 0
    for ev in events:
        url = ev.get("imageUrl")
        if not url:
            continue
        ext = ".png" if url.lower().rstrip("/").endswith(".png") else ".jpg"
        dest = IMAGE_DIR / f"{ev['id']}{ext}"
        # Local path consumed by Astro (imported relative to src/).
        ev["image"] = f"/src/assets/events/{dest.name}"
        if dest.exists() and not force:
            continue
        try:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            dest.write_bytes(r.content)
            downloaded += 1
        except requests.RequestException as exc:
            print(f"  ! image failed for {ev['title'][:40]!r}: {exc}", file=sys.stderr)
            ev["image"] = None
    return downloaded


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--no-images", action="store_true", help="skip image download")
    ap.add_argument("--force", action="store_true", help="re-download existing images")
    args = ap.parse_args()

    print(f"Fetching ICS feed: {ICS_URL}")
    cal = Calendar.from_ical(clean_ics(fetch_ics()))

    events: list[dict] = []
    for comp in cal.walk("VEVENT"):
        ev = parse_event(comp)
        if ev:
            events.append(ev)
    events.sort(key=lambda e: (e["start"], e["title"]))
    print(f"Parsed {len(events)} events.")

    if args.no_images:
        for ev in events:
            ev["image"] = None
    else:
        n = download_images(events, force=args.force)
        print(f"Downloaded {n} new image(s); {IMAGE_DIR} now backs the site.")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "events.json").write_text(
        json.dumps(events, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    all_categories = sorted({c for ev in events for c in ev["categories"]})
    meta = {
        "source": ICS_URL,
        "calendar": CALENDAR_NAME,
        "crawledAt": datetime.now(SEATTLE).isoformat(),
        "eventCount": len(events),
        "rawCategories": all_categories,
    }
    (DATA_DIR / "meta.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote {DATA_DIR/'events.json'} and {DATA_DIR/'meta.json'}.")


if __name__ == "__main__":
    main()
