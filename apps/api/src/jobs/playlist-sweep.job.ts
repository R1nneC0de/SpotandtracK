import { TrackState } from '@prisma/client'
import { SWEEP_API_DELAY_MS, CONSECUTIVE_MISS_THRESHOLD } from '@spotttrack/shared'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { spotifyClient, fetchAllPlaylistTracks } from '../services/spotify.service'
import { enqueueNotification } from '../services/notification.service'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Entry point — called by the BullMQ worker for a single user */
export async function runPlaylistSweep(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

  if (user.monitoringPaused) {
    logger.info({ userId }, 'Sweep skipped — monitoring paused')
    return
  }

  const playlists = await prisma.trackedPlaylist.findMany({
    where: { userId, isTracked: true },
    include: { tracks: true },
  })

  if (playlists.length === 0) {
    logger.info({ userId }, 'Sweep skipped — no tracked playlists')
    return
  }

  const client = await spotifyClient(userId)
  logger.info({ userId, playlistCount: playlists.length }, 'Starting playlist sweep')

  for (const playlist of playlists) {
    try {
      await sweepPlaylist(client, playlist as PlaylistWithTracks, userId)
    } catch (err) {
      logger.error({ err, playlistId: playlist.id, spotifyId: playlist.spotifyId }, 'Error sweeping playlist')
    }
    // Throttle between playlist fetches to avoid Spotify rate limits
    await delay(SWEEP_API_DELAY_MS)
  }

  logger.info({ userId }, 'Playlist sweep complete')
}

type PlaylistWithTracks = Awaited<
  ReturnType<typeof prisma.trackedPlaylist.findMany>
>[number] & {
  tracks: Awaited<ReturnType<typeof prisma.trackedTrack.findMany>>
}

async function sweepPlaylist(
  client: Awaited<ReturnType<typeof spotifyClient>>,
  playlist: PlaylistWithTracks,
  userId: string
): Promise<void> {
  const items = await fetchAllPlaylistTracks(client, playlist.spotifyId)

  // Build lookup: spotifyTrackId → { is_playable, reason }
  const spotifyMap = new Map<string, { is_playable: boolean; reason: string | null }>()
  for (const item of items) {
    if (item.track?.id) {
      spotifyMap.set(item.track.id, {
        is_playable: item.track.is_playable ?? true,
        reason: item.track.restrictions?.reason ?? null,
      })
    }
  }

  const dbTrackIds = new Set(playlist.tracks.map((t) => t.spotifyTrackId))

  // Diff existing DB tracks against live Spotify data
  for (const track of playlist.tracks) {
    const spotifyData = spotifyMap.get(track.spotifyTrackId)

    if (spotifyData) {
      // Track exists in the Spotify response — check playability
      await prisma.trackedTrack.update({
        where: { id: track.id },
        // Reset miss counter whenever track is present, regardless of playability
        data: { consecutiveMisses: 0 },
      })

      if (spotifyData.is_playable) {
        if (track.state !== 'AVAILABLE') {
          // Returning from UNAVAILABLE or REMOVED → TRACK_RETURNED notification
          await transitionState(track, 'AVAILABLE', null, userId, playlist.name)
        }
      } else {
        // Present but regionally or product-restricted → UNAVAILABLE
        if (track.state !== 'UNAVAILABLE') {
          await transitionState(track, 'UNAVAILABLE', spotifyData.reason, userId, playlist.name)

        } else {
          // Still unavailable — log the ongoing reason for observability but don't re-notify
          logger.info(
            { trackId: track.id, name: track.name, reason: spotifyData.reason },
            'Track still unavailable'
          )
        }
      }
    } else {
      // Not found in Spotify response — user most likely removed this track from their playlist.
      // Buffer one sweep in case of a transient Spotify API hiccup, then delete quietly.
      // We do NOT fire TRACK_REMOVED here: that state conflates user removals with catalog
      // removals, causing false-positive notifications whenever a user curates their playlist.
      const newMisses = track.consecutiveMisses + 1

      if (newMisses >= CONSECUTIVE_MISS_THRESHOLD) {
        // Confirmed absent for 2+ sweeps — treat as user-removed and stop tracking it.
        // Cascades to TrackStateHistory via onDelete: Cascade in schema.
        await prisma.trackedTrack.delete({ where: { id: track.id } })
        logger.info(
          { trackId: track.id, name: track.name, playlistId: playlist.id },
          'Track no longer in playlist — removed from tracking'
        )
      } else {
        await prisma.trackedTrack.update({
          where: { id: track.id },
          data: { consecutiveMisses: newMisses },
        })
        logger.info(
          { trackId: track.id, name: track.name, misses: newMisses },
          'Track miss — waiting for next sweep to confirm'
        )
      }
    }
  }

  // Insert tracks that appeared on Spotify but aren't in DB yet — no notification on discovery
  for (const item of items) {
    const track = item.track!
    if (!track.id || dbTrackIds.has(track.id)) continue

    await prisma.trackedTrack.create({
      data: {
        playlistId: playlist.id,
        spotifyTrackId: track.id,
        name: track.name,
        artistName: track.artists[0]?.name ?? 'Unknown Artist',
        albumName: track.album.name,
        state: 'AVAILABLE',
      },
    })
    logger.info({ playlistId: playlist.id, trackId: track.id }, 'New track discovered')
  }

  await prisma.trackedPlaylist.update({
    where: { id: playlist.id },
    data: { lastSweptAt: new Date() },
  })

  logger.info(
    { playlistId: playlist.id, spotifyId: playlist.spotifyId, trackCount: items.length },
    'Playlist sweep done'
  )
}

