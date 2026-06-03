// Client-side event bookmarks, persisted to localStorage. Shared across the
// separate React islands (calendar app, nav, detail page) through a tiny
// module-level store consumed via useSyncExternalStore — so a star toggled in
// one place updates everywhere, and survives reloads and cross-tab use.
import { useCallback, useSyncExternalStore } from "react";

const KEY = "bcs:bookmarks:v1";

// Canonical runtime state, plus a cached immutable snapshot so getSnapshot is
// referentially stable between renders (avoids useSyncExternalStore loops).
let ids = new Set<string>();
let snapshot: ReadonlySet<string> = new Set();
const EMPTY: ReadonlySet<string> = new Set(); // shared SSR/empty snapshot

const listeners = new Set<() => void>();
let loaded = false;
let detachStorage: (() => void) | null = null;

function safeRead(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    // Corrupt value, or storage disabled/unavailable — treat as empty.
    return [];
  }
}

function safeWrite() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // Quota exceeded / private mode — keep the in-memory state for this session.
  }
}

function rebuildSnapshot() {
  snapshot = new Set(ids); // new reference signals a change to React
}

function emit() {
  for (const l of listeners) l();
}

// Hydrate from localStorage on first use (client only). Idempotent.
function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  ids = new Set(safeRead());
  rebuildSnapshot();
}

function subscribe(onChange: () => void): () => void {
  ensureLoaded();
  listeners.add(onChange);
  // A `storage` event fires only in OTHER tabs; reload our set when it does.
  if (listeners.size === 1 && typeof window !== "undefined") {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      ids = new Set(safeRead());
      rebuildSnapshot();
      emit();
    };
    window.addEventListener("storage", onStorage);
    detachStorage = () => window.removeEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && detachStorage) {
      detachStorage();
      detachStorage = null;
    }
  };
}

// ---- Imperative API -------------------------------------------------------

export function isBookmarked(id: string): boolean {
  ensureLoaded();
  return ids.has(id);
}

export function toggleBookmark(id: string): void {
  ensureLoaded();
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  rebuildSnapshot();
  safeWrite();
  emit();
}

// ---- React hooks ----------------------------------------------------------

function getSetSnapshot(): ReadonlySet<string> {
  return snapshot;
}
function getServerSetSnapshot(): ReadonlySet<string> {
  return EMPTY;
}

/** The full set of bookmarked ids — used for the calendar filter and count. */
export function useBookmarkSet(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSetSnapshot, getServerSetSnapshot);
}

/** Whether a single event is bookmarked. Returns a boolean, so it's stable. */
export function useIsBookmarked(id: string): boolean {
  const getId = useCallback(() => ids.has(id), [id]);
  const getServerId = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getId, getServerId);
}
