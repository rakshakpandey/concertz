import type { ConcertEvent } from "./bookmyshow.ts";

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonLd(html: string): any[] {
  const results: any[] = [];

  const regex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());

      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  }

  return results;
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const match = String(value)
    .replace(/,/g, "")
    .match(/\d+(\.\d+)?/);

  return match ? Number(match[0]) : null;
}

export async function fetchDistrict(): Promise<ConcertEvent[]> {
  const listingUrl =
    "https://www.district.in/events/music-in-delhi-ncr-book-tickets";

  const response = await fetch(listingUrl, {
    headers: {
      "User-Agent":
        "Concertz/1.0 (+https://github.com/rakshakpandey/concertz)"
    }
  });

  if (!response.ok) {
    throw new Error(
      `District returned HTTP ${response.status}`
    );
  }

  const html = await response.text();

  const jsonLd = extractJsonLd(html);

  const events: ConcertEvent[] = [];

  for (const item of jsonLd) {
    const type = clean(item?.["@type"]);

    if (
      type !== "Event" &&
      type !== "MusicEvent" &&
      type !== "Festival"
    ) {
      continue;
    }

    const name = clean(item?.name);

    if (!name) continue;

    const location = item?.location || {};
    const address = location?.address || {};

    const startsAt = clean(item?.startDate);

    if (!startsAt) continue;

    const performer = Array.isArray(item?.performer)
      ? item.performer[0]
      : item?.performer;

    events.push({
      external_id: `district:${name}:${startsAt}`,
      artist:
        clean(performer?.name) ||
        name,
      genre: "Live Music",
      city:
        clean(address?.addressLocality) ||
        "Delhi",
      state:
        clean(address?.addressRegion) ||
        "Delhi",
      venue:
        clean(location?.name) ||
        "Venue TBA",
      starts_at: startsAt,
      price_from: parsePrice(
        item?.offers?.price ??
        item?.offers?.lowPrice
      ),
      source: "District",
      source_url:
        clean(item?.url) ||
        listingUrl
    });
  }

  return events;
}
