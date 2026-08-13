import { ScrapedEvent, fetchHtml, extractJsonLdEvents } from "../../_shared/extract.ts";

// BookMyShow actively blocks plain automated requests. This collector does
// NOT attempt to get around that protection in any way. If a request is
// blocked, it simply returns zero events for that city and logs why.

const CITY_SLUGS: Record<string, string> = {
  "Delhi": "delhi-ncr",
  "Mumbai": "mumbai",
  "Hyderabad": "hyderabad",
  "Bengaluru": "bengaluru",
  "Pune": "pune",
};

export async function collectBookMyShow(): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];

  for (const [cityLabel, slug] of Object.entries(CITY_SLUGS)) {
    const url = `https://in.bookmyshow.com/explore/events-${slug}`;
    const html = await fetchHtml(url);
    if (!html) {
      console.warn(`[BookMyShow] No usable response for ${cityLabel} (likely blocked).`);
      continue;
    }

    const raw = extractJsonLdEvents(html);
    if (raw.length === 0) {
      console.warn(`[BookMyShow] Page loaded for ${cityLabel} but no structured event data found.`);
    }

    for (const item of raw) {
      const name = item.name;
      const startsAt = item.startDate;
      if (!name || !startsAt) continue;

      let iso: string;
      try {
        iso = new Date(startsAt).toISOString();
      } catch {
        continue;
      }

      events.push({
        artist: name,
        genre: "Live Music",
        city: cityLabel,
        venue: item.location?.name ?? "Venue TBA",
        starts_at: iso,
        price_from: item.offers?.price ? Number(item.offers.price) : undefined,
        source: "BookMyShow",
        source_url: item.url ?? url,
      });
    }
  }

  return events;
}
