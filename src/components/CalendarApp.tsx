import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { FACETS, FACET_BY_ID, facetIdsForEvent } from "../config/categories";
import {
  type CalEvent,
  BookmarkButton,
  EventBody,
  EventLinks,
  FacetChips,
  LocationLine,
  cleanTitle,
  dayHeading,
  eventImage,
  eventPagePath,
  linkify,
  parseDayKey,
  timeLabel,
  todayKey,
} from "./eventUI";
import {
  clearAll,
  toggleFacet as storeToggleFacet,
  useFilterState,
} from "../lib/filterStore";
import { useBookmarkSet } from "../lib/bookmarks";
import eventsData from "../data/events.json";
import metaData from "../data/meta.json";

const EVENTS = eventsData as CalEvent[];

// ---------------------------------------------------------------------------
// Full-size detail modal, opened by clicking a card
// ---------------------------------------------------------------------------

function EventModal({
  ev,
  onClose,
  fromView,
}: {
  ev: CalEvent;
  onClose: () => void;
  fromView: "agenda" | "calendar";
}) {
  const img = eventImage(ev);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  // Track whether the body has more content below the fold, to show a scroll
  // affordance that fades out once the user reaches the bottom.
  const updateMoreBelow = () => {
    const el = scrollRef.current;
    if (!el) return;
    setMoreBelow(el.scrollHeight - el.clientHeight - el.scrollTop > 8);
  };
  useEffect(() => {
    updateMoreBelow();
    const t = setTimeout(updateMoreBelow, 300); // re-measure after image loads
    window.addEventListener("resize", updateMoreBelow);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", updateMoreBelow);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-gray-600 shadow ring-1 ring-black/5 hover:text-brand"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>

        {img && (
          <div className="flex shrink-0 items-center justify-center bg-gray-100 p-2">
            <img
              src={img}
              alt={`Photo for ${cleanTitle(ev.title)}`}
              className="max-h-[38vh] max-w-full object-contain"
            />
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={updateMoreBelow}
            className="flex-1 overflow-y-auto p-5 sm:p-6"
          >
            <EventBody
              ev={ev}
              titleHref={`${eventPagePath(ev.id)}?from=${fromView}`}
            />
          </div>

          {/* Scroll affordance: fade + pill, shown only when more is below. */}
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-gradient-to-t from-white via-white/90 to-transparent transition-opacity duration-200 ${
              moreBelow ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-medium text-white shadow-md">
              Scroll for more
              <svg
                className="h-3.5 w-3.5 animate-bounce"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 14a1 1 0 01-.7-.29l-5-5a1 1 0 111.4-1.42L10 11.59l4.3-4.3a1 1 0 111.4 1.42l-5 5A1 1 0 0110 14z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event card
// ---------------------------------------------------------------------------

function EventCard({
  ev,
  onOpen,
  fromView,
}: {
  ev: CalEvent;
  onOpen: (ev: CalEvent) => void;
  fromView: "agenda" | "calendar";
}) {
  const [open, setOpen] = useState(false);
  const facetIds = facetIdsForEvent(ev);
  const img = eventImage(ev);
  const cancelled = ev.status === "CANCELLED" || /cancelled/i.test(ev.title);

  const preview =
    ev.description.length > 220 && !open
      ? ev.description.slice(0, 220).trimEnd() + "…"
      : ev.description;

  return (
    <article
      onClick={(e) => {
        // Let inner links/buttons handle their own clicks; tapping anywhere
        // else on the card opens the popover detail view.
        if ((e.target as HTMLElement).closest("a, button")) return;
        onOpen(ev);
      }}
      className="relative flex cursor-pointer gap-4 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:ring-leaf/40"
    >
      <BookmarkButton ev={ev} variant="icon" />
      {img && (
        <button
          type="button"
          onClick={() => onOpen(ev)}
          aria-label={`Open ${cleanTitle(ev.title)}`}
          className="hidden shrink-0 sm:block"
        >
          <img
            src={img}
            alt=""
            loading="lazy"
            className="h-24 w-24 rounded-lg object-cover"
          />
        </button>
      )}
      <div className="min-w-0 flex-1 pr-8 sm:pr-24">
          <p className="text-sm font-medium text-leaf">{timeLabel(ev)}</p>
          <h3 className="font-semibold leading-snug text-brand">
            {cancelled && (
              <span className="mr-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700 align-middle">
                Cancelled
              </span>
            )}
            <a
              href={`${eventPagePath(ev.id)}?from=${fromView}`}
              target="_blank"
              rel="noopener"
              className="text-left hover:underline"
            >
              {cleanTitle(ev.title)}
            </a>
          </h3>

          <LocationLine location={ev.location} />

          {facetIds.length > 0 && (
            <div className="mt-2">
              <FacetChips ids={facetIds} />
            </div>
          )}

          {ev.description && (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {linkify(preview)}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {ev.description.length > 220 && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="font-medium text-brand hover:text-leaf"
              >
                {open ? "Show less" : "Show more"}
              </button>
            )}
            <EventLinks ev={ev} showBookmark={false} />
          </div>
        </div>
      </article>
  );
}

// ---------------------------------------------------------------------------
// Month grid view
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MonthView({
  events,
  monthAnchor,
  onMonthChange,
  onSelectDay,
  selectedDay,
  onOpen,
}: {
  events: CalEvent[];
  monthAnchor: Date;
  onMonthChange: (d: Date) => void;
  onSelectDay: (key: string) => void;
  selectedDay: string | null;
  onOpen: (ev: CalEvent) => void;
}) {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();

  // Map dayKey -> events occurring that day (spanning multi-day events).
  const byDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of events) {
      let cur = parseDayKey(ev.startDate);
      const end = parseDayKey(ev.endDate);
      let guard = 0;
      while (cur <= end && guard < 400) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
        (map[key] ??= []).push(ev);
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
        guard++;
      }
    }
    return map;
  }, [events]);

  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = todayKey();
  const monthLabel = first.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, month - 1, 1))}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/10"
        >
          ← Prev
        </button>
        <h2 className="text-lg font-bold text-brand">{monthLabel}</h2>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, month + 1, 1))}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/10"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-gray-200 text-sm ring-1 ring-gray-200">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="bg-brand py-2 text-center text-xs font-semibold uppercase tracking-wide text-sage"
          >
            <span className="sm:hidden">{w[0]}</span>
            <span className="hidden sm:inline">{w}</span>
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="min-h-20 bg-cream/60" />;
          const key = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(cell.getDate()).padStart(2, "0")}`;
          const dayEvents = byDay[key] ?? [];
          const isToday = key === today;
          const isSelected = key === selectedDay;
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`${dayHeading(key)}, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
              onClick={(e) => {
                // Individual event links open in a new tab; clicking anywhere
                // else in the cell shows that day's agenda below.
                if ((e.target as HTMLElement).closest("a")) return;
                onSelectDay(key);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDay(key);
                }
              }}
              className={`flex min-h-20 cursor-pointer flex-col gap-1 p-1.5 text-left align-top transition sm:min-h-28 ${
                isSelected ? "bg-pop/30" : "bg-white hover:bg-cream"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-leaf text-white" : "text-gray-700"
                }`}
              >
                {cell.getDate()}
              </span>
              <span className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((ev) => {
                  const fid = facetIdsForEvent(ev)[0];
                  const dot = fid ? FACET_BY_ID[fid].dot : "bg-gray-400";
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onOpen(ev)}
                      title={cleanTitle(ev.title)}
                      aria-label={cleanTitle(ev.title)}
                      className="flex items-center gap-1 truncate rounded text-left text-[10px] leading-tight text-gray-600 hover:bg-leaf/10 hover:text-brand"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                      <span className="hidden truncate sm:inline">{ev.title}</span>
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] font-medium text-leaf">
                    +{dayEvents.length - 3} more
                  </span>
                )}
                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-bold text-leaf sm:hidden">
                    {dayEvents.length}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-5">
          <h3 className="mb-2 text-base font-bold text-brand">
            {dayHeading(selectedDay)}
          </h3>
          <div className="flex flex-col gap-3">
            {(byDay[selectedDay] ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No events this day.</p>
            ) : (
              (byDay[selectedDay] ?? []).map((ev) => (
                <EventCard
                  key={ev.id + selectedDay}
                  ev={ev}
                  onOpen={onOpen}
                  fromView="calendar"
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agenda view
// ---------------------------------------------------------------------------

function AgendaView({
  events,
  onOpen,
  emptyMessage,
}: {
  events: CalEvent[];
  onOpen: (ev: CalEvent) => void;
  emptyMessage: string;
}) {
  const groups = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of events) (map[ev.startDate] ??= []).push(ev);
    return Object.keys(map)
      .sort()
      .map((key) => ({ key, events: map[key] }));
  }, [events]);

  if (groups.length === 0) {
    return (
      <p className="rounded-xl bg-white p-8 text-center text-gray-500 ring-1 ring-black/5">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.key}>
          <div className="sticky top-[60px] z-10 -mx-1 mb-2 bg-cream/90 px-1 py-1 backdrop-blur">
            <h2 className="text-base font-bold text-brand">{dayHeading(g.key)}</h2>
          </div>
          <div className="flex flex-col gap-3">
            {g.events.map((ev) => (
              <EventCard key={ev.id} ev={ev} onOpen={onOpen} fromView="agenda" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app: filter bar + view toggle
// ---------------------------------------------------------------------------

export default function CalendarApp() {
  // Open in calendar (month) view when arrived at with ?view=calendar
  // (e.g. the "Back to calendar" link from an event page).
  const [view, setView] = useState<"agenda" | "month">(() => {
    if (typeof window !== "undefined") {
      const v = new URLSearchParams(window.location.search).get("view");
      if (v === "calendar" || v === "month") return "month";
    }
    return "agenda";
  });
  const [query, setQuery] = useState("");
  // Facet selection + "saved only" live in a shared store so the header nav
  // shortcuts and this filter bar stay in sync.
  const { facets: activeFacets, savedOnly } = useFilterState();
  const savedIds = useBookmarkSet();
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [modalEvent, setModalEvent] = useState<CalEvent | null>(null);
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const t = parseDayKey(todayKey());
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const fuse = useMemo(
    () =>
      new Fuse(EVENTS, {
        keys: ["title", "description", "location"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [],
  );

  const today = todayKey();

  const filtered = useMemo(() => {
    let list: CalEvent[] = EVENTS;

    if (query.trim()) list = fuse.search(query.trim()).map((r) => r.item);

    if (activeFacets.size > 0) {
      list = list.filter((ev) =>
        facetIdsForEvent(ev).some((id) => activeFacets.has(id)),
      );
    }

    if (savedOnly) list = list.filter((ev) => savedIds.has(ev.id));

    // "Upcoming only" applies in agenda view (month view shows the full month),
    // but is bypassed when viewing saved events so saved past events still show.
    if (upcomingOnly && view === "agenda" && !savedOnly) {
      list = list.filter((ev) => ev.endDate >= today);
    }

    return list;
  }, [query, activeFacets, savedOnly, savedIds, upcomingOnly, view, today, fuse]);

  const emptyMessage = savedOnly
    ? savedIds.size === 0
      ? "You haven't saved any events yet. Tap the star on an event to save it."
      : "None of your saved events match the current filters."
    : "No events match your filters.";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Controls */}
      <div className="mb-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg bg-white p-1 ring-1 ring-black/5">
            {(["agenda", "month"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition ${
                  view === v
                    ? "bg-brand text-white shadow-sm"
                    : "text-gray-600 hover:text-brand"
                }`}
              >
                {v === "agenda" ? "Agenda" : "Calendar"}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events, places, topics…"
              aria-label="Search events"
              className="w-full rounded-lg border-0 bg-white py-2 pl-9 pr-3 text-sm shadow-sm ring-1 ring-black/5 placeholder:text-gray-400 focus:ring-2 focus:ring-leaf"
            />
            <svg
              className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Facet filters */}
        <div className="flex flex-wrap items-center gap-2">
          {FACETS.map((f) => {
            const on = activeFacets.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => storeToggleFacet(f.id)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                  on
                    ? "bg-brand text-white ring-brand"
                    : `${f.chip} hover:ring-2`
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${on ? "bg-pop" : f.dot}`}
                />
                {f.label}
              </button>
            );
          })}
          {activeFacets.size > 0 && (
            <button
              type="button"
              onClick={() => clearAll()}
              className="text-xs font-medium text-gray-500 underline hover:text-brand"
            >
              Clear
            </button>
          )}
        </div>

        {view === "agenda" && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={upcomingOnly}
              onChange={(e) => setUpcomingOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-leaf focus:ring-leaf"
            />
            Upcoming only
          </label>
        )}
      </div>

      {/* Results */}
      {view === "agenda" ? (
        <>
          <p className="mb-3 text-sm text-gray-500">
            {filtered.length} event{filtered.length === 1 ? "" : "s"}
          </p>
          <AgendaView
            events={filtered}
            onOpen={setModalEvent}
            emptyMessage={emptyMessage}
          />
        </>
      ) : (
        <>
          {savedOnly && filtered.length === 0 && (
            <p className="mb-3 rounded-xl bg-white p-8 text-center text-gray-500 ring-1 ring-black/5">
              {emptyMessage}
            </p>
          )}
          <MonthView
            events={filtered}
            monthAnchor={monthAnchor}
            onMonthChange={(d) => {
              setMonthAnchor(d);
              setSelectedDay(null);
            }}
            onSelectDay={(key) =>
              setSelectedDay((cur) => (cur === key ? null : key))
            }
            selectedDay={selectedDay}
            onOpen={setModalEvent}
          />
        </>
      )}

      {modalEvent && (
        <EventModal
          ev={modalEvent}
          fromView={view === "month" ? "calendar" : "agenda"}
          onClose={() => setModalEvent(null)}
        />
      )}

      <p className="mt-8 text-center text-xs text-gray-400">
        {EVENTS.length} events · last updated{" "}
        {new Date(metaData.crawledAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
