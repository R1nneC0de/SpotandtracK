import Redis from 'ioredis'
import { logger } from './logger'

// BullMQ requires maxRetriesPerRequest: null — commands must queue during reconnect.
// keepAlive prevents Upstash from closing idle connections and triggering ECONNRESET.
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  keepAlive: 10000,
})

// Session store client — fails fast so the OAuth callback never hangs.
// maxRetriesPerRequest: 0 + enableOfflineQueue: false means if Redis is
// briefly down, session reads reject immediately and express-session
// falls back to a new session, rather than queuing for 20 retries.
export const sessionRedis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 0,
  enableOfflineQueue: false,
  keepAlive: 10000,
})

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error')
})

redis.on('connect', () => {
  logger.info('Redis connected')
})

sessionRedis.on('error', (err) => {
  logger.warn({ err }, 'Session Redis connection error')
})
