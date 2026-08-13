export type ScrapedEvent = {
  external_id?: string;
  artist: string;
  genre?: string;
  city?: string;
  state?: string;
  venue?: string;
  starts_at: string;
  price_from?: number;
  source: string;
  source_url: string;
};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) {
      console.warn(`[fetchHtml] ${url} returned status ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[fetchHtml] ${url} failed: ${err}`);
    return null;
  }
}

export function extractJsonLdEvents(html: string): any[] {
  const results: any[] = [];
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of blocks) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const items = Array.isArray(parsed) ? parsed : (parsed["@graph"] ?? [parsed]);
      for (const item of items) {
        const type = item["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t: string) => typeof t === "string" && t.toLowerCase().includes("event"))) {
          results.push(item);
        }
      }
    } catch {
      // Not valid JSON-LD in this block, skip it.
    }
  }
  return results;
}

export function extractNextData(html: string): any | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

export function findEventLikeArrays(obj: any, depth = 0, out: any[] = []): any[] {
  if (depth > 8 || obj == null) return out;
  if (Array.isArray(obj)) {
    const looksLikeEvents = obj.length > 0 && obj.every((el: any) =>
      el && typeof el === "object" &&
      (el.title || el.name) &&
      (el.startDate || el.date || el.start_date || el.starts_at)
    );
    if (looksLikeEvents) {
      out.push(...obj);
    } else {
      for (const el of obj) findEventLikeArrays(el, depth + 1, out);
    }
  } else if (typeof obj === "object") {
    for (const key in obj) findEventLikeArrays(obj[key], depth + 1, out);
  }
  return out;
}
