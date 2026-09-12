import {
  type CalEvent,
  cleanTitle,
  eventImage,
  timeLabel,
  titleFlagOf,
} from "../eventUI";
import { isHappeningNow, startsSoon } from "../../lib/eventTime";
import { isAtCapacity, isInStore } from "../../config/categories";

/** Twenty-nine events share one very long headquarters location string whose
 *  street address is no use to somebody already standing in the shop. Everything
 *  else gets its venue name, which Tockify puts before the first comma. */
export function venueLabel(ev: CalEvent): string | null {
  if (isInStore(ev)) return "Here at the store";
  const raw = ev.location.trim();
  if (!raw) return null;
  const name = raw.split(",")[0].trim();
  // A bare street address has no venue name to show; keep it short instead of
  // printing the full "1060 Nishiwaki Ln, Renton, WA 98057, USA".
  if (/^\d/.test(name)) return raw.split(",").slice(0, 2).join(", ").trim();
  return name;
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "now" | "soon" | "free" | "rsvp" | "warn" | "alert";
}) {
  const tones: Record<string, string> = {
    now: "bg-leaf text-white",
    soon: "bg-pop text-brand",
    free: "bg-white text-brand ring-1 ring-brand/30",
    rsvp: "bg-brand text-white",
    warn: "bg-amber-100 text-amber-900",
    alert: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold md:text-base 2xl:px-4 2xl:py-1.5 2xl:text-k-meta ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function KioskEventCard({
  ev,
  nowMs,
  onOpen,
}: {
  ev: CalEvent;
  nowMs: number;
  onOpen: (id: string) => void;
}) {
  const img = eventImage(ev);
  const flag = titleFlagOf(ev);
  const live = isHappeningNow(ev, nowMs);
  const soon = !live && startsSoon(ev, nowMs);
  const venue = venueLabel(ev);

  return (
    <button
      type="button"
      onClick={() => onOpen(ev.id)}
      className={`flex w-full items-start gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 transition active:scale-[0.99] md:p-6 2xl:gap-6 2xl:p-8 ${
        live ? "ring-2 ring-leaf" : "ring-black/5"
      }`}
    >
      {img && (
        <img
          src={img}
          alt=""
          loading="lazy"
          className="hidden h-20 w-20 shrink-0 rounded-xl object-cover md:block md:h-24 md:w-24 2xl:h-32 2xl:w-32"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-leaf md:text-xl 2xl:text-k-time">
          {timeLabel(ev)}
        </p>
        <h3 className="mt-1 font-semibold leading-snug text-brand text-lg md:text-2xl 2xl:text-k-title">
          {cleanTitle(ev.title)}
        </h3>
        {venue && (
          <p className="mt-1 text-gray-600 text-sm md:text-base 2xl:text-k-meta">
            {venue}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 2xl:mt-4 2xl:gap-3">
          {flag === "cancelled" && <Badge tone="alert">Cancelled</Badge>}
          {flag === "rescheduled" && <Badge tone="warn">Rescheduled</Badge>}
          {live && <Badge tone="now">Happening now</Badge>}
          {soon && <Badge tone="soon">Starting soon</Badge>}
          {/* Hidden from the default view, but reachable under Field Trips or
              Everything — so say plainly that it is full rather than letting
              someone plan around a trip they cannot get on. */}
          {isAtCapacity(ev) ? (
            <Badge tone="warn">Full — waitlist only</Badge>
          ) : (
            <>
              {ev.registrationRequired === false && (
                <Badge tone="free">Just turn up</Badge>
              )}
              {ev.registrationRequired === true && (
                <Badge tone="rsvp">Sign up to save a spot</Badge>
              )}
            </>
          )}
        </div>
      </div>
    </button>
  );
}
