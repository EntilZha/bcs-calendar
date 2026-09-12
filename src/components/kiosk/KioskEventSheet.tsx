import { useEffect } from "react";
import {
  type CalEvent,
  canonicalEventUrl,
  cleanTitle,
  eventImage,
  linkify,
  timeLabel,
  titleFlagOf,
} from "../eventUI";
import { QrCode } from "./QrCode";
import { venueLabel } from "./KioskEventCard";
import { isAtCapacity } from "../../config/categories";
import { dayHeading } from "../eventUI";

/**
 * Full-screen detail for one event, with a code to carry it to a phone.
 *
 * Intentionally not `EventModal` from the calendar: that one offers Copy Link,
 * Copy BCS Link and a new tab to Tockify. On a shop display a clipboard is
 * pointless and a new tab is an unrecoverable state nobody can back out of.
 */
export function KioskEventSheet({
  ev,
  buildOrigin,
  onClose,
}: {
  ev: CalEvent;
  buildOrigin: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const img = eventImage(ev);
  const flag = titleFlagOf(ev);
  const venue = venueLabel(ev);
  const url = canonicalEventUrl(ev.id, buildOrigin);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream">
      <header className="flex items-center justify-between gap-4 border-b border-black/10 bg-white px-4 py-3 md:px-8 md:py-4">
        <p className="font-semibold text-brand md:text-xl 2xl:text-k-time">
          {dayHeading(ev.startDate)}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-full bg-brand px-6 font-bold text-white transition active:scale-95 2xl:min-h-touch-lg 2xl:text-k-ui"
        >
          <span aria-hidden>✕</span> Close
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 2xl:px-16">
        <div className="mx-auto grid max-w-6xl gap-8 2xl:max-w-7xl md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            {img && (
              <img
                src={img}
                alt=""
                className="mb-5 h-40 w-full rounded-2xl object-cover md:h-56 2xl:h-72"
              />
            )}
            <p className="font-semibold text-leaf md:text-2xl 2xl:text-k-time">
              {timeLabel(ev)}
            </p>
            <h1 className="mt-2 font-bold leading-tight text-brand text-2xl md:text-4xl 2xl:text-k-hero">
              {cleanTitle(ev.title)}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {flag === "cancelled" && (
                <span className="rounded-full bg-red-100 px-4 py-1.5 font-bold text-red-800 2xl:text-k-meta">
                  This event has been cancelled
                </span>
              )}
              {flag === "rescheduled" && (
                <span className="rounded-full bg-amber-100 px-4 py-1.5 font-bold text-amber-900 2xl:text-k-meta">
                  Rescheduled — check the date
                </span>
              )}
              {isAtCapacity(ev) && (
                <span className="rounded-full bg-amber-100 px-4 py-1.5 font-bold text-amber-900 2xl:text-k-meta">
                  This one is full — you can join the waitlist
                </span>
              )}
              {!isAtCapacity(ev) && ev.registrationRequired === false && (
                <span className="rounded-full bg-white px-4 py-1.5 font-bold text-brand ring-1 ring-brand/30 2xl:text-k-meta">
                  No sign-up needed — just turn up
                </span>
              )}
              {!isAtCapacity(ev) && ev.registrationRequired === true && (
                <span className="rounded-full bg-brand px-4 py-1.5 font-bold text-white 2xl:text-k-meta">
                  Sign up to save a spot
                </span>
              )}
            </div>

            {venue && (
              <p className="mt-4 font-semibold text-gray-700 md:text-xl 2xl:text-k-time">
                {venue}
              </p>
            )}
            {/* The full address is worth showing here even though the card hides
                it — this is the screen a visitor reads before heading out. */}
            {ev.location && !/^Birds Connect Seattle/i.test(ev.location) && (
              <p className="mt-1 text-gray-500 md:text-lg 2xl:text-k-meta">
                {ev.location.replace(/,\s*USA$/, "")}
              </p>
            )}

            {ev.description && (
              <div className="mt-6 max-w-3xl whitespace-pre-line leading-relaxed text-gray-800 md:text-lg 2xl:text-k-meta">
                {linkify(ev.description)}
              </div>
            )}
          </div>

          {/* Phone hand-off. Hidden on a phone, where the visitor already has
              the thing a QR code is for. */}
          <aside className="hidden shrink-0 md:block">
            {/* The card sets one width and the code fills it, so the QR and its
                caption line up as a single block rather than a small square
                floating above a wider line of text. */}
            <div className="sticky top-0 flex w-56 flex-col items-center rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5 2xl:w-80 2xl:p-7">
              <QrCode url={url} className="aspect-square w-full" />
              <p className="mt-4 font-semibold text-brand md:text-lg 2xl:mt-6 2xl:text-k-time">
                Scan for Event Info
              </p>
              {ev.registrationRequired === true && (
                <p className="mt-2 text-sm text-gray-600 2xl:text-base">
                  Sign-up link is on the page.
                </p>
              )}
            </div>
          </aside>

          {/* Phone fallback for the same destination. */}
          <a
            href={url}
            className="inline-flex min-h-touch items-center justify-center rounded-full bg-leaf px-6 font-bold text-white md:hidden"
          >
            Open full details →
          </a>
        </div>
      </div>
    </div>
  );
}
