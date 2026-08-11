
# Concertz Live

This project changes Concertz from a hard-coded HTML event list into a live-data application.

## Architecture

Website -> `/concerts-api` -> Supabase Postgres
                         ^
                         |
              nightly `/sync-concerts`
                         ^
                         |
                 authorized APIs/feeds

## What is automatic

- Database stores events.
- Frontend reads the database/API instead of a hard-coded event array.
- Supabase Cron invokes the sync function every night at 00:00 IST (18:30 UTC).
- Sync upserts new/changed events and marks stale records for review.
- Frontend can refresh without redeploying.

## What still needs configuration

The actual event-source adapters are intentionally left as a plug-in layer.
You need API keys or permission for each source you want to connect.

Do NOT put secret API keys in `index.html`.
Put them in Supabase Edge Function secrets.

Suggested first integrations:
1. Ticketmaster Discovery API (where India events are available).
2. Official/authorized feeds from event/ticketing partners.
3. Organizer-submitted feeds.
4. Other public APIs with terms that permit automated use.

Do not bypass CAPTCHA, authentication, robots restrictions, rate limits, or
anti-bot systems.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Deploy both Edge Functions.
4. Set:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - CONCERTZ_SYNC_SECRET
5. Configure the Cron job to call the sync function.
6. Add your authorized source adapters to `sync-concerts/index.ts`.
7. Point the frontend API URL to the deployed `concerts-api` function.

## Important timezone note

The included cron expression is `30 18 * * *`, which corresponds to 00:00 IST
when the scheduler is operating in UTC.
