// Time and day-bucketing engine for the in-store display.
//
// Everything here is a pure function of (events, nowMs) so the awkward cases —
// "it is 12:59 and the Lunch and Learn ends at 13:00", "the window must slide
// forward once today's last event finishes" — are checkable without a browser.
//
// On timezones: `ev.start` / `ev.end` carry real Pacific offsets, so
// `new Date(iso).getTime()` is an absolute instant and comparing it to
// `Date.now()` is correct no matter what timezone the kiosk's OS is set to. The
// only place Seattle actually matters is deciding which calendar *day* an
// instant belongs to, which is what `dayKeyForMs` is for.
import { useEffect, useState } from "react";
// Type-only, so this module carries no runtime dependency on the component
// layer and stays importable from a plain script.
import type { CalEvent } from "../components/eventUI";

/** The organization's timezone: the calendar always reads in Seattle time,
 *  whatever zone the viewer (or the kiosk's OS) is set to. */
export const SEATTLE_TZ = "America/Los_Angeles";

/** A `YYYY-MM-DD` day in Seattle. Zero-padded, so string compare is date
 *  compare and `.sort()` is chronological. */
export type DayKey = string;

export interface DayBucket {
  key: DayKey;
  /** Ascending by start time. */
  events: CalEvent[];
}

// ---------------------------------------------------------------------------
// Instants
// ---------------------------------------------------------------------------

export function startMs(ev: CalEvent): number {
  return new Date(ev.start).getTime();
}

/** End of the event, falling back to two hours after the start when the feed
 *  omits `end` (every event currently has one, but an absent end must not make
 *  an event immortal). */
export function endMs(ev: CalEvent): number {
  return ev.end ? new Date(ev.end).getTime() : startMs(ev) + 2 * 60 * 60 * 1000;
}

export function hasEnded(ev: CalEvent, nowMs: number): boolean {
  return endMs(ev) <= nowMs;
}

export function isHappeningNow(ev: CalEvent, nowMs: number): boolean {
  return startMs(ev) <= nowMs && nowMs < endMs(ev);
}

/** Close enough that a visitor could still walk over and join it. */
export function startsSoon(ev: CalEvent, nowMs: number, withinMin = 90): boolean {
  const delta = startMs(ev) - nowMs;
  return delta > 0 && delta <= withinMin * 60_000;
}

/** The Seattle calendar day containing `ms`. `en-CA` formats as YYYY-MM-DD. */
export function dayKeyForMs(ms: number): DayKey {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEATTLE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

// ---------------------------------------------------------------------------
// Day keys
// ---------------------------------------------------------------------------

/** Day-of-week for a key, 0 = Sunday. Parsed as a plain Y/M/D triple so no
 *  timezone can shift it. */
export function weekdayIndex(key: DayKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function addDays(key: DayKey, n: number): DayKey {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isWeekend(key: DayKey): boolean {
  const day = weekdayIndex(key);
  return day === 0 || day === 6;
}

/**
 * The Sat/Sun a visitor means by "this weekend":
 *   Mon–Fri  -> the coming Saturday and Sunday
 *   Saturday -> today and tomorrow
 *   Sunday   -> today only
 *
 * Sunday deliberately does not jump to next weekend: someone standing in the
 * shop on a Sunday afternoon asking what's on this weekend means *now*.
 */
export function upcomingWeekendKeys(today: DayKey): DayKey[] {
  const day = weekdayIndex(today);
  if (day === 0) return [today];
  if (day === 6) return [today, addDays(today, 1)];
  const saturday = addDays(today, 6 - day);
  return [saturday, addDays(saturday, 1)];
}

// ---------------------------------------------------------------------------
// Bucketing and windowing
// ---------------------------------------------------------------------------

/**
 * Group events by their start day, dropping empty days entirely — the display
 * shows "the next 3 days that have something on", not the next 3 dates.
 *
 * Buckets on `startDate` only. Multi-day events therefore appear on their first
 * day; that is fine today (the one multi-day event in the feed is a field trip,
 * excluded by default) but would need the day-expansion MonthView does if a
 * multi-day drop-in event ever appears.
 */
export function bucketByDay(events: CalEvent[]): DayBucket[] {
  const byKey = new Map<DayKey, CalEvent[]>();
  for (const ev of events) {
    const list = byKey.get(ev.startDate);
    if (list) list.push(ev);
    else byKey.set(ev.startDate, [ev]);
  }
  return [...byKey.keys()]
    .sort()
    .map((key) => ({
      key,
      events: byKey.get(key)!.slice().sort((a, b) => startMs(a) - startMs(b)),
    }));
}

/** Events a visitor could still attend: anything that has not already ended.
 *  Applied before bucketing, so a day whose events have all finished simply
 *  stops producing a bucket and the window slides forward by itself. */
export function stillJoinable(events: CalEvent[], nowMs: number): CalEvent[] {
  return events.filter((ev) => !hasEnded(ev, nowMs));
}

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

/**
 * Ticking wall clock, `null` until after mount.
 *
 * The null phase is the point: this island is prerendered to static HTML at
 * build time, and a display parked in the shop may be running a build that is
 * weeks old. Anything time-dependent reached during that first render would be
 * frozen into the HTML, so callers render a date-free skeleton while `now` is
 * null and only compute real content after hydration.
 *
 * `overrideMs` freezes the clock for development previews.
 */
export function useNowMs(
  intervalMs = 60_000,
  overrideMs?: number,
): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (overrideMs !== undefined) {
      setNow(overrideMs);
      return;
    }
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, intervalMs);
    // A wall display sleeps overnight, and browsers throttle or suspend timers
    // in hidden tabs. Without this the screen can show yesterday's events for
    // up to a full interval after waking.
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, overrideMs]);

  return now;
}
