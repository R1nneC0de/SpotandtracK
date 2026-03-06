import Fuse from 'fuse.js'
import { redis } from '../lib/redis'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { enqueueNotification } from '../services/notification.service'
import {
  WATCHLIST_BATCH_SIZE,
  FUSE_MATCH_THRESHOLD,
  SWEEP_API_DELAY_MS,
} from '@spotttrack/shared'

// ---------------------------------------------------------------------------
// Service-level Client Credentials token
// ---------------------------------------------------------------------------

// Redis key for caching the Spotify Client Credentials token.
// This is a single shared token — not per-user — because Client Credentials
// auth is application-level, not user-level.
const SERVICE_TOKEN_REDIS_KEY = 'service:spotify:token'

interface ClientCredentialsToken {
  access_token: string
  expires_in: number
  token_type: string
}

/**
 * Returns a valid Spotify Client Credentials token, fetching a fresh one from
 * Spotify only when the cached token is missing or expired.
 *
 * Client Credentials tokens are suitable for public data (Spotify Search) but
 * cannot access user-specific data — that requires user OAuth tokens.
 */
async function getServiceToken(): Promise<string> {
  const cached = await redis.get(SERVICE_TOKEN_REDIS_KEY)
  if (cached) {
    return cached
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set')
  }

  // Spotify requires Basic auth with base64-encoded "clientId:clientSecret"
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`Spotify Client Credentials request failed: ${response.status}`)
  }

  const data = (await response.json()) as ClientCredentialsToken

  // Cache with a 60-second buffer before the real expiry to avoid using a token
  // that is about to expire mid-sweep
  const ttl = data.expires_in - 60
  // Never log the token itself — only log that a refresh occurred
  logger.info('Spotify service token refreshed')
  await redis.set(SERVICE_TOKEN_REDIS_KEY, data.access_token, 'EX', ttl)

  return data.access_token
}

// ---------------------------------------------------------------------------
// Spotify Search API shapes
// ---------------------------------------------------------------------------

interface SpotifyArtist {
  name: string
}

interface SpotifyTrackResult {
  id: string
  name: string
  artists: SpotifyArtist[]
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrackResult[]
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Searches Spotify for a query string using the service-level token.
 * Returns up to 5 candidate tracks for Fuse.js to rank.
 */
async function searchSpotifyTracks(
  token: string,
  query: string
): Promise<SpotifyTrackResult[]> {
  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'track')
  url.searchParams.set('limit', '5')

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 429) {
    // Surface the rate-limit as a typed error so the worker can log it
    // and let BullMQ's retry backoff handle the cooldown
    const retryAfter = response.headers.get('Retry-After')
    logger.warn({ retryAfter }, 'Spotify Search 429 — rate limited')
    const err = new Error('Spotify rate limit (429)')
    ;(err as NodeJS.ErrnoException & { status?: number }).status = 429
    throw err
  }

  if (!response.ok) {
    throw new Error(`Spotify Search API error: ${response.status}`)
  }

  const data = (await response.json()) as SpotifySearchResponse
  return data.tracks.items
}

// ---------------------------------------------------------------------------
// Fuse.js matcher
// ---------------------------------------------------------------------------

/**
 * Runs a Fuse.js fuzzy match against the Spotify search results.
 * Returns the best-matching track if it clears the threshold, otherwise null.
 *
 * Fuse.js scores range 0–1 where 0 = perfect match. A score ≤ FUSE_MATCH_THRESHOLD
 * (0.15) means ≥85% similarity — intentionally strict to avoid false positives
 * on watchlist entries.
 */
