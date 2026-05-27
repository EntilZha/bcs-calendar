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

/** The fields a custom rule can match against (a subset of an event). */
export interface TaggableEvent {
  categories: string[];
  title: string;
  description: string;
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

// ---------------------------------------------------------------------------
// 2. Manually-defined custom facets — add your own here
// ---------------------------------------------------------------------------

interface CustomFacet extends Facet {
  /** Return true if the event should carry this tag. */
  match: (ev: TaggableEvent) => boolean;
}

/** Case-insensitive keyword test over an event's title + description. */
function mentions(ev: TaggableEvent, keyword: string): boolean {
  return new RegExp(keyword, "i").test(`${ev.title} ${ev.description}`);
}

export const CUSTOM_FACETS: CustomFacet[] = [
  {
    id: "neighborhood-walks",
    label: "Neighborhood Walks",
    chip: "bg-yellow-100 text-yellow-900 ring-yellow-300",
    dot: "bg-yellow-500",
    // Neighborhood walks are tagged in Tockify as both a Bird Outing and a
    // Drop-in event.
    match: (ev) =>
      ev.categories.includes("Bird-Outing") &&
      ev.categories.includes("Drop-in"),
  },
  {
    id: "nextgen",
    label: "NextGen",
    chip: "bg-blue-100 text-blue-900 ring-blue-300",
    dot: "bg-blue-500",
    // The NextGen category, or any event that mentions "NextGen".
    match: (ev) => ev.categories.includes("NextGen") || mentions(ev, "NextGen"),
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
