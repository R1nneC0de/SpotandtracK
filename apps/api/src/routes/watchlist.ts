import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { asyncHandler } from '../lib/async-handler'
import { AddWatchlistSchema } from '@spotttrack/shared'
import {
  addWatchlistEntry,
  removeWatchlistEntry,
  getWatchlistEntries,
} from '../services/watchlist.service'

const router: import("express").Router = Router()

router.use(requireAuth)

/**
 * GET /api/watchlist
 * Returns all watchlist entries for the authenticated user, newest first.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.session!.userId
    const entries = await getWatchlistEntries(userId)
    res.json({ entries })
  })
)

/**
 * POST /api/watchlist
 * Adds a new watchlist entry. The entry will be checked by the watchlist sweep job.
 * Returns 201 with the created entry.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parse = AddWatchlistSchema.safeParse(req.body)
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid request body', details: parse.error.flatten() })
      return
    }

    const userId = req.session!.userId
    const entry = await addWatchlistEntry(userId, parse.data)
    res.status(201).json({ entry })
  })
)

/**
 * DELETE /api/watchlist/:id
 * Removes a watchlist entry. Returns 404 if the entry doesn't exist or belongs
 * to a different user — we return 404 (not 403) to avoid leaking ownership info.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.session!.userId
    const { id } = req.params

    const deleted = await removeWatchlistEntry(userId, id)
    if (!deleted) {
      res.status(404).json({ error: 'Watchlist entry not found' })
      return
    }

    res.status(204).send()
  })
)

export default router
