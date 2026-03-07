import Redis from 'ioredis'
import { logger } from './logger'

// BullMQ requires maxRetriesPerRequest: null — commands must queue during reconnect.
// keepAlive prevents Upstash from closing idle connections and triggering ECONNRESET.
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  keepAlive: 10000,
})

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error')
})

redis.on('connect', () => {
  logger.info('Redis connected')
})
