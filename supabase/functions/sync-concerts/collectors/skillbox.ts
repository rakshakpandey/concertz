import { ScrapedEvent, fetchHtml, extractJsonLdEvents, extractNextData, findEventLikeArrays } from "../../_shared/extract.ts";

// SkillBox's event listings are rendered client-side via JavaScript, so a
// plain fetch mostly sees an empty page shell. This checks common structured
// data patterns anyway in case that changes, but expect 0 results for now.

const CITY_SLUGS: Record<string, string> = {
  "Delhi": "new-delhi",
  "Mumbai": "mumbai",
  "Hyderabad": "hyderabad",
  "Bengaluru": "bengaluru",
  "Pune": "pune",
};

export async function collectSkillBox(): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];

  for (const [cityLabel, slug] of Object.entries(CITY_SLUGS)) {
    const url = `https://www.skillboxes.com/events-${slug}`;
    const html = await fetchHtml(url);
    if (!html) continue;

    let raw: any[] = extractJsonLdEvents(html);
    if (raw.length === 0) {
      const nextData = extractNextData(html);
      if (nextData) raw = findEventLikeArrays(nextData);
    }

    if (raw.length === 0) {
      console.warn(`[SkillBox] No structured data found for ${cityLabel} (likely client-rendered).`);
    }

    for (const item of raw) {
      const name = item.name ?? item.title;
      const startsAt = item.startDate ?? item.date;
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
        venue: item.location?.name ?? item.venue ?? "Venue TBA",
        starts_at: iso,
        price_from: item.offers?.price ? Number(item.offers.price) : undefined,
        source: "SkillBox",
        source_url: item.url ?? url,
      });
    }
  }

  return events;
}
