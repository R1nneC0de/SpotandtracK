# CLAUDE.md — Spot tracK

Single source of truth. Read fully before writing any code or making architectural decisions.

---

## Project Overview

**Name:** Spot tracK
**Purpose:** Web app that monitors Spotify playlists and notifies users when songs become unavailable, are removed, or return. Users can also watch for songs not yet on Spotify.
**Core mechanism:** Snapshot-and-diff polling. Spotify has no webhooks — all change detection is pull-based.

---

## Monorepo Structure

```
spotifywatch/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Node.js/Express backend
├── packages/
│   └── shared/       # Shared TS types, constants, Zod schemas
├── docker-compose.yml
├── CLAUDE.md
└── package.json      # pnpm workspaces — never use npm or yarn
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend runtime | Node.js 20+, TypeScript strict |
| Backend framework | Express + async error middleware |
| ORM | Prisma + PostgreSQL 15+ |
| Job queue | BullMQ + Redis 7+ |
| Auth | Spotify OAuth 2.0 Authorization Code Flow |
| Email | Resend SDK |
| Fuzzy match | Fuse.js |
| Validation | Zod everywhere |
| Logging | Pino |
| Frontend | Next.js 14+ App Router, TypeScript strict |
| Styling | Tailwind CSS utility-only |
| Server state | TanStack Query |
| Session | NextAuth.js or iron-session |
| Icons | Lucide React |
| Font | Orbitron (Google Fonts) via `next/font/google` for all headings/logo; system mono for body |
| Theme | next-themes (light default, dark supported) |
| Frontend host | Vercel |
| Backend host | Railway or Render |

---

## Database Schema

Managed by Prisma. Use `prisma migrate dev` only — never edit DB directly.

```prisma
model User {
  id               String   @id @default(cuid())
  spotifyId        String   @unique
  email            String   @unique
  displayName      String
  accessToken      String   // AES-256-GCM encrypted
  refreshToken     String   // AES-256-GCM encrypted
  tokenExpiresAt   DateTime
  monitoringPaused Boolean  @default(false)
  pauseReason      String?  // "token_revoked"
  notificationMode String   @default("instant") // "instant" | "daily_digest" — Phase 8 only
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  playlists        TrackedPlaylist[]
  watchlistEntries WatchlistEntry[]
  notifications    Notification[]
}

model TrackedPlaylist {
  id            String    @id @default(cuid())
  userId        String
  spotifyId     String
  name          String
  coverImageUrl String?   // populated on first snapshot; shown in Phase 8
  isTracked     Boolean   @default(true)
  lastSweptAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tracks        TrackedTrack[]
  @@unique([userId, spotifyId])
}

model TrackedTrack {
  id                String     @id @default(cuid())
  playlistId        String
  spotifyTrackId    String
  name              String
  artistName        String
  albumName         String
  state             TrackState @default(AVAILABLE)
  consecutiveMisses Int        @default(0) // transitions to REMOVED after 2 missed sweeps
  stateChangedAt    DateTime   @default(now())
  firstSeenAt       DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  playlist          TrackedPlaylist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  stateHistory      TrackStateHistory[]
  @@unique([playlistId, spotifyTrackId])
}

model TrackStateHistory {
  id         String     @id @default(cuid())
  trackId    String
  fromState  TrackState
  toState    TrackState
  reason     String?    // "market", "product", "explicit", "fully_removed"
  detectedAt DateTime   @default(now())
  track      TrackedTrack @relation(fields: [trackId], references: [id], onDelete: Cascade)
}

