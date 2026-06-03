// Header filter shortcuts. Lives in the (server-rendered) Layout but hydrates
// as its own island, sharing filter state with the calendar through
// filterStore. On the home page it filters instantly (no reload); on other
// pages each link navigates home with the matching ?filter=/?saved=1 param.
import { useBookmarkSet } from "../lib/bookmarks";
import {
  clearAll,
  setFacetShortcut,
  setSavedShortcut,
  useFilterState,
} from "../lib/filterStore";

type Shortcut =
  | { kind: "all" }
  | { kind: "facet"; id: string; label: string }
  | { kind: "saved" };

const SHORTCUTS: Shortcut[] = [
  { kind: "all" },
  { kind: "facet", id: "neighborhood-walks", label: "NBO" },
  { kind: "facet", id: "field-trips", label: "Field Trips" },
  { kind: "facet", id: "nextgen", label: "NextGen" },
  { kind: "saved" },
];

const base = import.meta.env.BASE_URL;

function hrefFor(s: Shortcut): string {
  if (s.kind === "facet") return `${base}?filter=${s.id}`;
  if (s.kind === "saved") return `${base}?saved=1`;
  return base;
}

// True when the browser is on the home page, so a click can filter in place
// instead of navigating. Tolerates a missing/extra trailing slash.
function onHomePage(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.replace(/\/$/, "");
  return path === base.replace(/\/$/, "");
}

export default function NavShortcuts() {
  const { facets, savedOnly } = useFilterState();
  const savedIds = useBookmarkSet();

  const isActive = (s: Shortcut): boolean => {
    if (s.kind === "all") return facets.size === 0 && !savedOnly;
    if (s.kind === "saved") return savedOnly;
    return !savedOnly && facets.size === 1 && facets.has(s.id);
  };

  const apply = (s: Shortcut) => {
    if (s.kind === "facet") setFacetShortcut(s.id);
    else if (s.kind === "saved") setSavedShortcut();
    else clearAll();
  };

  const labelFor = (s: Shortcut): string => {
    if (s.kind === "all") return "All";
    if (s.kind === "saved") return `Saved (${savedIds.size})`;
    return s.label;
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {SHORTCUTS.map((s) => {
        const active = isActive(s);
        return (
          <a
            key={s.kind === "facet" ? `facet:${s.id}` : s.kind}
            href={hrefFor(s)}
            aria-current={active ? "page" : undefined}
            onClick={(e) => {
              // Filter in place when already home; otherwise let the link
              // navigate to the home page carrying the filter param.
              if (onHomePage()) {
                e.preventDefault();
                apply(s);
              }
            }}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition ${
              active
                ? "bg-pop text-brand font-semibold"
                : "text-sage hover:bg-white/10 hover:text-white"
            }`}
          >
            {labelFor(s)}
          </a>
        );
      })}
    </div>
  );
}
