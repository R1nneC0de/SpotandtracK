import 'dotenv/config'
import express from 'express'
import cookieSession from 'cookie-session'
import cors from 'cors'
import { logger } from './lib/logger'
import { redis } from './lib/redis'
import { errorMiddleware } from './middleware/error.middleware'
import { startWorkers } from './jobs/workers'
import { startScheduler, runMasterScheduler } from './jobs/scheduler'
import { playlistSweepQueue } from './jobs/queues'
import { requireAuth } from './middleware/auth.middleware'
// playlistSweepQueue kept for debug routes below
import { asyncHandler } from './lib/async-handler'
import { runPlaylistSweep } from './jobs/playlist-sweep.job'
import { runWatchlistSweep } from './jobs/watchlist-sweep.job'
import { prisma } from './lib/prisma'
import { decrypt } from './lib/crypto'
import { spotifyClient } from './services/spotify.service'
import authRouter from './routes/auth'
import playlistsRouter from './routes/playlists'
import watchlistRouter from './routes/watchlist'
import notificationsRouter from './routes/notifications'

const app = express()
const PORT = parseInt(process.env.PORT ?? '3001', 10)

// Accept requests from both localhost and production frontend
const ALLOWED_ORIGINS = [
  process.env.WEB_URL ?? 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`))
      }
    },
    credentials: true,
  })
)
app.use(express.json())
const isProd = process.env.NODE_ENV === 'production'

// cookie-session stores the session IN the signed cookie — no Redis required.
// This eliminates the Redis connection dependency for auth entirely.
app.use(
  cookieSession({
    name: 'session',
    secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
)

// ── Core routes ────────────────────────────────────────────────────────────────
// Simple health check — no Redis dependency so Render/UptimeRobot never gets a 502
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/playlists', playlistsRouter)
app.use('/api/watchlist', watchlistRouter)
app.use('/api/notifications', notificationsRouter)

// ── Dev-only routes (testing Phase 3) ─────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  // Manually trigger a sweep for the logged-in user (bypasses 12h cadence)
  app.post(
    '/api/debug/sweep',
    requireAuth,
    asyncHandler(async (req, res) => {
      await runPlaylistSweep(req.session.userId!)
      res.json({ ok: true, message: 'Sweep completed synchronously' })
    })
  )

  // Enqueue a sweep job through the queue (tests the full BullMQ pipeline)
  app.post(
    '/api/debug/sweep/enqueue',
    requireAuth,
    asyncHandler(async (req, res) => {
      const job = await playlistSweepQueue.add('sweep-user', {
        userId: req.session.userId!,
      })
      res.json({ ok: true, jobId: job.id })
    })
  )

  // Manually run the master scheduler tick
  app.post('/api/debug/scheduler', asyncHandler(async (_req, res) => {
    await runMasterScheduler()
    res.json({ ok: true, message: 'Scheduler tick completed' })
  }))

  // Manually trigger a watchlist sweep (bypasses 24h cadence)
  app.post('/api/debug/watchlist-sweep', asyncHandler(async (_req, res) => {
    await runWatchlistSweep()
    res.json({ ok: true, message: 'Watchlist sweep completed synchronously' })
  }))

  // Debug: inspect token validity and raw Spotify request for a playlist
  app.get(
    '/api/debug/tracks/:playlistId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.session.userId!
      const { playlistId } = req.params

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
      const token = decrypt(user.accessToken)

      const url = `https://api.spotify.com/v1/playlists/${playlistId}/items?market=${user.market}&limit=1&offset=0`

      const rawRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await rawRes.json().catch(() => null)

      res.json({
        url,
        status: rawRes.status,
        market: user.market,
        tokenLength: token.length,
        tokenHasWhitespace: /\s/.test(token),
        tokenFirst20: token.substring(0, 20),
        tokenLast5: token.substring(token.length - 5),
        responseBody: body,
      })
    })
  )

  // Debug: verify token works at all (calls /me)
  app.get(
    '/api/debug/token',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.session.userId!
      const client = await spotifyClient(userId)
      const meRes = await client.get('/me')
      const meBody = await meRes.json().catch(() => null)
      res.json({
        status: meRes.status,
        ok: meRes.ok,
        market: client.market,
        body: meRes.ok ? { id: (meBody as Record<string,unknown>)?.id, country: (meBody as Record<string,unknown>)?.country } : meBody,
      })
    })
  )
}

app.use(errorMiddleware)

// ── Start server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'SpottracK API server started')
  try {
    startWorkers()
    startScheduler()
  } catch (err) {
    logger.error({ err }, 'Failed to start workers/scheduler — server still running')
  }
})
