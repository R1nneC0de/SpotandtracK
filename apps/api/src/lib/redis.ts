import Redis from 'ioredis'
import { logger } from './logger'

// BullMQ requires maxRetriesPerRequest: null — commands must queue during reconnect
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

// Session store client — uses default maxRetriesPerRequest (3) so session
// reads/writes fail fast instead of hanging if Redis briefly disconnects
export const sessionRedis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error')
})

redis.on('connect', () => {
  logger.info('Redis connected')
})
