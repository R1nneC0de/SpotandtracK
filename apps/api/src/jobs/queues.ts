import { Queue } from 'bullmq'
import { JOB_ATTEMPTS, JOB_BACKOFF_MS } from '@spotttrack/shared'

// Parse the Redis URL into plain connection options so BullMQ manages its own
// ioredis instance — avoids the version mismatch error when sharing instances.
function getBullMqConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 10000,
  }
}

const connection = getBullMqConnection()

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
