// Shared event types, helpers, and presentational pieces used by both the
// calendar app (cards + modal) and the standalone per-event pages.
import { useState } from "react";
import { FACET_BY_ID, facetIdsForEvent } from "../config/categories";
import { toggleBookmark, useIsBookmarked } from "../lib/bookmarks";

export interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  startDate: string; // YYYY-MM-DD (Seattle local)
  endDate: string; // inclusive
  allDay: boolean;
  multiDay: boolean;
  description: string;
  location: string;
  detailUrl: string;
  status: string;
  categories: string[];
  registration: { label: string; url: string } | null;
  image: string | null;
  imageUrl: string | null;
}

// Bundle the downloaded featured images through Vite so they get hashed,
// served paths in the build. Keyed by event id (filename without extension).
const imageModules = import.meta.glob<string>(
  "../assets/events/*.{jpg,jpeg,png}",
  { eager: true, query: "?url", import: "default" },
);
export const IMAGE_BY_ID: Record<string, string> = {};
for (const [path, url] of Object.entries(imageModules)) {
  const file = path.split("/").pop() ?? "";
  IMAGE_BY_ID[file.replace(/\.[^.]+$/, "")] = url;
}

export function eventImage(ev: CalEvent): string | null {
  return IMAGE_BY_ID[ev.id] ?? ev.imageUrl ?? null;
}

// ---------------------------------------------------------------------------
// Date helpers — rendered in Seattle (America/Los_Angeles) time so the calendar
// matches the organization regardless of the viewer's zone.
// ---------------------------------------------------------------------------

export const SEATTLE_TZ = "America/Los_Angeles";

export function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEATTLE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dayHeading(key: string): string {
  return parseDayKey(key).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function shortDay(key: string): string {
  return parseDayKey(key).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function timeLabel(ev: CalEvent): string {
  if (ev.allDay) {
    if (ev.multiDay) return `${shortDay(ev.startDate)} – ${shortDay(ev.endDate)}`;
    return "All day";
  }
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: SEATTLE_TZ,
  };
  const start = new Date(ev.start).toLocaleTimeString("en-US", opts);
  if (ev.end) {
    const end = new Date(ev.end).toLocaleTimeString("en-US", opts);
    return `${start} – ${end}`;
  }
  return start;
}

export function cleanTitle(title: string): string {
  return title.replace(/\*+\s*cancelled\s*\*+/i, "").trim();
}

// Root-relative path to an event's own page (for use in href).
export function eventPagePath(id: string): string {
  return `${import.meta.env.BASE_URL}event/${id}/`;
}

// Absolute URL to an event's own page on this site — the base path plus the
// live origin when running in the browser. Used for shareable "Copy Link".
export function eventPageUrl(id: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${eventPagePath(id)}`;
}

// Linkify bare URLs in event descriptions.
const URL_RE = /(https?:\/\/[^\s)]+)/g;
export function linkify(text: string) {
  return text.split(URL_RE).map((part, i) =>
    URL_RE.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand underline break-words hover:text-leaf"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

// A location counts as mappable if it carries an address (a street number or a
// state/ZIP), as opposed to a bare venue name or an online event.
function isMappable(location: string): boolean {
  return /\d/.test(location) || /\b[A-Z]{2}\s*\d{5}\b/.test(location);
}

function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

const PIN_PATH =
  "M9.69 18.933A1.5 1.5 0 0010.31 19c.21 0 .42-.044.62-.067C13.36 17.5 16 14.06 16 8.5a6 6 0 10-12 0c0 5.56 2.64 9 5.69 10.433zM10 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z";

export function LocationLine({
  location,
  showMap = false,
}: {
  location: string;
  showMap?: boolean;
}) {
  if (!location) return null;
  const mappable = isMappable(location);
  const url = mapsUrl(location);
  return (
    <div className="mt-1 flex flex-wrap items-start gap-x-2 gap-y-1 text-sm text-gray-600">
      <span className="flex min-w-0 items-start gap-1">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-sage"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d={PIN_PATH} clipRule="evenodd" />
        </svg>
        {mappable ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-words hover:text-brand hover:underline"
          >
            {location}
          </a>
        ) : (
          <span className="break-words">{location}</span>
        )}
      </span>
      {showMap && mappable && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sage/20 px-2 py-0.5 text-xs font-medium text-brand ring-1 ring-inset ring-sage/50 hover:bg-sage/30"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d={PIN_PATH} clipRule="evenodd" />
          </svg>
          Map
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Facet chips
// ---------------------------------------------------------------------------

export function FacetChips({ ids }: { ids: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const f = FACET_BY_ID[id];
        if (!f) return null;
        return (
          <span
            key={id}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${f.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
            {f.label}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Links / actions
// ---------------------------------------------------------------------------

// Copies `value` to the clipboard, briefly showing a confirmation. `primary`
// emphasizes this calendar's own shareable link over the secondary BCS link.
function CopyButton({
  value,
  label,
  primary = false,
}: {
  value: string;
  label: string;
  primary?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const idle = primary
    ? "bg-brand/5 text-brand ring-brand/40 hover:bg-brand/10 hover:ring-brand"
    : "text-gray-500 ring-gray-300 hover:text-brand hover:ring-brand";
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable (insecure context) — ignore */
        }
      }}
      aria-label={copied ? `${label} — copied` : label}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition ${
        copied ? "bg-leaf/10 text-leaf ring-leaf" : idle
      }`}
    >
      {copied ? (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m2.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-7.5A2.25 2.25 0 0 1 10.5 8.25Z"
          />
        </svg>
      )}
      {label}
    </button>
  );
}

