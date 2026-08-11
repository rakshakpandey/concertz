
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

async function fetchConfiguredFeeds(): Promise<Event[]> {
  /*
    Add ONLY sources whose APIs/feeds you are authorized to use.
    Each adapter should normalize its response into the Event type.

    Example:
      const r = await fetch(Deno.env.get("TICKETMASTER_API_URL")!);
      ...
  */
  const events: Event[] = [];

  // TODO: Add authorized API/feed adapters here.
  // This deliberately does not bypass anti-bot systems or scrape sites
  // that prohibit automated access.

  return events;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CONCERTZ_SYNC_SECRET");
  const auth = req.headers.get("authorization")?.replace("Bearer ","");
  if (!secret || auth !== secret) {
    return new Response("Unauthorized", {status:401});
  }

  const started = new Date().toISOString();
  const { data: run } = await supabase
    .from("sync_runs")
    .insert({status:"running"})
    .select("id")
    .single();

  try {
    const events = await fetchConfiguredFeeds();

    for (const e of events) {
      const { error } = await supabase.from("concerts").upsert({
        external_id: e.external_id ?? `${e.source}:${e.artist}:${e.starts_at}:${e.venue}`,
        artist:e.artist, genre:e.genre ?? "Live Music", city:e.city ?? "",
        state:e.state ?? "", venue:e.venue ?? "Venue TBA",
        starts_at:e.starts_at, price_from:e.price_from ?? null,
        source:e.source, source_url:e.source_url,
        status:"upcoming", last_seen_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
      }, {onConflict:"source,external_id"});
      if (error) throw error;
    }

    // Events not seen for 14 days can be flagged for review rather than
    // immediately deleted, preventing accidental data loss.
    await supabase.from("concerts")
      .update({status:"review"})
      .lt("last_seen_at", new Date(Date.now()-14*86400000).toISOString())
      .eq("status","upcoming");

    await supabase.from("sync_runs").update({
      finished_at:new Date().toISOString(), status:"success",
      source_count:events.length, event_count:events.length
    }).eq("id",run?.id);

    return Response.json({ok:true,count:events.length,started});
  } catch (error) {
    await supabase.from("sync_runs").update({
      finished_at:new Date().toISOString(), status:"error",
      error:String(error)
    }).eq("id",run?.id);
    return Response.json({ok:false,error:String(error)},{status:500});
  }
});
