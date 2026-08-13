import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { collectBookMyShow } from "./collectors/bookmyshow.ts";
import { collectDistrict } from "./collectors/district.ts";
import { collectSkillBox } from "./collectors/skillbox.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type Event = {
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

async function fetchConfiguredFeeds(): Promise<{ events: Event[]; sourceCounts: Record<string, number> }> {
  const events: Event[] = [];
  const sourceCounts: Record<string, number> = {};

  const collectors: [string, () => Promise<Event[]>][] = [
    ["BookMyShow", collectBookMyShow],
    ["District", collectDistrict],
    ["SkillBox", collectSkillBox],
  ];

  for (const [name, collect] of collectors) {
    try {
      const result = await collect();
      sourceCounts[name] = result.length;
      events.push(...result);
    } catch (err) {
      console.error(`[${name}] collector threw an error:`, err);
      sourceCounts[name] = 0;
    }
  }

  return { events, sourceCounts };
}

Deno.serve(async (req) => {
  const expectedSecret = Deno.env.get("CONCERTZ_SYNC_SECRET");
  const suppliedSecret = req.headers.get("x-concertz-secret");

  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const started = new Date().toISOString();
  const { data: run } = await supabase
    .from("sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  try {
    const { events, sourceCounts } = await fetchConfiguredFeeds();

    for (const e of events) {
      const { error } = await supabase.from("concerts").upsert({
        external_id: e.external_id ?? `${e.source}:${e.artist}:${e.starts_at}:${e.venue}`,
        artist: e.artist, genre: e.genre ?? "Live Music", city: e.city ?? "",
        state: e.state ?? "", venue: e.venue ?? "Venue TBA",
        starts_at: e.starts_at, price_from: e.price_from ?? null,
        source: e.source, source_url: e.source_url,
        status: "upcoming", last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: "source,external_id" });
      if (error) throw error;
    }

    await supabase.from("concerts")
      .update({ status: "review" })
      .lt("last_seen_at", new Date(Date.now() - 14 * 86400000).toISOString())
      .eq("status", "upcoming");

    await supabase.from("sync_runs").update({
      finished_at: new Date().toISOString(), status: "success",
      source_count: Object.keys(sourceCounts).length, event_count: events.length
    }).eq("id", run?.id);

    return Response.json({ ok: true, count: events.length, sources: sourceCounts, started });
  } catch (error) {
    await supabase.from("sync_runs").update({
      finished_at: new Date().toISOString(), status: "error",
      error: String(error)
    }).eq("id", run?.id);
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
});
