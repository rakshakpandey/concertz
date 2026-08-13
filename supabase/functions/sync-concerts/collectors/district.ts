import { ScrapedEvent, fetchHtml, extractJsonLdEvents, extractNextData, findEventLikeArrays } from "../../_shared/extract.ts";

const CITY_SLUGS: Record<string, string> = {
  "Delhi": "delhi",
  "Gurugram": "gurgaon",
  "Noida": "noida",
  "Mumbai": "mumbai",
  "Hyderabad": "hyderabad",
  "Bengaluru": "bengaluru",
  "Pune": "pune",
  "Chennai": "chennai",
  "Chandigarh": "chandigarh",
  "Ahmedabad": "ahmedabad",
};

export async function collectDistrict(): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];

  for (const [cityLabel, slug] of Object.entries(CITY_SLUGS)) {
    const url = `https://www.district.in/events/music-in-${slug}-book-tickets`;
    const html = await fetchHtml(url);
    if (!html) continue;

    let raw: any[] = extractJsonLdEvents(html);
    if (raw.length === 0) {
      const nextData = extractNextData(html);
      if (nextData) raw = findEventLikeArrays(nextData);
    }

    for (const item of raw) {
      const name = item.name ?? item.title;
      const startsAt = item.startDate ?? item.date ?? item.start_date;
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
        source: "District",
        source_url: item.url ?? item.event_url ?? url,
      });
    }
  }

  return events;
}
