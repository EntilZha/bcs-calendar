import { useCallback, useEffect, useRef, useState } from "react";
import type { DayBucket } from "../../lib/eventTime";
import { KioskDayColumn } from "./KioskDayColumn";

/**
 * Every upcoming day in one horizontally-scrolling row.
 *
 * Days must never wrap onto a second line: a day pushed below the fold is a day
 * nobody sees. So the columns live in a fixed-height track that scrolls
 * sideways, each column is sized so the next one is always partly visible, and
 * each column scrolls its own events vertically rather than stretching the page.
 *
 * Panning is native overflow scrolling, which means touch swipe, trackpad
 * gestures, and shift-wheel all work without a gesture library. The arrows are a
 * second, more obvious affordance on top of it for anyone who does not think to
 * swipe.
 */
export function KioskDayTrack({
  columns,
  nowMs,
  todayKeyValue,
  emptyLabel,
  onOpen,
  trackRef,
}: {
  columns: DayBucket[];
  nowMs: number;
  todayKeyValue: string;
  emptyLabel?: string;
  onOpen: (id: string) => void;
  trackRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const firstColRef = useRef<HTMLElement | null>(null);

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    // The 2px slack absorbs sub-pixel rounding at fractional zoom levels, which
    // would otherwise leave the forward arrow enabled with nowhere to go.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, [trackRef]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncEdges();
    el.addEventListener("scroll", syncEdges, { passive: true });
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", syncEdges);
      observer.disconnect();
    };
  }, [syncEdges, trackRef, columns.length]);

  /** One column plus its gap, measured rather than hard-coded so the arrows
   *  stay in step with whatever the breakpoint made the columns. */
  const step = () => {
    const el = trackRef.current;
    const col = firstColRef.current;
    if (!el || !col) return 0;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    return col.getBoundingClientRect().width + gap;
  };

  const nudge = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * step(), behavior: "smooth" });
  };

  const goHome = () => {
    trackRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  // Swiping a long way out and then tapping ◀ twenty times is nobody's idea of a
  // good time. Distinct from Start over, which also clears the filter — this
  // keeps what the visitor chose and only takes them back to the nearest day.
  const homeLabel =
    columns[0]?.key === todayKeyValue ? "Back to today" : "Back to the start";

  const ARROW =
    "absolute top-1/2 z-20 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-base font-bold text-brand shadow-lg ring-1 ring-black/10 transition active:scale-95 disabled:pointer-events-none disabled:opacity-0 md:min-h-touch md:min-w-touch md:text-2xl 2xl:min-h-touch-lg 2xl:min-w-touch-lg 2xl:text-4xl";
  const FADE =
    "pointer-events-none absolute inset-y-0 z-10 w-16 transition-opacity 2xl:w-24";

  return (
    // h-full, not flex-1: the parent is a block box with a definite height from
    // its own flex-1, so a percentage resolves but a flex factor would not.
    <div className="relative h-full w-full">
      {/* Soft edge showing content continues past the boundary. Paired with the
          partially-visible next column, this is what tells a passer-by the row
          scrolls at all. */}
      <div
        aria-hidden
        className={`${FADE} left-0 bg-gradient-to-r from-cream to-transparent ${
          atStart ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        aria-hidden
        className={`${FADE} right-0 bg-gradient-to-l from-cream to-transparent ${
          atEnd ? "opacity-0" : "opacity-100"
        }`}
      />

      <button
        type="button"
        onClick={() => nudge(-1)}
        disabled={atStart}
        aria-label="Show earlier days"
        className={`${ARROW} left-1 2xl:left-2`}
      >
        <span aria-hidden>◀</span>
      </button>
      <button
        type="button"
        onClick={() => nudge(1)}
        disabled={atEnd}
        aria-label="Show later days"
        className={`${ARROW} right-1 2xl:right-2`}
      >
        <span aria-hidden>▶</span>
      </button>

      {/* Shown only before the visitor has scrolled, and only when there is
          somewhere to scroll to. Swiping is discoverable on a phone but far
          less obvious on a wall-mounted panel. */}
      {!atStart && (
        <button
          type="button"
          onClick={goHome}
          className="absolute bottom-2 left-2 z-20 inline-flex min-h-11 items-center rounded-full bg-brand px-3.5 text-sm font-semibold text-white shadow-lg transition active:scale-95 md:bottom-3 md:left-3 md:min-h-touch md:px-5 md:text-lg 2xl:px-7 2xl:text-k-ui"
        >
          <span aria-hidden className="mr-2">
            ←
          </span>
          {homeLabel}
        </button>
      )}

      {atStart && !atEnd && (
        <p className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-full bg-brand/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg md:bottom-3 md:right-3 md:px-5 md:py-2 md:text-lg 2xl:px-7 2xl:py-3 2xl:text-k-ui">
          Swipe for more days
        </p>
      )}

      <div
        ref={trackRef}
        className="flex h-full snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain md:gap-6 2xl:gap-10"
      >
        {columns.map((bucket, i) => (
          <KioskDayColumn
            key={bucket.key}
            ref={i === 0 ? firstColRef : undefined}
            bucket={bucket}
            nowMs={nowMs}
            todayKeyValue={todayKeyValue}
            emptyLabel={emptyLabel}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}
