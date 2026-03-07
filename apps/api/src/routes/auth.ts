import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { encrypt } from '../lib/crypto'
import { asyncHandler } from '../lib/async-handler'
import { requireAuth } from '../middleware/auth.middleware'
import { logger } from '../lib/logger'

const router: import("express").Router = Router()

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_SCOPES =
  'playlist-read-private playlist-read-collaborative user-read-email'

router.get('/spotify', (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI ?? '',
    scope: SPOTIFY_SCOPES,
    show_dialog: 'true',
  })
  res.redirect(`${SPOTIFY_AUTH_URL}?${params.toString()}`)
})

router.get(
  '/spotify/callback',
  asyncHandler(async (req, res) => {
    const { code, error } = req.query as Record<string, string>
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000'

    if (error || !code) {
      logger.warn({ error }, 'Spotify OAuth error')
      res.redirect(`${webUrl}/?error=${encodeURIComponent(error ?? 'oauth_failed')}`)
      return
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI ?? '',
      client_id: process.env.SPOTIFY_CLIENT_ID ?? '',
      client_secret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
    })

    const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`)
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!profileRes.ok) {
      throw new Error('Failed to fetch Spotify profile')
    }

    const profile = (await profileRes.json()) as {
      id: string
      email: string
      display_name: string
      country?: string
    }

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    const market = profile.country ?? 'US'

    const user = await prisma.user.upsert({
      where: { spotifyId: profile.id },
      update: {
        email: profile.email,
        displayName: profile.display_name,
        market,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt,
        monitoringPaused: false,
        pauseReason: null,
      },
      create: {
        spotifyId: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        market,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt,
      },
    })

    req.session!.userId = user.id
    logger.info({ userId: user.id, spotifyId: profile.id }, 'User logged in')
    res.redirect(`${webUrl}/dashboard`)
  })
)

router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    req.session = null
    res.json({ ok: true })
  })
)

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.session!.userId },
      select: {
        id: true,
        spotifyId: true,
        email: true,
        displayName: true,
        monitoringPaused: true,
        pauseReason: true,
        notificationMode: true,
      },
    })
    res.json(user)
  })
)

// Defined locally — not shared with the frontend, so no entry in shared/schemas.ts
const UpdateSettingsSchema = z.object({
  notificationMode: z.enum(['instant', 'daily_digest']),
})

router.patch(
  '/settings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = UpdateSettingsSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
      return
    }

    const { notificationMode } = result.data

    const updated = await prisma.user.update({
      where: { id: req.session!.userId },
      data: { notificationMode },
      select: { notificationMode: true },
    })

    logger.info({ userId: req.session!.userId, notificationMode }, 'User updated notification mode')
    res.json({ notificationMode: updated.notificationMode })
  })
)

export default router
