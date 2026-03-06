# Express Backend Architect — Persistent Memory

See topic files for detailed notes. This file is loaded into every session prompt.

## Key Architectural Decisions

- **Notification pattern**: `enqueueNotification(userId, type, payload)` creates a DB record FIRST, then adds `{ notificationId }` to the BullMQ queue. The DB record is the retry-safety source of truth (`sent=false` until confirmed delivery). Workers never receive payload data directly — they fetch from DB. See `patterns.md`.
- **Prisma JSON fields**: Use `payload as Prisma.InputJsonObject` when writing `Record<string, unknown>` to Prisma `Json` columns. Raw assignment causes TS2322.
- **notificationsQueue job data**: Always `{ notificationId: string }` — never the full payload. This prevents stale data on retry.
- **MONITORING_PAUSED**: Triggered inside `spotifyClient()` on 401 refresh response. Calls `enqueueNotification` before throwing.
- **Email address logging**: Only at `debug` level — never `info/warn/error`. User displayName is safe at info; email is not.
- **Idempotency in sendNotificationEmail**: Always check `notification.sent` before sending — BullMQ retries can race on partial success.
- **Resend error handling**: Throw on `error` from `resend.emails.send()` so BullMQ retries fire. Never mark `sent=true` unless send succeeds.

## Pre-existing Issues (not Phase 5 regressions)

- `tsconfig.json` `rootDir: src` conflicts with `@spotttrack/shared` workspace import — TS6059 fires but runtime works fine (tsconfig-paths handles it).
- BullMQ bundles its own ioredis version — causes TS2322 `Redis not assignable to ConnectionOptions` in `queues.ts` and `workers.ts`. Runtime works because they're compatible at the JavaScript level.
- Both pre-existing issues were present before Phase 5 and are not regressions.

## Redis Key Conventions

- `lock:token-refresh:{userId}` — TTL 30s — prevents concurrent token refresh races
- `service:spotify:token` — Client Credentials token for watchlist sweep (Phase 6)

## BullMQ Queue Config

| Queue | Concurrency | Usage |
|---|---|---|
| `playlist-sweep` | 5 | One job per user, enqueued by scheduler |
| `notifications` | 10 | One job per notification record |
| `watchlist-sweep` | 10 | Phase 6 |

All queues: 3 attempts, exponential backoff from 5000ms. Defined in `queues.ts`.

## Phase 6 Watchlist Patterns

- **Service token**: `getServiceToken()` in `watchlist-sweep.job.ts` caches the Spotify Client Credentials token in Redis at key `service:spotify:token` with TTL = `expires_in - 60`. Checked before every sweep — no per-call auth overhead.
- **Watchlist sweep is global, not per-user**: One BullMQ job processes ALL unresolved entries. Client Credentials token is shared, so per-user jobs would be wasteful duplication.
- **Fuse.js search pattern**: Call `fuse.search(originalQuery)` against the 5 Spotify candidates. Score ≤ `FUSE_MATCH_THRESHOLD` (0.15) = match. Lower score = better.
- **429 aborts the batch**: Re-throw the 429 error from `runWatchlistSweep` so BullMQ retries the entire job with exponential backoff. Individual non-429 errors per entry are caught and logged but don't abort the sweep.
- **Ownership check in removeWatchlistEntry**: Fetch first, verify `entry.userId === userId`, then delete. Never use `deleteMany` for ownership-sensitive deletes — it silently succeeds even on wrong user.
- **Fuse.js not in package.json at Phase 5**: Must run `pnpm add fuse.js --filter api` before Phase 6 builds. `@types/fuse.js` not needed — fuse.js ships its own types.

## Phase 7 Hardening Patterns

- **429 handling in `client.get()`**: Single retry after `Retry-After` seconds (default 10, capped 60). On double-429, throws `Error('Spotify rate limited')` with `.retryAfter` property for BullMQ log context. The `get()` method is now `async`.
- **429 handling in token refresh**: Same pattern — `let response` (reassignable), retry once, throw `'Spotify token refresh rate limited'` on double-429. Applied before the 401/revoke check so order matters.
- **Notification dedup in `transitionState`**: Before `enqueueNotification`, queries `prisma.notification.findFirst` with `userId`, `type`, `createdAt >= 1 hour ago`, and `payload: { path: ['spotifyTrackId'], equals: ... }`. Logs debug and returns early if a duplicate exists.
- **`spotifyTrackId` in payload**: All three track notification types (TRACK_UNAVAILABLE, TRACK_REMOVED, TRACK_RETURNED) now include `spotifyTrackId` in their payload so the dedup filter can match. This is a non-breaking payload addition.
- **`transitionState` type**: Added `spotifyTrackId: string` to the track parameter type. Call sites pass the full `TrackedTrack` from Prisma which already includes this field — no call-site changes needed.

## Completed Phases

- Phase 1: Foundation (OAuth, crypto, DB, login page)
- Phase 2: Snapshot engine (spotifyClient, pagination, baseline)
- Phase 3: Sweep & diff (BullMQ, scheduler, state transitions)
- Phase 4: Playlist UI (dashboard, TrackRow, StateBadge)
- Phase 5: Notifications (Resend, 5 email templates, notification worker, route)
- Phase 6: Watchlist (CRUD service, watchlist-sweep job, Fuse.js, Client Credentials token, scheduler)
- Phase 7: Hardening (429 Retry-After handling, notification deduplication)

## File Locations

- `apps/api/src/services/notification.service.ts` — `enqueueNotification`, `sendNotificationEmail`, 5 templates
- `apps/api/src/jobs/notification.job.ts` — BullMQ processor, calls `sendNotificationEmail`
- `apps/api/src/jobs/workers.ts` — starts playlist + notification + watchlist workers
- `apps/api/src/routes/notifications.ts` — `GET /api/notifications` paginated
- `apps/api/src/jobs/playlist-sweep.job.ts` — calls `enqueueNotification` in `transitionState`
- `apps/api/src/services/spotify.service.ts` — calls `enqueueNotification` on token revoke 401
- `apps/api/src/services/watchlist.service.ts` — `addWatchlistEntry`, `removeWatchlistEntry`, `getWatchlistEntries`
- `apps/api/src/jobs/watchlist-sweep.job.ts` — `runWatchlistSweep`, `getServiceToken`, Fuse.js match
- `apps/api/src/routes/watchlist.ts` — GET/POST/DELETE /api/watchlist