async function transitionState(
  track: { id: string; state: TrackState; name: string; artistName: string; playlistId: string; spotifyTrackId: string },
  toState: TrackState,
  reason: string | null,
  userId: string,
  playlistName: string
): Promise<void> {
  const fromState = track.state

  // Atomic DB update — history record and track state must always agree
  await prisma.$transaction([
    prisma.trackedTrack.update({
      where: { id: track.id },
      data: { state: toState, stateChangedAt: new Date() },
    }),
    prisma.trackStateHistory.create({
      data: {
        trackId: track.id,
        fromState,
        toState,
        reason,
      },
    }),
  ])

  logger.info(
    { trackId: track.id, name: track.name, fromState, toState, reason },
    'Track state changed'
  )

  // Map toState to the correct notification type
  const notificationType =
    toState === 'UNAVAILABLE'
      ? 'TRACK_UNAVAILABLE'
      : toState === 'REMOVED'
      ? 'TRACK_REMOVED'
      : 'TRACK_RETURNED' // AVAILABLE — song came back

  // Guard against duplicate notifications if a sweep job is retried after partial failure.
  // A notification for this exact track+type within the last hour means we already fired —
  // enqueuing again would send the user a redundant email.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentDuplicate = await prisma.notification.findFirst({
    where: {
      userId,
      type: notificationType,
      createdAt: { gte: oneHourAgo },
      // Prisma JSON path filter: match only records whose payload.spotifyTrackId equals this track
      payload: { path: ['spotifyTrackId'], equals: track.spotifyTrackId },
    },
  })

  if (recentDuplicate) {
    logger.debug(
      { notificationId: recentDuplicate.id, trackId: track.id, type: notificationType },
      'Duplicate notification suppressed — same track+type seen within 1 hour'
    )
    return
  }

  // enqueueNotification persists a DB record before adding to queue,
  // so the notification survives even if the queue job is dropped
  await enqueueNotification(userId, notificationType, {
    trackName: track.name,
    artistName: track.artistName,
    playlistName,
    detectedAt: new Date().toISOString(),
    reason: reason ?? null,
    // spotifyTrackId is included so the deduplication query above can match future calls
    spotifyTrackId: track.spotifyTrackId,
  })
}
