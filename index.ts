
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

Deno.serve(async () => {
  const {data, error} = await supabase
    .from("concerts")
    .select("id,artist,genre,city,state,venue,starts_at,price_from,currency,source,source_url,status")
    .eq("status","upcoming")
    .gte("starts_at",new Date().toISOString())
    .order("starts_at",{ascending:true});

  if(error) return Response.json({error:error.message},{status:500});

  const events = (data ?? []).map(e => ({
    id:e.id,
    artist:e.artist,
    genre:e.genre,
    city:e.city,
    state:e.state,
    venue:e.venue,
    date:e.starts_at,
    price:Number(e.price_from ?? 0),
    source:e.source,
    url:e.source_url
  }));

  return new Response(JSON.stringify({
    events,
    lastUpdated:new Date().toISOString()
  }),{
    headers:{
      "Content-Type":"application/json",
      "Cache-Control":"no-store",
      "Access-Control-Allow-Origin":"*"
    }
  });
});
