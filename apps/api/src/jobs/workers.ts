import { Worker } from 'bullmq'
import { logger } from '../lib/logger'

function getBullMqConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
    keepAlive: 10000,
  }
}

const connection = getBullMqConnection()
import { runPlaylistSweep } from './playlist-sweep.job'
import { runNotificationJob } from './notification.job'
import { runWatchlistSweep } from './watchlist-sweep.job'

export function startWorkers(): {
  playlistWorker: Worker
  notificationWorker: Worker
  watchlistWorker: Worker
} {
  // Playlist sweep worker — concurrency 5 per CLAUDE.md
  const playlistWorker = new Worker(
    'playlist-sweep',
    async (job) => {
      await runPlaylistSweep(job.data.userId as string)
    },
    {
      connection,
      concurrency: 2,
    }
  )

  playlistWorker.on('error', (err) => {
    logger.error({ err }, 'Playlist sweep worker error')
  })

  playlistWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, userId: job.data.userId }, 'Playlist sweep job completed')
  })

  playlistWorker.on('failed', (job, err) => {
    // Check for Spotify 429 rate limit — logged as warn because it's expected under load
    const status = (err as NodeJS.ErrnoException & { status?: number }).status
    if (status === 429) {
      logger.warn({ jobId: job?.id, userId: job?.data?.userId }, 'Spotify rate limited — will retry')
    } else {
      logger.error({ err, jobId: job?.id, userId: job?.data?.userId }, 'Playlist sweep job failed')
    }
  })

  // Notification worker — concurrency 10; jobs are cheap (one Resend HTTP call each)
  const notificationWorker = new Worker(
    'notifications',
    async (job) => {
      await runNotificationJob(job)
    },
    {
      connection,
      concurrency: 2,
    }
  )

  notificationWorker.on('error', (err) => {
    logger.error({ err }, 'Notification worker error')
  })

  notificationWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, notificationId: job.data.notificationId }, 'Notification job completed')
  })

  notificationWorker.on('failed', (job, err) => {
    // After all 3 attempts are exhausted BullMQ fires this event.
    // We log the failure but leave `sent=false` — the DB record is the source
    // of truth and can be replayed manually if needed.
    logger.error(
      { err, jobId: job?.id, notificationId: job?.data?.notificationId },
      'Notification job failed after all retries — email not sent'
    )
  })

  // Watchlist sweep worker — concurrency 10; each job processes all unresolved
  // entries in batches, so at most one active sweep job runs at a time
  const watchlistWorker = new Worker(
    'watchlist-sweep',
    async (_job) => {
      await runWatchlistSweep()
    },
    {
      connection,
      concurrency: 2,
    }
  )

  watchlistWorker.on('error', (err) => {
    logger.error({ err }, 'Watchlist sweep worker error')
  })

  watchlistWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Watchlist sweep job completed')
  })

  watchlistWorker.on('failed', (job, err) => {
    const status = (err as NodeJS.ErrnoException & { status?: number }).status
    if (status === 429) {
      logger.warn({ jobId: job?.id }, 'Spotify rate limited during watchlist sweep — will retry')
    } else {
      logger.error({ err, jobId: job?.id }, 'Watchlist sweep job failed')
    }
  })

  logger.info('BullMQ workers started')

  return { playlistWorker, notificationWorker, watchlistWorker }
}
