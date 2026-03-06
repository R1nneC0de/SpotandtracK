import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { playlistSweepQueue, watchlistSweepQueue } from './queues'
import {
  PLAYLIST_SWEEP_INTERVAL_HOURS,
  WATCHLIST_SWEEP_INTERVAL_HOURS,
} from '@spotttrack/shared'

/** Enqueue sweep jobs for all users whose lastSweptAt is null or older than 12h */
export async function runMasterScheduler(): Promise<void> {
  const cutoff = new Date(Date.now() - PLAYLIST_SWEEP_INTERVAL_HOURS * 60 * 60 * 1000)

  const users = await prisma.user.findMany({
    where: {
      monitoringPaused: false,
      playlists: { some: { isTracked: true } },
      OR: [
        { playlists: { some: { lastSweptAt: null } } },
        { playlists: { some: { lastSweptAt: { lt: cutoff } } } },
      ],
    },
    select: { id: true },
  })

  if (users.length === 0) {
    logger.info('Master scheduler: no users due for playlist sweep')
    return
  }

  for (const user of users) {
    await playlistSweepQueue.add(
      'sweep-user',
      { userId: user.id },
      { jobId: `sweep-${user.id}-${Date.now()}` }
    )
  }

  logger.info({ enqueued: users.length }, 'Master scheduler: playlist sweep jobs enqueued')
}

/**
 * Enqueue a single watchlist sweep job if any users have unresolved entries
 * that haven't been checked in the last 24h.
 *
 * The watchlist sweep is a single global job (not per-user) because it uses a
 * shared Client Credentials token and processes all entries in one pass.
 */
export async function runWatchlistScheduler(): Promise<void> {
  const cutoff = new Date(Date.now() - WATCHLIST_SWEEP_INTERVAL_HOURS * 60 * 60 * 1000)

  // Check whether any unresolved entry is due for a check — either never
  // checked, or last checked more than 24h ago
  const dueCount = await prisma.watchlistEntry.count({
    where: {
      resolved: false,
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lt: cutoff } },
      ],
    },
  })

  if (dueCount === 0) {
    logger.info('Watchlist scheduler: no entries due for sweep')
    return
  }

  // A single job covers all entries — use a fixed jobId to prevent duplicate
  // jobs from stacking if the scheduler fires faster than the job completes
  await watchlistSweepQueue.add(
    'sweep-watchlist',
    {},
    { jobId: `watchlist-sweep-${Date.now()}` }
  )

  logger.info({ dueCount }, 'Watchlist scheduler: sweep job enqueued')
}

/** Start the hourly master scheduler cron */
export function startScheduler(): void {
  // Playlist sweep: runs at the top of every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Master scheduler tick')
    try {
      await runMasterScheduler()
    } catch (err) {
      logger.error({ err }, 'Master scheduler error')
    }
  })

  // Watchlist sweep: runs once per day at midnight.
  // The 24h cadence means checking more frequently is wasteful — songs don't
  // appear on Spotify faster than the daily sweep will catch them.
  cron.schedule('0 0 * * *', async () => {
    logger.info('Watchlist scheduler tick')
    try {
      await runWatchlistScheduler()
    } catch (err) {
      logger.error({ err }, 'Watchlist scheduler error')
    }
  })

  logger.info('Master scheduler started (playlist: hourly, watchlist: daily)')
}
