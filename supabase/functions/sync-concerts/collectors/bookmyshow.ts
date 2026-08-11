export type ConcertEvent = {
  external_id: string;
  artist: string;
  genre: string;
  city: string;
  state: string;
  venue: string;
  starts_at: string;
  price_from: number | null;
  source: string;
  source_url: string;
};

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
      // Ignore invalid JSON-LD blocks
    }
  }

  return results;
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const match = String(value).replace(/,/g, "").match(/\d+(\.\d+)?/);

  return match ? Number(match[0]) : null;
}

function normalizeEvent(data: any, url: string): ConcertEvent | null {
  const type = clean(data?.["@type"]);

  if (
    type !== "Event" &&
    type !== "MusicEvent" &&
    type !== "Festival"
  ) {
    return null;
  }

  const name = clean(data?.name);

  if (!name) return null;

  const location = data?.location || {};

  const address = location?.address || {};

  const startsAt = clean(
    data?.startDate || data?.startTime || ""
  );

  if (!startsAt) return null;

  const performer = Array.isArray(data?.performer)
    ? data.performer[0]
    : data?.performer;

  const artist =
    clean(performer?.name) ||
    name;

  const price =
    data?.offers?.price ??
    data?.offers?.lowPrice ??
    null;

  const venue =
    clean(location?.name) ||
    "Venue TBA";

  const city =
    clean(address?.addressLocality) ||
    "Delhi";

  const state =
    clean(address?.addressRegion) ||
    "Delhi";

  return {
    external_id: `bookmyshow:${url}`,
    artist,
    genre: "Live Music",
    city,
    state,
    venue,
    starts_at: startsAt,
    price_from: parsePrice(price),
    source: "BookMyShow",
    source_url: url
  };
}

export async function fetchBookMyShow(): Promise<ConcertEvent[]> {
  const listingUrl =
    "https://in.bookmyshow.com/explore/events-delhi-ncr";

  const response = await fetch(listingUrl, {
    headers: {
      "User-Agent":
        "Concertz/1.0 (+https://github.com/rakshakpandey/concertz)"
    }
  });

  if (!response.ok) {
    throw new Error(
      `BookMyShow returned HTTP ${response.status}`
    );
  }

  const html = await response.text();

  const jsonLd = extractJsonLd(html);

  const events: ConcertEvent[] = [];

  for (const item of jsonLd) {
    const event = normalizeEvent(item, listingUrl);

    if (event) {
      events.push(event);
    }
  }

  return events;
}
