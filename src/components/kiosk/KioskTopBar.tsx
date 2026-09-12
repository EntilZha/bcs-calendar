import { KIOSK_FILTERS } from "../../config/categories";
import type { KioskAction, KioskState } from "../../lib/kioskReducer";

/** The two time ranges, as a segmented pair. Both labels name a span of days so
 *  they read as alternatives rather than as a label and a command. */
const MODES = [
  {
    id: "upcoming",
    label: "Next few days",
    /** A phone has room for one word, and these two still read as a pair. */
    short: "Upcoming",
    action: "showUpcoming",
  },
  { id: "weekend", label: "This weekend", short: "Weekend", action: "showWeekend" },
] as const;

/** Navigation away from the board: same touch height as everything else, but
 *  quiet, since it is not what the display is for. */
const NAV_LINK =
  "inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-sage transition hover:bg-white/10 hover:text-white active:scale-95 md:min-h-touch md:px-4 md:text-base 2xl:min-h-touch-lg 2xl:px-6 2xl:text-k-ui";

/** Filter pills, sized a step below the header controls. They are a longer,
 *  growing list, so they trade a little size for fitting on one line — with
 *  room for a couple more before the row has to scroll. */
/*
 * Smaller than the day content on purpose. Event text is read across the shop
 * at ~1.5 m and needs the 31px floor; a filter is scanned and then tapped, and
 * you are at arm's length by the time you touch it. So controls can sit well
 * under the reading size without hurting anything.
 */
const FILTER_PILL =
  "inline-flex shrink-0 min-h-11 items-center justify-center rounded-full px-3.5 text-sm font-semibold transition active:scale-95 md:px-4 md:text-base 2xl:min-h-touch 2xl:px-4 2xl:text-xl";

const CONTROL =
  "inline-flex min-h-11 items-center justify-center rounded-full px-3.5 text-sm font-semibold transition active:scale-95 md:min-h-touch md:px-5 md:text-lg 2xl:min-h-touch-lg 2xl:px-7 2xl:text-k-ui";

/**
 * Branding and the primary controls in one dark bar.
 *
 * The mode toggle and Start over live up here rather than in the page body
 * because the branding bar was mostly empty space while vertical room below is
 * the scarce resource — every pixel spent on chrome is a pixel the day columns
 * do not get.
 */
export function KioskTopBar({
  state,
  dispatch,
  base,
}: {
  state: KioskState;
  dispatch: (action: KioskAction) => void;
  base: string;
}) {
  const weekendActive = state.mode.kind === "weekend";

  return (
    <header className="shrink-0 bg-brand text-white shadow-md">
      {/* Wraps only on a phone, where the controls cannot fit beside the logo.
          At every width from a tablet up it stays a single row. */}
      <div className="mx-auto flex max-w-[1800px] items-center gap-x-2 px-3 py-2 md:gap-x-3 md:px-8 md:py-3 2xl:gap-x-5 2xl:px-12 2xl:py-4">
        <div className="flex shrink-0 items-center gap-2 md:gap-3 2xl:gap-4">
          <img
            src={`${base}bcs-logo-white.png`}
            alt=""
            className="h-7 w-auto md:h-11 2xl:h-14"
          />
          {/* The wordmark is the first thing to go when space is tight — the
              logo alone still identifies the shop to someone standing in it. */}
          <div className="hidden leading-tight md:block">
            <span className="block font-semibold md:text-lg 2xl:text-k-time">
              Birds Connect Seattle
            </span>
            <span className="block text-sage text-xs md:text-sm 2xl:text-k-meta">
              Upcoming Events
            </span>
          </div>
        </div>

        {/* Full-size nav targets rather than small text links. This is a touch
            screen, and a 12px link is not something anyone can hit reliably
            with a fingertip. */}
        <nav className="hidden shrink-0 items-center gap-1 lg:flex 2xl:gap-2">
          <a href={base} className={`${NAV_LINK}`}>
            Calendar
          </a>
          <a
            href="https://birdsconnectsea.org/"
            target="_blank"
            rel="noopener noreferrer"
            className={`${NAV_LINK}`}
          >
            BCS Website
          </a>
        </nav>

        <div className="flex-1" />

        {/* Both choices stay on screen with one filled in. A single button whose
            label flipped between the current mode and the other one left it
            ambiguous whether the label named the state or the action. */}
        <div
          role="radiogroup"
          aria-label="Which days to show"
          className="flex shrink-0 gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/20"
        >
          {MODES.map((mode) => {
            const active = weekendActive === (mode.id === "weekend");
            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => dispatch({ type: mode.action })}
                className={`${CONTROL} ${
                  active
                    ? "bg-pop text-brand shadow-sm"
                    : "bg-transparent text-sage hover:text-white"
                }`}
              >
                <span className="md:hidden">{mode.short}</span>
                <span className="hidden md:inline">{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Secondary to the toggle: a recovery action, not a destination. */}
        <button
          type="button"
          onClick={() => dispatch({ type: "reset" })}
          className={`${CONTROL} shrink-0 bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20`}
        >
          Start over
        </button>

      </div>
    </header>
  );
}

/** The event-kind filters, on their own row under the bar — eight pills will not
 *  fit alongside the branding at any width worth supporting. */
export function KioskFilterRow({
  state,
  dispatch,
}: {
  state: KioskState;
  dispatch: (action: KioskAction) => void;
}) {
  return (
    // Single-select, not multi-select: two simultaneously-active chips is a
    // state a passing visitor cannot reason about.
    //
    // Never wraps, at any width. A second row of pills costs the day columns
    // real height, and the wrap point moves every time a filter is added or
    // renamed. One scrolling line behaves the same everywhere and absorbs new
    // filters without reflowing the page.
    <div className="-mx-1 flex shrink-0 flex-nowrap gap-2 overflow-x-auto px-1 pb-1 2xl:gap-2.5">
      {KIOSK_FILTERS.map((filter) => {
        const active = state.filterId === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => dispatch({ type: "setFilter", id: filter.id })}
            aria-pressed={active}
            className={`${FILTER_PILL} ${
              active
                ? "bg-brand text-white"
                : "bg-white text-brand ring-1 ring-black/10"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