function findBestMatch(
  candidates: SpotifyTrackResult[],
  _query: string
): SpotifyTrackResult | null {
  if (candidates.length === 0) return null

  const fuse = new Fuse(candidates, {
    keys: [
      { name: 'artists.0.name', weight: 0.5 },
      { name: 'name', weight: 0.5 },
    ],
    threshold: FUSE_MATCH_THRESHOLD,
    includeScore: true,
    ignoreLocation: true,
  })

  // We search by the first candidate's name + artist to let Fuse.js rank
  // the results by similarity. Since we already have the Spotify results, we
  // search with the first result's name as a probe — but what matters is the
  // score Fuse.js assigns based on the configured keys.
  //
  // The correct pattern: search the candidates collection for the original query
  // using a combined title+artist field proxy is not straightforward with Fuse.js
  // key-based search. Instead we use the entry's query as search input directly.
  const results = fuse.search(_query)

  if (results.length === 0) return null

  const best = results[0]
  // score is defined when includeScore: true
  const score = best.score ?? 1

  logger.debug(
    { query: _query, bestMatch: best.item.name, score },
    'Fuse.js match result'
  )

  // Lower score = better match; threshold of 0.15 means ~85% similarity required
  return score <= FUSE_MATCH_THRESHOLD ? best.item : null
}

// ---------------------------------------------------------------------------
// Main sweep processor
// ---------------------------------------------------------------------------

/**
 * Entry point called by the BullMQ watchlist-sweep worker.
 * Processes all unresolved watchlist entries in batches using Spotify Search
 * and Fuse.js to detect when a watched song has appeared on Spotify.
 */
export async function runWatchlistSweep(): Promise<void> {
  logger.info('Watchlist sweep started')

  // Fetch service token once for the entire sweep — shared across all entries
  const serviceToken = await getServiceToken()

  let offset = 0
  let totalProcessed = 0

  // Process in batches to bound memory usage on large watchlists
  while (true) {
    const entries = await prisma.watchlistEntry.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'asc' },
      take: WATCHLIST_BATCH_SIZE,
      skip: offset,
    })

    if (entries.length === 0) break

    for (const entry of entries) {
      try {
        // Build the search query from the user's hints when available,
        // otherwise fall back to the raw query string
        const titlePart = entry.titleHint ?? entry.rawQuery
        const artistPart = entry.artistHint ?? ''
        const searchQuery = `${titlePart} ${artistPart}`.trim()

        const candidates = await searchSpotifyTracks(serviceToken, searchQuery)
        const match = findBestMatch(candidates, searchQuery)

        if (match) {
          const artistName = match.artists[0]?.name ?? 'Unknown Artist'

          // Mark resolved before enqueuing the notification to avoid a race
          // where a second sweep run re-processes the same entry
          await prisma.watchlistEntry.update({
            where: { id: entry.id },
            data: {
              resolved: true,
              resolvedTrackId: match.id,
              lastCheckedAt: new Date(),
            },
          })

          await enqueueNotification(entry.userId, 'WATCHLIST_MATCH', {
            trackName: match.name,
            artistName,
            detectedAt: new Date().toISOString(),
          })

          logger.info(
            { entryId: entry.id, trackId: match.id, trackName: match.name },
            'Watchlist entry resolved — match found on Spotify'
          )
        } else {
          // No match this sweep — update lastCheckedAt so the scheduler can
          // compute the correct next check window
          await prisma.watchlistEntry.update({
            where: { id: entry.id },
            data: { lastCheckedAt: new Date() },
          })

          logger.info({ entryId: entry.id, query: searchQuery }, 'Watchlist entry — no match this sweep')
        }
      } catch (err) {
        const status = (err as NodeJS.ErrnoException & { status?: number }).status
        if (status === 429) {
          // Re-throw 429 so BullMQ's exponential backoff takes over —
          // we don't want to continue burning through entries while rate-limited
          logger.warn({ entryId: entry.id }, 'Rate limited during watchlist sweep — aborting batch')
          throw err
        }
        // Non-rate-limit errors are logged but don't abort the sweep —
        // one bad entry should not prevent others from being checked
        logger.error({ err, entryId: entry.id }, 'Error processing watchlist entry')
      }

      // Throttle between Spotify API calls to stay within rate limits
      await delay(SWEEP_API_DELAY_MS)
    }

    totalProcessed += entries.length

    // If we got fewer entries than the batch size, we've reached the end
    if (entries.length < WATCHLIST_BATCH_SIZE) break

    offset += WATCHLIST_BATCH_SIZE
  }

  logger.info({ totalProcessed }, 'Watchlist sweep complete')
}
