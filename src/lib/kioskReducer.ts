// State for the in-store display.
//
// Deliberately local to the kiosk island rather than the shared `filterStore`:
// that store mirrors itself into the URL and seeds only once per page load, so
// an idle reset firing every 90 seconds would rewrite the address bar forever
// and would have no way to express "my default is a non-empty filter". Reset
// here is also compound — filter, window, mode and open sheet all at once —
// which a reducer does atomically and four useStates cannot.
import { DEFAULT_KIOSK_FILTER_ID } from "../config/categories";

/** Which days the display is showing.
 *
 * There is no window offset any more: every upcoming day is rendered into one
 * horizontally-scrolling track, so "which days am I looking at" is the track's
 * scroll position — DOM state, owned by the browser, and swipeable for free.
 */
export type TimeMode =
  /** Every upcoming day that has events, nearest first. */
  | { kind: "upcoming" }
  /** The upcoming Saturday/Sunday, shown even when empty. */
  | { kind: "weekend" };

export interface KioskState {
  filterId: string;
  mode: TimeMode;
  /** Event id whose full-screen detail sheet is open. */
  openEventId: string | null;
}

export const initialKioskState: KioskState = {
  filterId: DEFAULT_KIOSK_FILTER_ID,
  mode: { kind: "upcoming" },
  openEventId: null,
};

export type KioskAction =
  | { type: "setFilter"; id: string }
  | { type: "showWeekend" }
  | { type: "showUpcoming" }
  | { type: "openEvent"; id: string }
  | { type: "closeEvent" }
  | { type: "reset" };

export function isDefaultState(state: KioskState): boolean {
  return (
    state.filterId === initialKioskState.filterId &&
    state.mode.kind === "upcoming" &&
    state.openEventId === null
  );
}

export function kioskReducer(
  state: KioskState,
  action: KioskAction,
): KioskState {
  switch (action.type) {
    case "setFilter":
      // Changing the filter changes which days have events at all, so a stale
      // offset would drop the visitor somewhere arbitrary months out.
      return {
        ...state,
        filterId: action.id,
        mode: { kind: "upcoming" },
        openEventId: null,
      };

    case "showWeekend":
      return { ...state, mode: { kind: "weekend" }, openEventId: null };

    case "showUpcoming":
      return { ...state, mode: { kind: "upcoming" }, openEventId: null };

    case "openEvent":
      return { ...state, openEventId: action.id };

    case "closeEvent":
      return { ...state, openEventId: null };

    case "reset":
      return initialKioskState;
  }
}
