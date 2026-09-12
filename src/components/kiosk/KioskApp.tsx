import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import eventsData from "../../data/events.json";
import type { CalEvent } from "../eventUI";
import { KIOSK_FILTERS } from "../../config/categories";
import {
  type DayBucket,
  bucketByDay,
  dayKeyForMs,
  stillJoinable,
  upcomingWeekendKeys,
  useNowMs,
} from "../../lib/eventTime";
import {
  type KioskState,
  initialKioskState,
  isDefaultState,
  kioskReducer,
} from "../../lib/kioskReducer";
import { KioskFilterRow, KioskTopBar } from "./KioskTopBar";
import { KioskDayTrack } from "./KioskDayTrack";
import { KioskEventSheet } from "./KioskEventSheet";

const EVENTS = eventsData as CalEvent[];

/** How long the screen sits untouched before returning to the default view. A
 *  visitor reads a three-column screen for 20–40s, so 30s would snatch it away
 *  mid-sentence; five minutes leaves the next visitor inheriting "Field Trips,
 *  three weeks out". */
const IDLE_MS = 90_000;
/** How much warning before that happens. */
const IDLE_WARN_MS = 10_000;
/** A display left running for days would otherwise keep serving the build it
 *  first loaded, long after the nightly crawl has published new events. */
const STALE_BUILD_MS = 6 * 60 * 60 * 1000;

/** Dev-only clock override, so "what will the screen look like on Saturday
 *  morning" is one URL away. `import.meta.env.DEV` is statically replaced, so
 *  this branch is eliminated from the production bundle entirely. */
