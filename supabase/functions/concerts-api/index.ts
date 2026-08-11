import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

Deno.serve(async () => {
  const { data, error } = await supabase
    .from("concerts")
    .select(`
      id,
      external_id,
      artist,
      genre,
      city,
      state,
      venue,
      starts_at,
      price_from,
      currency,
      source,
      source_url
    `)
    .eq("status", "upcoming")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", {
      ascending: true
    });

  if (error) {
    return Response.json(
      {
        error: error.message
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }

  return Response.json(
    {
      events: data ?? [],
      lastUpdated: new Date().toISOString()
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    }
  );
});
