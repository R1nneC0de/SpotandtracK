import { Queue } from 'bullmq'
import { JOB_ATTEMPTS, JOB_BACKOFF_MS } from '@spotttrack/shared'
import { parseRedisUrl } from '../lib/redis'

const connection = parseRedisUrl()

const defaultJobOptions = {
  attempts: JOB_ATTEMPTS,
  backoff: { type: 'exponential' as const, delay: JOB_BACKOFF_MS },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
}

export const playlistSweepQueue = new Queue('playlist-sweep', {
  connection,
  defaultJobOptions,
})

export const notificationsQueue = new Queue('notifications', {
  connection,
  defaultJobOptions,
})

export const watchlistSweepQueue = new Queue('watchlist-sweep', {
  connection,
  defaultJobOptions,
})
