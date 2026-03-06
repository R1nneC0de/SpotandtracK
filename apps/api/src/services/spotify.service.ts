import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { encrypt, decrypt } from '../lib/crypto'
import { logger } from '../lib/logger'
import { enqueueNotification } from './notification.service'
import {
  TOKEN_REFRESH_BUFFER_MINUTES,
  SPOTIFY_TRACK_PAGE_SIZE,
  SPOTIFY_PLAYLIST_PAGE_SIZE,
  SWEEP_API_DELAY_MS,
} from '@spotttrack/shared'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export interface SpotifyPlaylist {
  id: string
  name: string
  images: { url: string }[]
  tracks: { total: number } | null
}

export interface SpotifyTrackItem {
  track: {
    id: string
    name: string
    artists: { name: string }[]
    album: { name: string }
    is_playable?: boolean
    restrictions?: { reason: string }
    [key: string]: unknown
  } | null
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Fetch every page of the user's Spotify playlists */
export async function fetchAllPlaylists(
  client: Awaited<ReturnType<typeof spotifyClient>>
): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = []
  let offset = 0

  while (true) {
    const res = await client.get('/me/playlists', {
      limit: String(SPOTIFY_PLAYLIST_PAGE_SIZE),
      offset: String(offset),
    })
    if (!res.ok) throw new Error(`Failed to fetch playlists: ${res.status}`)

    const page = (await res.json()) as {
      items: SpotifyPlaylist[]
      next: string | null
    }

    // Spotify can return null items for inaccessible playlists
    playlists.push(...page.items.filter((p) => p !== null && p.id))
    if (!page.next) break
    offset += SPOTIFY_PLAYLIST_PAGE_SIZE
    await delay(SWEEP_API_DELAY_MS)
  }

  return playlists
}

/** Fetch every page of tracks for a given playlist */
export async function fetchAllPlaylistTracks(
  client: Awaited<ReturnType<typeof spotifyClient>>,
  playlistId: string
): Promise<SpotifyTrackItem[]> {
  const tracks: SpotifyTrackItem[] = []
  let offset = 0

  while (true) {
    const res = await client.get(`/playlists/${playlistId}/items`, {
      market: client.market,
      limit: String(SPOTIFY_TRACK_PAGE_SIZE),
      offset: String(offset),
    })
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}))
      logger.warn({ playlistId, spotifyError: body }, 'Spotify 403 on playlist tracks — full error body')
      return []
    }
    if (!res.ok) throw new Error(`Failed to fetch tracks for ${playlistId}: ${res.status}`)

    const raw = (await res.json()) as {
      items: Array<Record<string, unknown>>
      next: string | null
    }

    // The /items endpoint uses "item" key; normalize to "track" for consistent downstream use
    const page = {
      items: raw.items.map((i) => ({
        ...i,
        track: (i['item'] ?? i['track']) as SpotifyTrackItem['track'],
      })) as SpotifyTrackItem[],
      next: raw.next,
    }

    // Filter out null/undefined tracks (local files, deleted tracks, podcast episodes)
    tracks.push(...page.items.filter((item) => item?.track != null && item.track.id))
    if (!page.next) break
    offset += SPOTIFY_TRACK_PAGE_SIZE
    await delay(SWEEP_API_DELAY_MS)
  }

  return tracks
}

async function acquireRedisLock(key: string, ttlMs: number): Promise<boolean> {
  const result = await redis.set(key, '1', 'PX', ttlMs, 'NX')
  return result === 'OK'
}

async function releaseRedisLock(key: string): Promise<void> {
  await redis.del(key)
}

export async function spotifyClient(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

  let accessToken = decrypt(user.accessToken)
  const bufferMs = TOKEN_REFRESH_BUFFER_MINUTES * 60 * 1000
  const needsRefresh = user.tokenExpiresAt.getTime() - Date.now() < bufferMs

  if (needsRefresh) {
    const lockKey = `lock:token-refresh:${userId}`
    const locked = await acquireRedisLock(lockKey, 30_000)

    if (locked) {
      try {
        const refreshToken = decrypt(user.refreshToken)
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.SPOTIFY_CLIENT_ID ?? '',
          client_secret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
        })

        let response = await fetch(SPOTIFY_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        })

        if (response.status === 429) {
          // Token endpoint can also be rate-limited — wait once before giving up
          const retryAfterHeader = response.headers.get('Retry-After')
          const waitSeconds = Math.min(retryAfterHeader ? parseInt(retryAfterHeader, 10) : 10, 60)
          logger.warn({ userId, waitSeconds }, 'Spotify token refresh 429 — waiting before retry')
          await delay(waitSeconds * 1000)

          response = await fetch(SPOTIFY_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          })

          if (response.status === 429) {
            throw new Error('Spotify token refresh rate limited')
          }
        }

        if (response.status === 401) {
          await prisma.user.update({
            where: { id: userId },
            data: { monitoringPaused: true, pauseReason: 'token_revoked' },
          })
          logger.warn({ userId }, 'Token revoked — monitoring paused')

          // Notify the user so they know to reconnect; email address not logged here
          await enqueueNotification(userId, 'MONITORING_PAUSED', {
            detectedAt: new Date().toISOString(),
          })

          throw new Error('Spotify token revoked')
        }

        if (!response.ok) {
          throw new Error(`Token refresh failed: ${response.status}`)
        }

        const data = (await response.json()) as {
          access_token: string
          expires_in: number
          refresh_token?: string
        }

        const newExpiry = new Date(Date.now() + data.expires_in * 1000)
        await prisma.user.update({
          where: { id: userId },
          data: {
            accessToken: encrypt(data.access_token),
            refreshToken: data.refresh_token
              ? encrypt(data.refresh_token)
              : user.refreshToken,
            tokenExpiresAt: newExpiry,
          },
        })

        accessToken = data.access_token
        logger.info({ userId }, 'Token refreshed successfully')
      } finally {
        await releaseRedisLock(lockKey)
      }
    } else {
      // Another process is refreshing — re-fetch from DB
      const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
      accessToken = decrypt(freshUser.accessToken)
    }
  }

  return {
    market: user.market,
    get: async (path: string, params?: Record<string, string>): Promise<Response> => {
      const url = new URL(`${SPOTIFY_API_BASE}${path}`)
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.status !== 429) {
        return response
      }

      // Spotify returned 429 — respect the Retry-After header before retrying once.
      // Cap at 60s to prevent indefinitely blocking the worker process.
      const retryAfterHeader = response.headers.get('Retry-After')
      const waitSeconds = Math.min(retryAfterHeader ? parseInt(retryAfterHeader, 10) : 10, 60)
      logger.warn({ path, waitSeconds }, 'Spotify API 429 — waiting before retry')
      await delay(waitSeconds * 1000)

      const retried = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (retried.status === 429) {
        // Two consecutive 429s — surface a typed error so BullMQ's backoff takes over
        const err = new Error('Spotify rate limited') as Error & { retryAfter: number }
        err.retryAfter = waitSeconds
        throw err
      }

      return retried
    },
  }
}
