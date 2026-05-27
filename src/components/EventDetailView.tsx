import { useEffect, useState } from "react";
import { type CalEvent, EventBody, eventImage } from "./eventUI";

// Standalone, full-page view of a single event (its own shareable URL).
export default function EventDetailView({ ev }: { ev: CalEvent }) {
  const img = eventImage(ev);
  const home = import.meta.env.BASE_URL;
  // Return to whichever view the visitor came from (?from=agenda|calendar),
  // with matching label. Computed in an effect so the client value applies
  // after hydration.
  const [back, setBack] = useState({
    href: `${home}?view=agenda`,
    label: "Back to agenda",
  });
  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("from");
    if (from === "calendar" || from === "month") {
      setBack({ href: `${home}?view=calendar`, label: "Back to calendar" });
    }
  }, [home]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:max-w-4xl">
      <a
        href={back.href}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-leaf"
      >
        ← {back.label}
      </a>
      <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {img && (
          <div className="flex justify-center bg-gray-100 p-3">
            <img
              src={img}
              alt=""
              className="max-h-[22rem] max-w-full object-contain"
            />
          </div>
        )}
        <div className="p-5 sm:p-6">
          <EventBody ev={ev} />
        </div>
      </article>
    </div>
  );
}
