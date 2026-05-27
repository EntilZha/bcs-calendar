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
| `src/config/categories.ts` | Raw Tockify tags → curated event-type facets |
| `src/components/CalendarApp.tsx` | The calendar UI (agenda, month, filters, search) |
| `src/pages/index.astro`, `src/layouts/Layout.astro` | Page shell + branding |

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
