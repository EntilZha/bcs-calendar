// The active filter (selected facets + "saved only"), shared between the nav
// shortcuts island in the header and the calendar app — two separate React
// islands that can't share state directly. Not persisted: it's initialized
// from the URL on load (so a shortcut clicked on a detail page carries over to
// the home page) and mirrored back to the URL for shareable links.
import { useSyncExternalStore } from "react";

interface FilterState {
  facets: ReadonlySet<string>;
  savedOnly: boolean;
}

const EMPTY: FilterState = { facets: new Set(), savedOnly: false };

let facets = new Set<string>();
let savedOnly = false;
let snapshot: FilterState = EMPTY; // cached immutable snapshot for stability

const listeners = new Set<() => void>();
let initialized = false;

function rebuildSnapshot() {
  snapshot = { facets: new Set(facets), savedOnly };
}

function emit() {
  for (const l of listeners) l();
}

// Seed from the URL once, on the client. ?filter=<facetId> selects that facet;
// ?saved=1 turns on the saved-only view.
function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const params = new URLSearchParams(window.location.search);
  const filter = params.get("filter");
  if (filter) facets = new Set([filter]);
  if (params.get("saved") === "1") savedOnly = true;
  rebuildSnapshot();
}

// Reflect the current single-shortcut state in the URL without reloading, so
// the view is shareable/bookmarkable. Preserves any other params (e.g. ?view=).
function syncUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("filter");
  url.searchParams.delete("saved");
  if (savedOnly) url.searchParams.set("saved", "1");
  else if (facets.size === 1) url.searchParams.set("filter", [...facets][0]);
  window.history.replaceState(null, "", url);
}

function commit() {
  rebuildSnapshot();
  syncUrl();
  emit();
}

// ---- Shortcut setters (used by the nav) -----------------------------------

/** Select a single facet as the active filter (clears saved-only). */
export function setFacetShortcut(id: string): void {
  ensureInit();
  facets = new Set([id]);
  savedOnly = false;
  commit();
}

/** Show only saved events (clears facet selection). */
export function setSavedShortcut(): void {
  ensureInit();
  facets = new Set();
  savedOnly = true;
  commit();
}

/** "All" — clear every filter. */
export function clearAll(): void {
  ensureInit();
  facets = new Set();
  savedOnly = false;
  commit();
}

// ---- Fine-grained setters (used by the calendar's chip row) ---------------

/** Toggle one facet in the multi-select chip row. */
export function toggleFacet(id: string): void {
  ensureInit();
  const next = new Set(facets);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  facets = next;
  commit();
}

export function setSavedOnly(value: boolean): void {
  ensureInit();
  savedOnly = value;
  commit();
}

// ---- Hook -----------------------------------------------------------------

function subscribe(onChange: () => void): () => void {
  ensureInit();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
function getSnapshot(): FilterState {
  return snapshot;
}
function getServerSnapshot(): FilterState {
  return EMPTY;
}

export function useFilterState(): FilterState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