function devClockOverride(): number | undefined {
  if (!import.meta.env.DEV || typeof window === "undefined") return undefined;
  const raw = new URLSearchParams(window.location.search).get("now");
  if (!raw) return undefined;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export default function KioskApp({
  buildOrigin,
  base,
}: {
  buildOrigin: string;
  base: string;
}) {
  const [override] = useState(devClockOverride);
  const nowMs = useNowMs(60_000, override);
  const [state, dispatch] = useReducer(kioskReducer, initialKioskState);

  const filter = useMemo(
    () =>
      KIOSK_FILTERS.find((f) => f.id === state.filterId) ?? KIOSK_FILTERS[0],
    [state.filterId],
  );

  // Every day that has something on, after dropping finished events. Because
  // the "has it ended" filter runs before bucketing, a day whose events are all
  // over simply stops existing and the window advances on its own.
  const buckets = useMemo<DayBucket[]>(() => {
    if (nowMs === null) return [];
    const matching = EVENTS.filter((ev) => filter.match(ev));
    return bucketByDay(stillJoinable(matching, nowMs));
  }, [filter, nowMs]);

  const todayKeyValue = nowMs === null ? "" : dayKeyForMs(nowMs);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const columns = useMemo<DayBucket[]>(() => {
    if (nowMs === null) return [];
    if (state.mode.kind === "weekend") {
      // Weekend mode keeps empty days on screen: the visitor asked about
      // Saturday, so "nothing on Saturday" is the answer, not a day to skip.
      const byKey = new Map(buckets.map((b) => [b.key, b]));
      return upcomingWeekendKeys(todayKeyValue).map(
        (key) => byKey.get(key) ?? { key, events: [] },
      );
    }
    return buckets;
  }, [buckets, state.mode, nowMs, todayKeyValue]);

  const openEvent = useMemo(
    () => EVENTS.find((ev) => ev.id === state.openEventId) ?? null,
    [state.openEventId],
  );

  // Changing filter or mode rebuilds the columns, so the old scroll offset
  // would point at an unrelated day. Jump back to the nearest one.
  useEffect(() => {
    trackRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [state.filterId, state.mode.kind]);

  // --- idle handling -------------------------------------------------------
  const [warning, setWarning] = useState(false);
  const loadedAt = useRef(Date.now());
  const stateRef = useRef<KioskState>(state);
  stateRef.current = state;

  const onIdle = useCallback(() => {
    setWarning(false);
    // Pick up a newer build while nobody is using the screen. Only when already
    // at the default view, so this can never interrupt a visitor.
    if (
      Date.now() - loadedAt.current > STALE_BUILD_MS &&
      isDefaultState(stateRef.current) &&
      !document.hidden
    ) {
      window.location.reload();
      return;
    }
    dispatch({ type: "reset" });
    trackRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    let idleTimer: number | undefined;
    let warnTimer: number | undefined;

    const schedule = () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(warnTimer);
      setWarning(false);
      warnTimer = window.setTimeout(() => {
        // Nothing to reset to, so don't yank the screen from under someone who
        // is reading without touching.
        if (isDefaultState(stateRef.current)) return;
        setWarning(true);
      }, IDLE_MS - IDLE_WARN_MS);
      idleTimer = window.setTimeout(onIdle, IDLE_MS);
    };

    // pointerdown rather than click, so a scroll-drag or a tap on dead space
    // still counts as someone being there. Deliberately no pointermove: large
    // touch overlays emit spurious moves from smudges and the timer would never
    // fire.
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const name of events) {
      window.addEventListener(name, schedule, { passive: true, capture: true });
    }
    schedule();

    return () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(warnTimer);
      for (const name of events) {
        window.removeEventListener(name, schedule, { capture: true });
      }
    };
  }, [onIdle]);

  // --- rendering -----------------------------------------------------------

  // Until the clock exists we are either prerendering at build time or in the
  // first frame after hydration. Render nothing date-dependent: this page's HTML
  // may be served for weeks after it was built.
  // The bar carries no dates, so it is safe to render during the build-time
  // prerender; only the day content waits for a real clock.
  const topBar = <KioskTopBar state={state} dispatch={dispatch} base={base} />;

  if (nowMs === null) {
    return (
      <>
        {topBar}
        <main className="mx-auto w-full max-w-[1800px] px-4 py-5 md:px-8 2xl:px-12 2xl:py-6">
          <div className="h-12 w-full max-w-2xl animate-pulse rounded-full bg-white/70" />
          <div className="mt-8 grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/70" />
            ))}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {topBar}
      <main className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col px-3 py-2.5 md:px-8 md:py-4 2xl:px-12 2xl:py-6">
      <KioskFilterRow state={state} dispatch={dispatch} />

      {columns.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5 2xl:p-16">
          <p className="font-bold text-brand text-xl md:text-3xl 2xl:text-k-day">
            Nothing coming up under “{filter.label}”.
          </p>
          <p className="mt-3 text-gray-600 md:text-xl 2xl:text-k-meta">
            Tap <span className="font-semibold">Everything</span> to see the full
            calendar, or ask a member of staff — we’re happy to help.
          </p>
        </div>
      ) : (
        <div className="mt-2.5 min-h-0 flex-1 md:mt-4 2xl:mt-6">
          <KioskDayTrack
            columns={columns}
            nowMs={nowMs}
            todayKeyValue={todayKeyValue}
            emptyLabel={
              state.mode.kind === "weekend"
                ? "Nothing scheduled — but the shop is open, come and say hello."
                : undefined
            }
            onOpen={(id) => dispatch({ type: "openEvent", id })}
            trackRef={trackRef}
          />
        </div>
      )}

      </main>

      {warning && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-4 bg-brand px-4 py-4 text-white shadow-lg 2xl:py-6">
          <p className="font-semibold md:text-lg 2xl:text-k-ui">
            Returning to today’s events…
          </p>
          <button
            type="button"
            onClick={() => setWarning(false)}
            className="inline-flex min-h-touch items-center rounded-full bg-pop px-6 font-bold text-brand 2xl:text-k-ui"
          >
            Keep browsing
          </button>
        </div>
      )}

      {openEvent && (
        <KioskEventSheet
          ev={openEvent}
          buildOrigin={buildOrigin}
          onClose={() => dispatch({ type: "closeEvent" })}
        />
      )}
    </>
  );
}
