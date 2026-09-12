# Birds Connect Seattle — Calendar Redesign (Proof of Concept)

A redesigned, mobile-friendly events calendar for
[Birds Connect Seattle](https://birdsconnectsea.org/calendar/), built to show
staff what the calendar page could be.

The current page embeds a [Tockify](https://tockify.com/birds.connect.sea/agenda)
widget in an iframe: scroll fights the host page, it isn't mobile-friendly, and
you must click into every event to see details. This POC instead:

- **Agenda + Calendar views** — a scannable day-by-day list and a month grid.
- **Filter by event type** — Bird Outings, Field Trips, Classes, Volunteer, etc.
  (curated from Tockify's raw category tags).
- **Inline details** — date/time, location, image, description, and a
  **Register/Tickets** button on every card, no click-through required.
- **Search** across titles, descriptions, and locations.
- **Mobile-first**, no iframe, native page scroll, on-brand styling.

Stack: Astro 5 + React 19 + Tailwind 4 (static site), Python (`uv`) for the
data pipeline. Same toolchain as `photography-pedro-ai`.

> Proof of concept only — not an official Birds Connect Seattle product.

## How it works

```
Tockify ICS feed ──crawl_calendar.py──▶ src/data/events.json + src/assets/events/*
                                              │
                                              ▼
                              Astro build ──▶ static site (dist/)
```

Data source: Tockify's public iCalendar feed
(`https://tockify.com/api/feeds/ics/birds.connect.sea`) — complete event data
(title, dates, location, description, categories, featured image, registration
links) without scraping the JS widget.

## Commands

```bash
# 1. Crawl the live calendar -> data files + bundled images
uv run scripts/crawl_calendar.py          # add --no-images to skip downloads

# 2. Run the site locally
npm install
npm run dev                               # http://localhost:4321

# 3. Build / deploy
npm run build                             # -> dist/
npm run deploy                            # build + netlify deploy --prod

# 4. Sanity check: confirm our data matches the LIVE web calendar
uv run scripts/sanity_check.py
# (first run only) uv run --with playwright python -m playwright install chromium
```

## Layout

| Path | What |
|------|------|
| `scripts/crawl_calendar.py` | Fetch ICS, normalize events, download images, write `src/data/*.json` |
| `scripts/sanity_check.py` | Headless-browser scrape of the live agenda, diffed against `events.json` |
| `src/data/events.json` / `meta.json` | Generated event data + crawl metadata |
| `src/assets/events/` | Downloaded featured images (bundled by Astro) |
| `src/config/categories.ts` | Raw Tockify tags → curated event-type facets, plus the event-kind predicates |
| `src/components/CalendarApp.tsx` | The calendar UI (agenda, month, filters, search) |
| `src/pages/index.astro`, `src/layouts/Layout.astro` | Page shell + branding |
| `src/pages/today.astro`, `src/layouts/KioskLayout.astro` | The in-store display (see below) |
| `src/components/kiosk/` | In-store display components |
| `src/lib/eventTime.ts` | Day bucketing, the 3-day window, and the ticking clock |
| `src/lib/kioskReducer.ts` | In-store display state (filter, window, open event) |

## The in-store display (`/today/`)

A second view designed to be parked on the shop's touchscreen, so visitors can
see what they could walk into today without asking at the counter. Large type
readable from a couple of metres, touch-sized controls, and a QR code on each
event so a visitor can carry it to their phone.

- **Defaults to what a visitor can actually get to.** `isJoinable` in
  `src/config/categories.ts` is framed as exclusions, because the question a
  visitor is really asking is "can I go to this?", not "what type of event is
  this?". Out: anything already **at capacity**, multi-session **courses**,
  anything **online**, and **members-only** events. Everything else is in —
  including partner events and field trips that still have room. 84 of 101
  events at the time of writing. It is labelled **Recommended** in the UI; the
  predicate keeps the name `isJoinable` because that is what it computes. To
  move that line, edit `isJoinable`; it is the one function that decides.

  Note there is also a raw Tockify tag called `Recommended` (currently on one
  event). It has nothing to do with this filter — tagging an event `Recommended`
  in Tockify will not promote it here.
  - "At capacity" matches only a statement of fact (*"This trip is at
    capacity"*), never the conditional boilerplate — the Wingspan nights say
    *"if the event is full, please signup for the waitlist"*, and a bare mention
    of "waitlist" means nothing on its own.
  - A course is the `Classes` tag. Three of the four series run over several
    dates, so each row is one session of something enrolled in weeks ago.
    Contrast the Lunch and Learn, which also repeats 19 times but where every
    instance stands alone — hence keying on the tag, not on whether it repeats.
  - Full events are not merely hidden: under **Field Trips** or **Everything**
    they carry a "Full — waitlist only" badge, so nobody plans around a trip
    they cannot get on.
- **Kids & Teens and Young Adults are separate filters.** `Children`/`Youth` are
  actual children's programmes; `NextGen` is the young-adult council, whose events
  are often in taprooms. Conflating them would send a parent looking for a
  children's activity to a brewery game night.
- **Every upcoming day that has events, in one swipeable row.** Empty days are
  skipped, and events that have already finished are dropped, so the screen never
  advertises something a visitor has missed. Anything in progress is badged
  *Happening now*. Three days fit at kiosk width, two on an iPad, one on a phone,
  and the next column is always partly visible so it is obvious the row scrolls.
- **The page itself never scrolls.** A day pushed below the fold is a day nobody
  sees, so the track is pinned to the viewport and each day column scrolls its own
  events. Panning is native overflow scrolling — touch swipe, trackpad and
  shift-wheel all work — with arrows as a second, more obvious affordance.
- **Returns to the default view** after 90 seconds untouched (with a 10-second
  warning), and has an always-visible **Start over** button.
- **Previewing another moment:** in `npm run dev` only, `?now=<ISO>` freezes the
  clock — e.g. `/today/?now=2026-09-13T09:00:00-07:00` to see a Sunday. The
  parameter is compiled out of production builds.

Two constraints worth knowing before editing it. The page must render nothing
date-dependent until after hydration (`useNowMs` returns `null` first) because a
display can run a build that is weeks old, and a stale date baked into the static
HTML would be shown as fact. And it deliberately does not use `src/lib/filterStore.ts`
or mount `NavShortcuts` — a nav shortcut would navigate the shop display to the
dense desktop calendar with no way back.

## Refreshing the data

The crawl is idempotent — re-run `uv run scripts/crawl_calendar.py` any time to
pull the latest events, then rebuild. `sanity_check.py` documents that the
generated data still matches what the public site shows.

## GitHub Pages + nightly auto-refresh

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push
to `main`, on a nightly schedule, and on manual dispatch. Each run crawls the
live calendar first, so the deployed site always reflects current events.

One-time setup:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Confirm the project-site base path. This repo is configured for
   `https://<owner>.github.io/bcs-calendar/` via `base: '/bcs-calendar/'` and
   `site: 'https://OWNER.github.io'` in `astro.config.mjs` — update both if the
   repo name or owner differs (or a custom domain is used, where `base: '/'`).

**About the nightly schedule:** GitHub pauses scheduled workflows after 60 days
with no repository activity, and scheduled runs don't count as activity. To
avoid that, the nightly job commits the refreshed data back to the repo (its
`meta.json` timestamp changes every run), which keeps the repo active so the
cron never auto-pauses — and gives you a daily history of calendar changes. If
it ever is paused, GitHub emails the repo admin a one-click re-enable link.
