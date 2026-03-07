import Redis from 'ioredis'
import { logger } from './logger'

/** Parse REDIS_URL into ioredis connection options with proper TLS handling. */
export function parseRedisUrl() {
  const raw = process.env.REDIS_URL ?? 'redis://localhost:6379'
  const url = new URL(raw)
  const useTls = url.protocol === 'rediss:'
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: useTls ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    keepAlive: 30000,
    retryStrategy(times: number) {
      return Math.min(times * 500, 5000)
    },
    reconnectOnError(err: Error) {
      return err.message.includes('ECONNRESET')
    },
  }
}

export const redis = new Redis(parseRedisUrl())

redis.on('error', (err) => {
  // Suppress noisy ECONNRESET — ioredis will auto-reconnect
  if (err.message.includes('ECONNRESET')) return
  logger.error({ err }, 'Redis connection error')
})

redis.on('connect', () => {
  logger.info('Redis connected')
})
