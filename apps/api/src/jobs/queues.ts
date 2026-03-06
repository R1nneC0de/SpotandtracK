import { Queue } from 'bullmq'
import { redis } from '../lib/redis'
import { JOB_ATTEMPTS, JOB_BACKOFF_MS } from '@spotttrack/shared'

const defaultJobOptions = {
  attempts: JOB_ATTEMPTS,
  backoff: { type: 'exponential' as const, delay: JOB_BACKOFF_MS },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
}

export const playlistSweepQueue = new Queue('playlist-sweep', {
  connection: redis,
  defaultJobOptions,
})

export const notificationsQueue = new Queue('notifications', {
  connection: redis,
  defaultJobOptions,
})

// Watchlist sweep uses a separate queue so its concurrency and retry budget
// are isolated from playlist sweep — a watchlist backlog won't starve playlist jobs
export const watchlistSweepQueue = new Queue('watchlist-sweep', {
  connection: redis,
  defaultJobOptions,
})
