// Turns each event into a set of user-facing "tags" (facets) for the filter UI.
//
// There are two kinds of facets:
//
//   1. TAG_FACETS  — derived from Tockify's raw CATEGORIES tags (see
//      src/data/meta.json -> rawCategories). An event belongs to one if it
//      carries any of that facet's `tags`.
//
//   2. CUSTOM_FACETS — manually defined below with a `match()` rule. Use these
//      to add your own tags based on anything about an event: a combination of
//      raw categories, a keyword in the title/description, the location, etc.
//      This is the place to hand-curate tags.

export interface Facet {
  id: string;
  label: string;
  /** Tailwind classes for the facet chip. */
  chip: string;
  dot: string;
}

/** The fields a custom rule can match against (a subset of an event).
 *
 * `location` and the registration fields are optional so that every existing
 * caller — all of which pass a full `CalEvent` — keeps compiling, while rules
 * that need a venue or a registration signal can still ask for one.
 */
export interface TaggableEvent {
  categories: string[];
  title: string;
  description: string;
  location?: string;
  /** Tri-state, derived by the crawler: null means the feed is silent. */
  registrationRequired?: boolean | null;
}

// ---------------------------------------------------------------------------
// 1. Facets derived from raw Tockify category tags
// ---------------------------------------------------------------------------

interface TagFacet extends Facet {
  /** Raw Tockify tags that map into this facet. */
  tags: string[];
}

export const TAG_FACETS: TagFacet[] = [
  {
    id: "bird-outings",
    label: "Bird Outings",
    tags: ["Bird-Outing"],
    chip: "bg-emerald-100 text-emerald-900 ring-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    id: "field-trips",
    label: "Field Trips",
    tags: ["Field-Trips"],
    chip: "bg-teal-100 text-teal-900 ring-teal-300",
    dot: "bg-teal-500",
  },
  {
    id: "classes",
    label: "Classes",
    tags: ["Classes", "Bird-University", "Education", "New-Nest"],
    chip: "bg-sky-100 text-sky-900 ring-sky-300",
    dot: "bg-sky-500",
  },
  {
    id: "talks",
    label: "Talks & Lectures",
    tags: ["Lecture", "Speaker-Series"],
    chip: "bg-indigo-100 text-indigo-900 ring-indigo-300",
    dot: "bg-indigo-500",
  },
  {
    id: "drop-in",
    label: "Drop-in",
    tags: ["Drop-in"],
    chip: "bg-lime-100 text-lime-900 ring-lime-300",
    dot: "bg-lime-500",
  },
  {
    id: "youth-family",
    label: "Youth & Family",
    // NextGen is broken out into its own custom facet below.
    tags: ["Youth", "Children"],
    chip: "bg-amber-100 text-amber-900 ring-amber-300",
    dot: "bg-amber-500",
  },
  {
    id: "volunteer",
    label: "Volunteer & Science",
    tags: ["Volunteer", "Volunteer-Training", "Science"],
    chip: "bg-cyan-100 text-cyan-900 ring-cyan-300",
    dot: "bg-cyan-500",
  },
  {
    id: "conservation",
    label: "Conservation",
    tags: ["Conservation"],
    chip: "bg-green-100 text-green-900 ring-green-300",
    dot: "bg-green-600",
  },
  {
    id: "art-exhibits",
    label: "Art & Exhibits",
    tags: ["Art", "Exhibit"],
    chip: "bg-rose-100 text-rose-900 ring-rose-300",
    dot: "bg-rose-500",
  },
  {
    id: "fundraisers",
    label: "Fundraisers",
    tags: ["Fund-Our-Mission", "Birdathon"],
    chip: "bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-300",
    dot: "bg-fuchsia-500",
  },
  {
    id: "shop",
    label: "Shop & Books",
    tags: ["Retail", "Optics", "Book"],
    chip: "bg-orange-100 text-orange-900 ring-orange-300",
    dot: "bg-orange-500",
  },
  {
    id: "members",
    label: "Members",
    tags: ["Member-Event"],
    chip: "bg-violet-100 text-violet-900 ring-violet-300",
    dot: "bg-violet-500",
  },
];

/** Case-insensitive keyword test over an event's title + description. */
function mentions(ev: TaggableEvent, keyword: string): boolean {
  return new RegExp(keyword, "i").test(`${ev.title} ${ev.description}`);
}

