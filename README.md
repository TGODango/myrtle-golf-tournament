# Myrtle Beach Golf Championship 2026

A mobile-first Next.js / TypeScript application with five preloaded rounds, all 18 matches in a separate illustrative demo, WHS handicap calculations, scorecards, leaderboard projections, TV view, roster management, captain drafts, tee times, course-card import, result overrides and audit history.

## Preview locally

Requires Node 22+ and npm. From this repository:

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Open http://localhost:3000 in your own local development environment. In Codex, use the port-3000 preview provided by your workspace when available. Demo mode works immediately and persists in browser localStorage; tabs on the same browser synchronize using storage events. **Demo mode is not cloud multiplayer, authentication, or an offline-first backend.** Demo scores, fictional golfers and illustrative tee data never seed the live tournament. Admin → Reset demonstration restores the sample tournament.

```sh
npm test
npm run typecheck
npm run build
# With the app running and Chromium installed:
npm run test:browser
```

## Connect a live tournament

1. Create a Supabase project. Execute `supabase/migrations/001_tournament.sql`, then `supabase/seed.sql` in its SQL editor. Seed creates a blank tournament with the official five-round schedule and no fictional players or course data.
2. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project's URL and publishable/anon key. These are public browser configuration; **never put a service-role key in a NEXT_PUBLIC variable**. Restart Next.js.
3. In Supabase Auth, configure Site URL and allowed redirect URLs for your deployment. Invite the administrator by email through Supabase's dashboard. Insert their membership in the SQL editor (trusted server operation):

```sql
insert into public.members(user_id,player_id,role)
values ('AUTH-USER-UUID','administrator','admin');
```

4. Click Connect live and sign in with the invited email. Add the 12 actual golfers in Admin, six per team and one captain each. Use the SQL editor to inspect their IDs: `select state->'players' from public.tournaments where id=1;`. Invite each player through Auth, then add a member row with their UUID, exact player ID and role `golfer` or `captain`. Admin membership may also use the admin golfer's actual ID if they are playing. Membership changes are trusted SQL operations, not public registration.
5. Enter dates, tee data, rating, slope and verified 18-hole JSON per round. Stroke indices must be a permutation of 1–18. No official scorecards are invented. Course handicaps recompute from the selected round's tee; per-player round overrides are optional.
6. Admin can nominate either team first. Captains save their own selection, then the opposing captain responds. Admin approves and locks all pairings. Singles match slots 1–2, 3–4, 5–6 share each scheduled foursome. Move complete matches between slots in Admin; edit unlocked pairings to change golfers.
7. Golfers sign in on their own phones and save gross hole scores. The client subscribes to the tournament table via Supabase Realtime and refetches state after updates. Configure the Supabase project with Realtime enabled; migration adds the table to its publication.

## Data integrity and security

All table writes are blocked by RLS; SECURITY DEFINER RPCs check authenticated membership and role. `submit_score` checks match participation, ownership (or administrator), approved pairings, verified course, score range and expected version. A transaction locks the tournament aggregate and updates only the submitted score. Unique request UUIDs make retries idempotent; duplicate IDs with different payloads fail. Different players' submissions merge, while concurrent changes to the same score reject stale versions. Admin settings updates use an aggregate revision and cannot write scores. Immutable database audit rows record changes independently of the UI audit list.

Pending live scores are retained in localStorage and retried when connectivity returns. A conflict leaves the pending score available and asks for explicit review before updating the expected version. Demo score conflicts use a localStorage version check; this is a convenience and is **not transactional cross-device storage**. Do not use demo for tournament results. Realtime connectivity and SQL integration must be validated against your Supabase project before the trip.

## Scoring

Course Handicap = round(Index × slope / 113 + rating − par), using floor(value + 0.5). Full CH applies to Stableford. Match-play strokes use CH minus the minimum CH across all participants. Allocations support >18 and plus handicaps. Best ball and default shamble use the lowest net partner score. Combined Stableford adds both players' points, with no early finish. Singles and match play stop when the lead exceeds holes remaining. Only completed/adjudicated matches award points; projections are separate. Reopening removes official points until resumed/finalized. The dashboard treats unplayed matches as unprojected, and tied active matches as projected halves.

Holes must be complete sequentially for live calculations. Golfers can continue recording scores after a match is decided; the match result remains calculated at the decisive hole. Optional combined-net shamble is an explicit admin override. Manual results award 1 total point, never add extra tournament points.

## Deployment and validation limits

Deploy to Vercel or another Node-capable host, set the public Supabase environment variables and Auth redirect URLs, then run `npm run build` / `npm start`. Use HTTPS for actual play. This first version uses plain responsive CSS rather than Tailwind. No production Supabase credentials are included. Automated scoring tests and embedded PostgreSQL integration tests validate authorization, stale revisions, idempotency, audit, captain responses, and foursome constraints. The browser smoke test checks score persistence, administration, schedule, TV mode, and mobile layout. Embedded PostgreSQL serializes concurrent test requests; production database concurrency, email authentication and cross-device subscriptions still require connected Supabase validation. Do not describe cloud multiplayer as tested until those checks pass.

The initial release has one selected tee per round, manually administered invitations, and a captain nomination/response workflow rather than an enforced rotating-turn draft. Admin can edit the five rounds, but adding/deleting official rounds is intentionally restricted to preserve the 18-point championship. A shamble drive-selection log is not included: golfers follow the chosen-drive rule on the course and submit their completed gross scores. Player removal is blocked while paired. Verify singles foursomes contain exactly two matches and team counts/captains before locking.