model WatchlistEntry {
  id              String    @id @default(cuid())
  userId          String
  rawQuery        String
  artistHint      String?
  titleHint       String?
  resolved        Boolean   @default(false)
  resolvedTrackId String?
  createdAt       DateTime  @default(now())
  lastCheckedAt   DateTime?
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  payload   Json
  sent      Boolean          @default(false)
  sentAt    DateTime?
  createdAt DateTime         @default(now())
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum TrackState { AVAILABLE  UNAVAILABLE  REMOVED }
enum NotificationType { TRACK_UNAVAILABLE  TRACK_REMOVED  TRACK_RETURNED  WATCHLIST_MATCH }
```

---

## Auth & Token Management

**OAuth scopes:** `playlist-read-private`, `playlist-read-collaborative`, `user-read-email`

**Flow:** Connect Spotify → `/api/auth/spotify` → Spotify OAuth → `/api/auth/spotify/callback` → encrypt + store tokens → set httpOnly session cookie.

**Token encryption:** AES-256-GCM via `node:crypto` only. Store as `iv:encryptedHex`. Key = `TOKEN_ENCRYPTION_KEY` env (32-byte hex). Never log tokens. Interface: `encrypt(plaintext): string` / `decrypt(ciphertext): string` in `lib/crypto.ts`.

**`spotifyClient(userId)` — every Spotify call must go through this:**
1. Fetch + decrypt tokens from DB.
2. If `tokenExpiresAt` within 5 min: acquire Redis lock `lock:token-refresh:{userId}` (TTL 30s) to prevent race conditions, then refresh via Spotify token endpoint, update DB.
3. If refresh returns 401: set `monitoringPaused=true`, `pauseReason="token_revoked"`, enqueue reconnect email.
4. Return pre-authorized fetch/axios instance.

---

## Sweep System

### Playlist Sweep
**Queue:** `playlist-sweep` | **Cadence:** 12h per user
**Scheduler:** Master job runs hourly, enqueues users where `lastSweptAt` is null or >12h ago.

**Job steps:**
1. Skip if `monitoringPaused`.
2. For each `isTracked=true` playlist: paginate all tracks via `GET /v1/playlists/{id}/tracks?market=from_token&limit=100`. Add 200ms delay between playlist fetches.
3. Build map `spotifyTrackId → { is_playable, restrictions }`.
4. Diff against DB tracks:
   - Found + `is_playable: true` → `AVAILABLE`, reset `consecutiveMisses=0`
   - Found + `is_playable: false` → `UNAVAILABLE`, log `restrictions.reason`
   - Not found → increment `consecutiveMisses`; if ≥2 → `REMOVED`
5. On any state change: update `TrackedTrack`, insert `TrackStateHistory`, enqueue notification.
6. New tracks not in DB: insert as `AVAILABLE`, no notification.
7. Update `lastSweptAt`.

### Watchlist Sweep
**Queue:** `watchlist-sweep` | **Cadence:** 24h
**Token:** Service-level Client Credentials (not user OAuth). Cache in Redis `service:spotify:token`.
**Steps:** Batch 50 unresolved entries → Spotify Search API → Fuse.js match → if score clears threshold, mark `resolved`, store `resolvedTrackId`, enqueue `WATCHLIST_MATCH`.

**Fuse.js config:**
```typescript
{ keys: [{ name: 'artists.0.name', weight: 0.5 }, { name: 'name', weight: 0.5 }],
  threshold: 0.15, includeScore: true, ignoreLocation: true }
// 0.15 ≈ 85% similarity. Start at 0.10 (strict), loosen if too many false negatives.
```

**BullMQ config:** Concurrency 5 (playlist) / 10 (watchlist). Attempts: 3. Backoff: exponential from 5000ms. On 429: read `Retry-After` header.

---

## API Routes

All prefixed `/api`. Zod on all inputs. `requireAuth` middleware on authenticated routes.

```
GET  /api/auth/spotify                 → redirect to Spotify OAuth
GET  /api/auth/spotify/callback        → handle callback, set session
POST /api/auth/logout                  → clear session
GET  /api/auth/me                      → current user (no tokens)

GET  /api/playlists                    → user's Spotify playlists (live fetch)
GET  /api/playlists/tracked            → tracked playlists + track states
POST /api/playlists/:spotifyId/track   → start tracking
DEL  /api/playlists/:spotifyId/track   → stop tracking
GET  /api/playlists/:spotifyId/tracks  → tracks + states for one playlist

GET  /api/watchlist                    → list entries
POST /api/watchlist                    → add { rawQuery, artistHint?, titleHint? }
DEL  /api/watchlist/:id                → remove entry

GET  /api/notifications                → recent notifications (paginated)
GET  /api/health                       → { status: "ok", timestamp }
```

---

## Notifications

**Provider:** Resend. Always sent inside a BullMQ job — never inline in request handlers.
**Queue:** `notifications`. On 3-retry failure: log error, leave `sent=false`.

| Type | Subject line |
|---|---|
| TRACK_UNAVAILABLE | "A song in [Playlist] is no longer available" |
| TRACK_REMOVED | "A song was removed from Spotify" |
| TRACK_RETURNED | "[Track] is available again on Spotify" |
| WATCHLIST_MATCH | "A song you were watching just appeared on Spotify" |
| MONITORING_PAUSED | "Spot tracK: Your monitoring has been paused" |

All emails include: track name, artist, playlist name, detected date, link to app.

---

## Frontend Design System

**Visual language:** Dark neon tech. Magenta backgrounds, Spotify-green accents, Orbitron headings, rounded cards, single-column mobile-first (`max-w-sm mx-auto`).

### Color Tokens

Extend in `tailwind.config.ts` under `theme.extend.colors`. Never hardcode hex in components.

| Token | Hex / Value | Usage |
|---|---|---|
| `brand-magenta` | `#CC00CC` | Light mode page background |
| `brand-green` | `#1DB954` | CTAs, active states, section headers |
| `brand-cyan` | `#7FDBFF` | Playlist tile backgrounds |
| `surface-card` | `rgba(204,0,204,0.10)` | Card backgrounds |
| `surface-cardBorder` | `rgba(204,0,204,0.40)` | Card borders |
| `surface-dark` | `#0D0D0D` | Dark mode page background |
| `surface-darkCard` | `#1A001A` | Dark mode card background |
| `text-alert` | `#FF4444` | Warning text (e.g. "temporarily unplayable") |
| `text-alertBg` | `rgba(255,0,0,0.20)` | Highlight behind alert text |
| `state-available` | `#1DB954` | State badge: available |
| `state-unavailable` | `#FF4444` | State badge: unavailable |
| `state-removed` | `#888888` | State badge: removed |

### Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| App logo, section headers | Orbitron | 700 | `text-3xl` / `text-xl` |
| Welcome greeting | Orbitron | 400 | `text-lg` |
| Body, track names, notifications | System mono | 400 | `text-sm` |
| Metadata, timestamps | System mono | 400 | `text-xs` muted |

Load Orbitron via `next/font/google`, expose as `--font-orbitron`, add `fontFamily.orbitron` to Tailwind config.

### Layout Rules
- Single column, `max-w-sm mx-auto`, `px-4 py-6`, `gap-4` between sections
- Cards: `rounded-2xl border border-surface-cardBorder p-4` — always `rounded-2xl`, never `rounded-lg`
- No shadows — borders only. No animation libraries — `transition-colors duration-150` only.

### Component Specs

**AppHeader:** Black `h-14` bar, flex between. "Spot" + Spotify SVG in green-ringed black circle + "tracK" in Orbitron. Always black regardless of theme.

**BottomBar:** Fixed bottom, black, flex between. Moon icon left (→ dark mode), Sun icon right (→ light mode). Active = `brand-green`. Implemented with `next-themes`.

**NotificationBanner:** Full-width card. "Welcome {displayName}" in Orbitron brand-green underlined. Body in mono. Alert keywords use `text-alert bg-text-alertBg rounded-sm`. Shows latest unread notification.

**PlaylistTile:** `w-16 h-16 rounded-2xl bg-brand-cyan`. Name below in mono `text-xs text-center` max 2 lines. Active = `ring-2 ring-brand-green`. Horizontal scroll row (`overflow-x-auto flex gap-3`), no wrapping. Phase 8: replace bg with `coverImageUrl` image.

**WatchlistSection:** Full-width card. Header row: "Watchlists" Orbitron + "+" button (brand-green rounded-full). Empty state: dashed border + muted text. Entries: WatchlistEntryRow (name+artist left, badge+trash right).

**TrackRow:** `flex justify-between py-3 border-b`. Track + artist left. StateBadge right. Click to expand inline TrackStateHistory.

**StateBadge:** `rounded-full px-2 py-0.5 text-xs font-mono`. Style: `bg-state-{state}/20 text-state-{state}`.

**Login page:** Full screen centered. Large logo. Mono tagline. "Connect with Spotify" = `bg-brand-green text-black font-bold rounded-full px-8 py-3` + Spotify SVG.

### Themes
Default: light (magenta bg). Dark: `surface-dark` bg + `surface-darkCard` cards. Headers/BottomBar always black. All accent colors unchanged between themes. `darkMode: 'class'` in Tailwind config.

### Component File Map
```
components/
├── layout/     AppHeader.tsx  BottomBar.tsx  PageShell.tsx
├── dashboard/  NotificationBanner.tsx  TrackedPlaylists.tsx  PlaylistTile.tsx  WatchlistSection.tsx
├── playlist/   TrackRow.tsx  TrackStateHistory.tsx  StateBadge.tsx
├── watchlist/  WatchlistEntryRow.tsx  AddWatchlistModal.tsx
└── ui/         Card.tsx  SectionHeader.tsx  SpotifyLogo.tsx
```

---

## Constants (`packages/shared/src/constants.ts`)

```typescript
export const PLAYLIST_SWEEP_INTERVAL_HOURS = 12
export const WATCHLIST_SWEEP_INTERVAL_HOURS = 24
export const TOKEN_REFRESH_BUFFER_MINUTES = 5
export const SPOTIFY_TRACK_PAGE_SIZE = 100
export const SPOTIFY_PLAYLIST_PAGE_SIZE = 50
export const WATCHLIST_BATCH_SIZE = 50
export const FUSE_MATCH_THRESHOLD = 0.15
export const SWEEP_API_DELAY_MS = 200
export const JOB_ATTEMPTS = 3
export const JOB_BACKOFF_MS = 5000
export const CONSECUTIVE_MISS_THRESHOLD = 2
```

---

## Directory Structure

```
apps/api/src/
├── index.ts
├── routes/      auth.ts  playlists.ts  watchlist.ts  notifications.ts
├── services/    spotify.service.ts  sweep.service.ts  notification.service.ts  watchlist.service.ts
├── jobs/        queues.ts  workers.ts  scheduler.ts
│                playlist-sweep.job.ts  watchlist-sweep.job.ts  notification.job.ts
├── lib/         crypto.ts  prisma.ts  redis.ts  async-handler.ts
├── middleware/  auth.middleware.ts  error.middleware.ts
└── prisma/      schema.prisma  migrations/

apps/web/src/
├── app/
│   ├── layout.tsx                  # Orbitron font, ThemeProvider
│   ├── page.tsx                    # Login/landing
│   └── dashboard/
│       ├── page.tsx                # Main dashboard
│       ├── playlist/[id]/page.tsx
│       ├── watchlist/page.tsx
│       └── settings/page.tsx
├── components/                     # See component map above
├── hooks/       usePlaylists.ts  useWatchlist.ts  useNotifications.ts
└── lib/         api.ts  session.ts

packages/shared/src/  types.ts  constants.ts  schemas.ts
```

---

## Environment Variables

```bash
# apps/api/.env
DATABASE_URL=postgresql://user:password@localhost:5432/spotifywatch
REDIS_URL=redis://localhost:6379
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://localhost:3001/api/auth/spotify/callback
TOKEN_ENCRYPTION_KEY=   # openssl rand -hex 32
SESSION_SECRET=         # openssl rand -hex 32
RESEND_API_KEY=
RESEND_FROM_ADDRESS=notifications@yourdomain.com
PORT=3001

# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Build Phases

| Phase | Focus | Key deliverables |
|---|---|---|
| 1 | Foundation | Monorepo, Docker, Prisma, OAuth, token encryption, login page + design tokens + Orbitron + AppHeader + BottomBar |
| 2 | Snapshot engine | `spotifyClient()` wrapper, full pagination, baseline snapshot on login |
| 3 | Sweep & diff | BullMQ/Redis, master scheduler, playlist sweep job, state transitions, notification records |
| 4 | Playlist UI | Dashboard (NotificationBanner + PlaylistTile strip + WatchlistSection empty), playlist detail TrackRow + StateBadge |
| 5 | Notifications | Resend, notification worker, all 5 email templates |
| 6 | Watchlist | AddWatchlistModal, WatchlistEntryRow, service token, watchlist sweep + Fuse.js |
| 7 | Hardening | Revoked token flow, 429 backoff, deduplication, apply for Spotify Extended Access |
| 8 | Polish | Settings page, replace cyan tiles with real cover art (`coverImageUrl`), infra monitoring, PWA/push |

---

## Code Conventions

- TypeScript strict everywhere. No `any` — use `unknown` and narrow.
- No magic numbers — all in `constants.ts`.
- No inline SQL — Prisma query builder only.
- All Spotify calls via `spotifyClient(userId)` — never raw fetch.
- All async Express handlers wrapped in `asyncHandler()`.
- Zod on every route input — return 400 on failure.
- Pino for all significant events. Never log tokens, secrets, or emails above debug.
- File naming: `camelCase` utils, `kebab-case` routes, `PascalCase` components.
- One responsibility per file. No business logic in route handlers.

---

## Known Constraints & Gotchas

1. **Dev Mode = 5 users max.** Don't onboard more until Spotify Extended Access approved (requires 250k MAU — apply early, manual review).
2. **No webhooks.** Everything pull-based. Never attempt event-driven Spotify integration.
3. **Always pass `?market=from_token`** on playlist track endpoints — otherwise `is_playable` won't reflect user's region.
4. **Two consecutive misses before `REMOVED`** — single miss may be catalog indexing hiccup. Use `consecutiveMisses`.
5. **Redis lock on token refresh** — `lock:token-refresh:{userId}` TTL 30s — prevents race when concurrent jobs hit same user.
6. **Collaborative playlists** — collaborator-removed tracks are indistinguishable from Spotify-removed. System tracks availability only.
7. **Paginate everything.** Some playlists have thousands of tracks. Never assume one response is complete.
