import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { spotifyClient, fetchAllPlaylists, fetchAllPlaylistTracks } from './spotify.service'

/**
 * Fetch the user's full Spotify playlist list (live, all pages).
 */
export async function getUserPlaylists(userId: string) {
  const client = await spotifyClient(userId)
  const playlists = await fetchAllPlaylists(client)
  return playlists.map((p) => ({
    spotifyId: p.id,
    name: p.name,
    coverImageUrl: p.images[0]?.url ?? null,
    trackTotal: p.tracks?.total ?? 0,
  }))
}

/**
 * Start tracking a playlist. Creates the DB record and runs a baseline snapshot
 * to populate all current tracks as AVAILABLE.
 */
export async function trackPlaylist(userId: string, spotifyId: string) {
  const client = await spotifyClient(userId)

  // Fetch live playlist metadata for name + cover
  const res = await client.get(`/playlists/${spotifyId}`, {
    fields: 'id,name,images',
  })
  if (!res.ok) throw new Error(`Failed to fetch playlist ${spotifyId}: ${res.status}`)

  const meta = (await res.json()) as {
    id: string
    name: string
    images: { url: string }[]
  }

  // Upsert the TrackedPlaylist record
  const playlist = await prisma.trackedPlaylist.upsert({
    where: { userId_spotifyId: { userId, spotifyId } },
    update: {
      isTracked: true,
      name: meta.name,
      coverImageUrl: meta.images[0]?.url ?? null,
    },
    create: {
      userId,
      spotifyId,
      name: meta.name,
      coverImageUrl: meta.images[0]?.url ?? null,
    },
  })

  logger.info({ userId, spotifyId, playlistId: playlist.id }, 'Playlist tracking started')

  // Run baseline snapshot in the background — don't block the HTTP response
  takeBaselineSnapshot(playlist.id, userId, spotifyId).catch((err) => {
    logger.error({ err, playlistId: playlist.id }, 'Baseline snapshot failed')
  })

  return playlist
}

/**
 * Stop tracking a playlist (soft delete — keeps history).
 */
export async function untrackPlaylist(userId: string, spotifyId: string) {
  const playlist = await prisma.trackedPlaylist.findUnique({
    where: { userId_spotifyId: { userId, spotifyId } },
  })
  if (!playlist) return null

  await prisma.trackedPlaylist.update({
    where: { id: playlist.id },
    data: { isTracked: false },
  })

  logger.info({ userId, spotifyId }, 'Playlist untracked')
  return playlist
}

/**
 * Get all tracked playlists for a user with current track states.
 */
export async function getTrackedPlaylists(userId: string) {
  return prisma.trackedPlaylist.findMany({
    where: { userId, isTracked: true },
    include: {
      tracks: {
        select: {
          id: true,
          spotifyTrackId: true,
          name: true,
          artistName: true,
          albumName: true,
          state: true,
          stateChangedAt: true,
          firstSeenAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Get all tracks for a single tracked playlist.
 */
export async function getPlaylistTracks(userId: string, spotifyId: string) {
  const playlist = await prisma.trackedPlaylist.findUnique({
    where: { userId_spotifyId: { userId, spotifyId } },
    include: {
      tracks: {
        select: {
          id: true,
          spotifyTrackId: true,
          name: true,
          artistName: true,
          albumName: true,
          state: true,
          stateChangedAt: true,
          firstSeenAt: true,
          consecutiveMisses: true,
          stateHistory: {
            select: { fromState: true, toState: true, reason: true, detectedAt: true },
            orderBy: { detectedAt: 'desc' },
            take: 10,
          },
        },
        orderBy: { firstSeenAt: 'asc' },
      },
    },
  })
  if (!playlist) return null
  return playlist
}

/**
 * Paginate all current tracks from Spotify and upsert them as AVAILABLE.
 * Called once when a playlist is first tracked.
 */
async function takeBaselineSnapshot(
  playlistId: string,
  userId: string,
  spotifyId: string
) {
  logger.info({ playlistId, spotifyId }, 'Taking baseline snapshot')

  const client = await spotifyClient(userId)
  const items = await fetchAllPlaylistTracks(client, spotifyId)

  if (items.length === 0) {
    logger.info({ playlistId, spotifyId }, 'Baseline snapshot: no tracks fetched (restricted or empty playlist)')
    return
  }

  let inserted = 0
  for (const item of items) {
    const track = item.track
    if (!track?.id) continue

    await prisma.trackedTrack.upsert({
      where: {
        playlistId_spotifyTrackId: {
          playlistId,
          spotifyTrackId: track.id,
        },
      },
      update: {}, // Don't overwrite state on re-track
      create: {
        playlistId,
        spotifyTrackId: track.id,
        name: track.name,
        artistName: track.artists[0]?.name ?? 'Unknown Artist',
        albumName: track.album.name,
        state: 'AVAILABLE',
      },
    })
    inserted++
  }

  await prisma.trackedPlaylist.update({
    where: { id: playlistId },
    data: { lastSweptAt: new Date() },
  })

  logger.info({ playlistId, spotifyId, inserted }, 'Baseline snapshot complete')
}
