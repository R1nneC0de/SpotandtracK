import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.middleware'
import { asyncHandler } from '../lib/async-handler'
import {
  getUserPlaylists,
  trackPlaylist,
  untrackPlaylist,
  getTrackedPlaylists,
  getPlaylistTracks,
} from '../services/playlist.service'

const router: import("express").Router = Router()

router.use(requireAuth)

/** GET /api/playlists — live fetch from Spotify */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const playlists = await getUserPlaylists(req.session.userId!)
    res.json({ playlists })
  })
)

/** GET /api/playlists/tracked — tracked playlists + track states from DB */
router.get(
  '/tracked',
  asyncHandler(async (req, res) => {
    const playlists = await getTrackedPlaylists(req.session.userId!)
    res.json({ playlists })
  })
)

/** GET /api/playlists/:spotifyId/tracks — tracks + states for one playlist */
router.get(
  '/:spotifyId/tracks',
  asyncHandler(async (req, res) => {
    const { spotifyId } = req.params
    const playlist = await getPlaylistTracks(req.session.userId!, spotifyId)
    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found or not tracked' })
      return
    }
    res.json({ playlist })
  })
)

/** POST /api/playlists/:spotifyId/track — start tracking */
router.post(
  '/:spotifyId/track',
  asyncHandler(async (req, res) => {
    const { spotifyId } = z
      .object({ spotifyId: z.string().min(1) })
      .parse(req.params)

    const playlist = await trackPlaylist(req.session.userId!, spotifyId)
    res.status(201).json({ playlist })
  })
)

/** DELETE /api/playlists/:spotifyId/track — stop tracking */
router.delete(
  '/:spotifyId/track',
  asyncHandler(async (req, res) => {
    const { spotifyId } = z
      .object({ spotifyId: z.string().min(1) })
      .parse(req.params)

    const playlist = await untrackPlaylist(req.session.userId!, spotifyId)
    if (!playlist) {
      res.status(404).json({ error: 'Playlist not tracked' })
      return
    }
    res.json({ ok: true })
  })
)

export default router
