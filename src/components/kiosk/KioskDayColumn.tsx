import { forwardRef } from "react";
import type { CalEvent } from "../eventUI";
import { dayHeading, shortDay } from "../eventUI";
import { addDays, type DayBucket } from "../../lib/eventTime";
import { KioskEventCard } from "./KioskEventCard";

/** "Today" / "Tomorrow" beat a date a visitor has to decode. Anything further
 *  out gets just the weekday, since the date sits on the line underneath. */
function columnHeading(key: string, todayKeyValue: string): string {
  if (key === todayKeyValue) return "Today";
  if (key === addDays(todayKeyValue, 1)) return "Tomorrow";
  return dayHeading(key).split(",")[0];
}

/**
 * One day, as a fixed-width column in the scrolling track.
 *
 * The widths are deliberately a little under a clean fraction of the track —
 * 30% rather than a third, 46% rather than a half — so the following column is
 * always clipped at the edge rather than ending flush. That sliver is the
 * clearest signal that there is more to the right.
 */
export const KioskDayColumn = forwardRef<HTMLElement, {
  bucket: DayBucket;
  nowMs: number;
  todayKeyValue: string;
  /** Set only in weekend mode, where an empty day is itself the answer. */
  emptyLabel?: string;
  onOpen: (id: string) => void;
}>(function KioskDayColumn(
  { bucket, nowMs, todayKeyValue, emptyLabel, onOpen },
  ref,
) {
  const isToday = bucket.key === todayKeyValue;
  const heading = columnHeading(bucket.key, todayKeyValue);

  return (
    <section
      ref={ref}
      className="flex h-full w-[82%] flex-none snap-start flex-col md:w-[46%] 2xl:w-[30%]"
    >
      <header
        className={`mb-3 shrink-0 border-b-4 pb-2 2xl:mb-5 2xl:pb-3 ${
          isToday ? "border-leaf" : "border-sage/40"
        }`}
      >
        <h2 className="font-bold leading-tight text-brand text-xl md:text-2xl 2xl:text-k-day">
          {heading}
        </h2>
        <p className="text-gray-500 text-sm md:text-base 2xl:text-k-meta">
          {shortDay(bucket.key)}
          {bucket.events.length > 0 && (
            <>
              {" · "}
              {bucket.events.length}{" "}
              {bucket.events.length === 1 ? "event" : "events"}
            </>
          )}
        </p>
      </header>

      {bucket.events.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-4 text-gray-500 ring-1 ring-black/5 md:p-6 md:text-lg 2xl:text-k-meta">
          {emptyLabel ?? "Nothing scheduled."}
        </p>
      ) : (
        // Each day scrolls its own events, so a busy day can never push the
        // following days off the screen.
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-2 pr-1 2xl:gap-5">
          {bucket.events.map((ev: CalEvent) => (
            <KioskEventCard key={ev.id} ev={ev} nowMs={nowMs} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
});