// ---------------------------------------------------------------------------
// Event kind predicates
//
// These answer "what sort of thing is this?" independently of the chip UI, so
// both the calendar's facets and the in-store display can share one definition.
// They exist because Tockify's tags alone are not trustworthy enough — see the
// individual notes.
// ---------------------------------------------------------------------------

/** Title-anchored, and tolerant of a "**Rescheduled**" prefix and the
 *  "Children's" variant. Needed because 6 Neighborhood Bird Outings are missing
 *  the `Drop-in` tag in the feed even though they are drop-in walks. */
const NBO_TITLE_RE =
  /^\s*(?:\*+[^*]*\*+\s*)?(?:children'?s\s+)?neighborhood\s+bird\s+outing\b/i;

export function isNeighborhoodOuting(ev: TaggableEvent): boolean {
  return NBO_TITLE_RE.test(ev.title);
}

export function isDropIn(ev: TaggableEvent): boolean {
  return ev.categories.includes("Drop-in") || isNeighborhoodOuting(ev);
}

export function isFieldTrip(ev: TaggableEvent): boolean {
  return ev.categories.includes("Field-Trips");
}

/** Online-ness only ever appears in the title, never in the tags. Test for
 *  "in-person" FIRST: "In-Person Class: Mobile Sketching..." would otherwise
 *  fall through to a title that happens to mention online sessions. */
export function isOnline(ev: TaggableEvent): boolean {
  if (/\bin-?person\b/i.test(ev.title)) return false;
  if (ev.categories.includes("Bird-University")) return true;
  return /\bonline\b/i.test(ev.title);
}

/** At 616 Olive Wy. Tag-first, because several headquarters events ship with an
 *  empty `location`. */
export function isInStore(ev: TaggableEvent): boolean {
  return (
    ev.categories.includes("HQ") ||
    ev.categories.includes("at-BCS-Headquarters") ||
    /616\s+Olive/i.test(ev.location ?? "")
  );
}

/** The NextGen council runs events aimed at young adults (one title scopes it
 *  as "<40"). Emphatically NOT a children's programme — these are often held in
 *  taprooms — so it must never be folded in with Kids & Teens. */
export function isNextGen(ev: TaggableEvent): boolean {
  return ev.categories.includes("NextGen") || mentions(ev, "NextGen");
}

/** Run with someone else — a brewery, a charter boat, another non-profit.
 *  Still worth telling a visitor about; just not a BCS-run event. */
export function isPartner(ev: TaggableEvent): boolean {
  return ev.categories.includes("Partner");
}

/**
 * Already full, so pointing a visitor at it would waste their time.
 *
 * Matches only an actual statement of fact ("This trip is at capacity"), never
 * the conditional boilerplate — the Wingspan nights say "if the event is full,
 * please signup for the waitlist", which is a contingency, not a closure.
 * Likewise a bare mention of "waitlist" means nothing on its own.
 */
const AT_CAPACITY_RE = /\bat capacity\b/i;

export function isAtCapacity(ev: TaggableEvent): boolean {
  return AT_CAPACITY_RE.test(ev.description ?? "");
}

/**
 * A taught course you enrol in, not an event you attend.
 *
 * Three of the four `Classes` series run across several dates (Bird by Ear over
 * three evenings, Shorebirds over four), so each row is one session of a course
 * someone signed up for weeks ago. Turning up to session two is not a thing a
 * visitor can do. Contrast the Lunch and Learn, which also repeats 19 times but
 * where every instance stands alone — that is why this keys on the tag rather
 * than on whether the series repeats.
 */
export function isCourse(ev: TaggableEvent): boolean {
  return ev.categories.includes("Classes");
}

export function isMembersOnly(ev: TaggableEvent): boolean {
  return ev.categories.includes("Member-Event");
}

/**
 * The in-store display's default: anything a visitor could still get to.
 *
 * Framed as exclusions rather than as a list of blessed categories, because the
 * question a visitor is really asking is "can I go to this?", not "what type of
 * event is this?". A field trip with places left is a perfectly good answer to
 * give someone at the counter; the same trip once it is full is not.
 *
 * Out: anything already at capacity, multi-session courses, anything online
 * (you do not attend it from the shop), and members-only events. Everything
 * else — including partner events and field trips with room — is in. All of it
 * stays one tap away under "Everything"; this is a default, not a restriction.
 */
export function isJoinable(ev: TaggableEvent): boolean {
  return (
    !isAtCapacity(ev) && !isCourse(ev) && !isOnline(ev) && !isMembersOnly(ev)
  );
}

// ---------------------------------------------------------------------------
// 2. Manually-defined custom facets — add your own here
// ---------------------------------------------------------------------------

interface CustomFacet extends Facet {
  /** Return true if the event should carry this tag. */
  match: (ev: TaggableEvent) => boolean;
}

export const CUSTOM_FACETS: CustomFacet[] = [
  {
    id: "neighborhood-walks",
    label: "Neighborhood Walks",
    chip: "bg-yellow-100 text-yellow-900 ring-yellow-300",
    dot: "bg-yellow-500",
    // Usually tagged in Tockify as both a Bird Outing and a Drop-in event, but
    // 6 of them are missing the Drop-in tag, so trust the title as well.
    match: (ev) =>
      isNeighborhoodOuting(ev) ||
      (ev.categories.includes("Bird-Outing") &&
        ev.categories.includes("Drop-in")),
  },
  {
    id: "in-store",
    label: "At the Store",
    chip: "bg-stone-200 text-stone-900 ring-stone-400",
    dot: "bg-stone-600",
    // The HQ / at-BCS-Headquarters tags map to no facet otherwise, so there was
    // previously no way to filter down to "things happening at 616 Olive".
    match: isInStore,
  },
  {
    id: "nextgen",
    label: "NextGen",
    chip: "bg-blue-100 text-blue-900 ring-blue-300",
    dot: "bg-blue-500",
    // The NextGen category, or any event that mentions "NextGen".
    match: isNextGen,
  },
];

// ---------------------------------------------------------------------------
// Combined lookups used by the UI
// ---------------------------------------------------------------------------

export const FACETS: Facet[] = [...TAG_FACETS, ...CUSTOM_FACETS];

const TAG_TO_FACET: Record<string, TagFacet> = {};
for (const facet of TAG_FACETS) {
  for (const tag of facet.tags) TAG_TO_FACET[tag] = facet;
}

/** Facet ids an event belongs to: tag-derived plus any custom-rule matches. */
export function facetIdsForEvent(ev: TaggableEvent): string[] {
  const ids = new Set<string>();
  for (const tag of ev.categories) {
    const facet = TAG_TO_FACET[tag];
    if (facet) ids.add(facet.id);
  }
  for (const facet of CUSTOM_FACETS) {
    if (facet.match(ev)) ids.add(facet.id);
  }
  return [...ids];
}

export const FACET_BY_ID: Record<string, Facet> = Object.fromEntries(
  FACETS.map((f) => [f.id, f]),
);

// ---------------------------------------------------------------------------
// In-store display filters
//
// A separate, shorter list from FACETS: these are single-select and sized for a
// wall screen, so the vocabulary has to be blunt and the labels short. "Walk In"
// is the default and "Everything" is the escape hatch to the full calendar.
// ---------------------------------------------------------------------------

export interface KioskFilter {
  id: string;
  /** Keep these to one or two words — they render as 64px-tall pills. */
  label: string;
  match: (ev: TaggableEvent) => boolean;
}

export const KIOSK_FILTERS: KioskFilter[] = [
  { id: "open", label: "Still Open", match: isJoinable },
  { id: "instore", label: "At the Store", match: isInStore },
  {
    id: "outings",
    label: "Bird Outings",
    match: (ev) => ev.categories.includes("Bird-Outing"),
  },
  {
    id: "youth",
    label: "Kids & Teens",
    // Children and Youth only. NextGen is a young-adult programme and gets its
    // own filter below — a visitor looking for something to bring a child to
    // must not be shown a game night in a brewery.
    match: (ev) =>
      ["Children", "Youth"].some((t) => ev.categories.includes(t)),
  },
  { id: "nextgen", label: "Young Adults", match: isNextGen },
  {
    id: "classes",
    label: "Classes",
    match: (ev) => ev.categories.includes("Classes"),
  },
  { id: "trips", label: "Field Trips", match: isFieldTrip },
  { id: "partner", label: "With Partners", match: isPartner },
  { id: "all", label: "Everything", match: () => true },
];

export const DEFAULT_KIOSK_FILTER_ID = "open";