// Star glyph — filled when saved, outline when not.
function StarIcon({ filled, className }: { filled: boolean; className: string }) {
  return filled ? (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.37 4.22a1 1 0 00.95.69h4.44c.97 0 1.37 1.24.59 1.81l-3.6 2.61a1 1 0 00-.36 1.12l1.37 4.22c.3.92-.76 1.69-1.54 1.12l-3.6-2.61a1 1 0 00-1.18 0l-3.6 2.61c-.78.57-1.84-.2-1.54-1.12l1.37-4.22a1 1 0 00-.36-1.12L1.1 9.65c-.78-.57-.38-1.81.59-1.81h4.44a1 1 0 00.95-.69L9.05 2.93z" />
    </svg>
  ) : (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.5c.17-.51.9-.51 1.07 0l1.83 5.64a.56.56 0 00.53.39h5.93c.54 0 .76.69.33 1l-4.8 3.49a.56.56 0 00-.2.63l1.83 5.63c.17.51-.42.94-.86.63l-4.8-3.48a.56.56 0 00-.66 0l-4.8 3.48c-.43.31-1.02-.12-.86-.63l1.84-5.63a.56.56 0 00-.2-.63l-4.8-3.49c-.44-.31-.21-1 .33-1h5.93a.56.56 0 00.53-.39L11.48 3.5z"
      />
    </svg>
  );
}

// Save / un-save toggle. Persists to localStorage; stays in sync across every
// surface showing the same event (card, modal, detail page) via the store.
// `variant="pill"` is the labeled action-row button; `variant="icon"` is the
// compact circular badge pinned to a card's top-right corner.
export function BookmarkButton({
  ev,
  variant = "pill",
}: {
  ev: CalEvent;
  variant?: "pill" | "icon";
}) {
  const saved = useIsBookmarked(ev.id);
  const label = saved
    ? `Remove ${cleanTitle(ev.title)} from saved events`
    : `Save ${cleanTitle(ev.title)}`;

  if (variant === "icon") {
    // Labeled pill on wider viewports; collapses to an icon-only circle once
    // the card narrows (matching where the card image drops out).
    return (
      <button
        type="button"
        aria-pressed={saved}
        onClick={() => toggleBookmark(ev.id)}
        aria-label={label}
        title={saved ? "Saved" : "Save event"}
        className={`absolute right-2 top-2 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-full p-1.5 text-sm font-medium shadow-sm ring-1 transition sm:px-3 sm:py-1 ${
          saved
            ? "bg-pop text-brand ring-brand/30"
            : "bg-white/90 text-gray-400 ring-black/5 hover:text-brand hover:ring-brand/30"
        }`}
      >
        <StarIcon filled={saved} className="h-5 w-5 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
      </button>
    );
  }

  const idle = "text-gray-500 ring-gray-300 hover:text-brand hover:ring-brand";
  const active = "bg-pop/20 text-brand ring-brand";
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => toggleBookmark(ev.id)}
      aria-label={label}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition ${
        saved ? active : idle
      }`}
    >
      <StarIcon filled={saved} className="h-4 w-4" />
      {saved ? "Saved" : "Save"}
    </button>
  );
}

// Action row shared by the card, the detail modal, and the event page. The
// card hides the labeled button (`showBookmark={false}`) in favor of a corner
// star; the modal and detail page keep it in the row.
export function EventLinks({
  ev,
  showBookmark = true,
}: {
  ev: CalEvent;
  showBookmark?: boolean;
}) {
  return (
    <>
      {showBookmark && <BookmarkButton ev={ev} />}
      {ev.registration && (
        <a
          href={ev.registration.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full bg-leaf px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-brand"
        >
          {ev.registration.label} →
        </a>
      )}
      {ev.detailUrl && (
        <a
          href={ev.detailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full border border-brand px-3 py-1 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
        >
          View on BCS Site
        </a>
      )}
      {/* This calendar's own shareable link (primary) vs. the original Tockify link. */}
      <CopyButton value={eventPageUrl(ev.id)} label="Copy Link" primary />
      <CopyButton value={ev.detailUrl} label="Copy BCS Link" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared detail body (time, title, location, tags, description, actions)
// ---------------------------------------------------------------------------

export function EventBody({
  ev,
  titleHref,
}: {
  ev: CalEvent;
  // When set, the title links to the event's own page (used in the popover).
  titleHref?: string;
}) {
  const facetIds = facetIdsForEvent(ev);
  const title = cleanTitle(ev.title);
  return (
    <>
      <p className="text-sm font-medium text-leaf">{timeLabel(ev)}</p>
      <h1 className="mt-0.5 text-xl font-bold leading-snug text-brand">
        {titleHref ? (
          <a
            href={titleHref}
            target="_blank"
            rel="noopener"
            className="hover:underline"
          >
            {title}
          </a>
        ) : (
          title
        )}
      </h1>
      <LocationLine location={ev.location} showMap />
      {facetIds.length > 0 && (
        <div className="mt-3">
          <FacetChips ids={facetIds} />
        </div>
      )}
      {ev.description && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700">
          {linkify(ev.description)}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <EventLinks ev={ev} />
      </div>
    </>
  );
}
