import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const { data, error } = await supabase
    .from("concerts")
    .select("*")
    .eq("status", "upcoming")
    .order("starts_at", { ascending: true });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
  }

  return Response.json(
    { events: data, lastUpdated: new Date().toISOString() },
    { headers: CORS_HEADERS }
  );
});
