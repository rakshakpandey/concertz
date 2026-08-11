import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from
  "npm:@supabase/supabase-js@2";

import {
  fetchBookMyShow
} from "./collectors/bookmyshow.ts";

import {
  fetchDistrict
} from "./collectors/district.ts";

import {
  fetchSkillBox
} from "./collectors/skillbox.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function collectAllEvents() {
  const results = await Promise.allSettled([
    fetchBookMyShow(),
    fetchDistrict(),
    fetchSkillBox()
  ]);

  const events = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      events.push(...result.value);
    } else {
      console.error(
        "Collector failed:",
        result.reason
      );
    }
  }

  return events;
}

Deno.serve(async (req) => {
  const secret =
    Deno.env.get("CONCERTZ_SYNC_SECRET");

  const auth =
    req.headers
      .get("authorization")
      ?.replace("Bearer ", "");

  if (!secret || auth !== secret) {
    return new Response(
      "Unauthorized",
      { status: 401 }
    );
  }

  const started =
    new Date().toISOString();

  const { data: run, error: runError } =
    await supabase
      .from("sync_runs")
      .insert({
        status: "running"
      })
      .select("id")
      .single();

  if (runError) {
    return Response.json(
      {
        ok: false,
        error: runError.message
      },
      { status: 500 }
    );
  }

  try {
    const events =
      await collectAllEvents();

    let inserted = 0;

    for (const event of events) {

      const { error } =
        await supabase
          .from("concerts")
          .upsert(
            {
              external_id:
                event.external_id,

              artist:
                event.artist,

              genre:
                event.genre || "Live Music",

              city:
                event.city || "",

              state:
                event.state || "",

              venue:
                event.venue || "Venue TBA",

              starts_at:
                event.starts_at,

              price_from:
                event.price_from,

              source:
                event.source,

              source_url:
                event.source_url,

              status:
                "upcoming",

              last_seen_at:
                new Date().toISOString(),

              updated_at:
                new Date().toISOString()
            },
            {
              onConflict:
                "source,external_id"
            }
          );

      if (error) {
        console.error(
          "Database error:",
          error
        );

        continue;
      }

      inserted++;
    }

    await supabase
      .from("concerts")
      .update({
        status: "review"
      })
      .lt(
        "last_seen_at",
        new Date(
          Date.now() -
          14 * 86400000
        ).toISOString()
      )
      .eq(
        "status",
        "upcoming"
      );

    await supabase
      .from("sync_runs")
      .update({
        finished_at:
          new Date().toISOString(),

        status:
          "success",

        source_count:
          events.length,

        event_count:
          inserted
      })
      .eq(
        "id",
        run.id
      );

    return Response.json({
      ok: true,
      collected: events.length,
      inserted,
      started
    });

  } catch (error) {

    await supabase
      .from("sync_runs")
      .update({
        finished_at:
          new Date().toISOString(),

        status:
          "error",

        error:
          String(error)
      })
      .eq(
        "id",
        run.id
      );

    return Response.json(
      {
        ok: false,
        error:
          String(error)
      },
      {
        status: 500
      }
    );
  }
});
