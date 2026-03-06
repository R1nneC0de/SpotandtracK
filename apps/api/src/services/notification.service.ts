import { Resend } from 'resend'
import { NotificationType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { notificationsQueue } from '../jobs/queues'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? 'notifications@spotttrack.com'
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Payload shapes per notification type
// ---------------------------------------------------------------------------

interface TrackPayload {
  trackName: string
  artistName: string
  playlistName: string
  detectedAt: string
  reason?: string | null
}

interface WatchlistPayload {
  trackName: string
  artistName: string
  detectedAt: string
}

interface MonitoringPausedPayload {
  detectedAt: string
}

// ---------------------------------------------------------------------------
// Email template builders — inline styles only; no Tailwind in emails
// ---------------------------------------------------------------------------

function buildEmailWrapper(title: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background:#0D0D0D;font-family:monospace,monospace;color:#E0E0E0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:32px 0;">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#1A001A;border:1px solid rgba(204,0,204,0.40);border-radius:16px;padding:32px;">
              <tr>
                <td>
                  <!-- Logo -->
                  <p style="margin:0 0 24px;font-size:24px;font-weight:700;color:#CC00CC;letter-spacing:2px;">
                    Spot&nbsp;<span style="color:#1DB954;">&#9679;</span>&nbsp;tracK
                  </p>
                  ${body}
                  <!-- Footer -->
                  <hr style="border:none;border-top:1px solid rgba(204,0,204,0.20);margin:24px 0;" />
                  <p style="margin:0;font-size:11px;color:#666;">
                    You're receiving this because you track playlists on
                    <a href="${WEB_URL}" style="color:#1DB954;text-decoration:none;">Spot tracK</a>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `.trim()
}

function trackUnavailableTemplate(payload: TrackPayload): { subject: string; html: string } {
  const subject = `A song in ${payload.playlistName} is no longer available`
  const html = buildEmailWrapper(subject, `
    <h2 style="margin:0 0 8px;font-size:18px;color:#FF4444;">Temporarily Unavailable</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#E0E0E0;">
      A song in your tracked playlist is no longer playable in your region.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:rgba(255,0,0,0.10);border:1px solid rgba(255,68,68,0.30);border-radius:8px;padding:16px;width:100%;margin-bottom:16px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">TRACK</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#E0E0E0;">${payload.trackName}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">ARTIST</p>
        <p style="margin:0 0 12px;font-size:14px;color:#E0E0E0;">${payload.artistName}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">PLAYLIST</p>
        <p style="margin:0 0 12px;font-size:14px;color:#E0E0E0;">${payload.playlistName}</p>
        ${payload.reason ? `<p style="margin:0 0 4px;font-size:12px;color:#888;">REASON</p>
        <p style="margin:0 0 12px;font-size:14px;color:#FF4444;">${payload.reason}</p>` : ''}
        <p style="margin:0 0 4px;font-size:12px;color:#888;">DETECTED</p>
        <p style="margin:0;font-size:13px;color:#E0E0E0;">${payload.detectedAt}</p>
      </td></tr>
    </table>
    <a href="${WEB_URL}/dashboard" style="display:inline-block;background:#1DB954;color:#000;font-weight:700;font-size:14px;padding:12px 24px;border-radius:9999px;text-decoration:none;">
      View in Spot tracK
    </a>
  `)
  return { subject, html }
}

function trackRemovedTemplate(payload: TrackPayload): { subject: string; html: string } {
  const subject = 'A song was removed from Spotify'
  const html = buildEmailWrapper(subject, `
    <h2 style="margin:0 0 8px;font-size:18px;color:#FF4444;">Song Removed</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#E0E0E0;">
      A song from your tracked playlist has been fully removed from Spotify.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:rgba(255,0,0,0.10);border:1px solid rgba(255,68,68,0.30);border-radius:8px;padding:16px;width:100%;margin-bottom:16px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">TRACK</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#E0E0E0;">${payload.trackName}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">ARTIST</p>
        <p style="margin:0 0 12px;font-size:14px;color:#E0E0E0;">${payload.artistName}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">PLAYLIST</p>
        <p style="margin:0 0 12px;font-size:14px;color:#E0E0E0;">${payload.playlistName}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">DETECTED</p>
        <p style="margin:0;font-size:13px;color:#E0E0E0;">${payload.detectedAt}</p>
      </td></tr>
    </table>
    <a href="${WEB_URL}/dashboard" style="display:inline-block;background:#1DB954;color:#000;font-weight:700;font-size:14px;padding:12px 24px;border-radius:9999px;text-decoration:none;">
      View in Spot tracK
    </a>
  `)
  return { subject, html }
}

function trackReturnedTemplate(payload: TrackPayload): { subject: string; html: string } {
  const subject = `${payload.trackName} is available again on Spotify`
  const html = buildEmailWrapper(subject, `
    <h2 style="margin:0 0 8px;font-size:18px;color:#1DB954;">Song Returned</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#E0E0E0;">
      Good news — a song you were tracking is available again on Spotify.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:rgba(29,185,84,0.10);border:1px solid rgba(29,185,84,0.30);border-radius:8px;padding:16px;width:100%;margin-bottom:16px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">TRACK</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#E0E0E0;">${payload.trackName}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">ARTIST</p>
        <p style="margin:0 0 12px;font-size:14px;color:#E0E0E0;">${payload.artistName}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">PLAYLIST</p>
        <p style="margin:0 0 12px;font-size:14px;color:#E0E0E0;">${payload.playlistName}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">DETECTED</p>
        <p style="margin:0;font-size:13px;color:#E0E0E0;">${payload.detectedAt}</p>
      </td></tr>
    </table>
    <a href="${WEB_URL}/dashboard" style="display:inline-block;background:#1DB954;color:#000;font-weight:700;font-size:14px;padding:12px 24px;border-radius:9999px;text-decoration:none;">
      Listen Now
    </a>
  `)
  return { subject, html }
}

function watchlistMatchTemplate(payload: WatchlistPayload): { subject: string; html: string } {
  const subject = 'A song you were watching just appeared on Spotify'
  const html = buildEmailWrapper(subject, `
    <h2 style="margin:0 0 8px;font-size:18px;color:#1DB954;">Watchlist Match Found</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#E0E0E0;">
      A song from your watchlist just appeared on Spotify.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:rgba(29,185,84,0.10);border:1px solid rgba(29,185,84,0.30);border-radius:8px;padding:16px;width:100%;margin-bottom:16px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">TRACK</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#E0E0E0;">${payload.trackName}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">ARTIST</p>
        <p style="margin:0 0 12px;font-size:14px;color:#E0E0E0;">${payload.artistName}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">DETECTED</p>
        <p style="margin:0;font-size:13px;color:#E0E0E0;">${payload.detectedAt}</p>
      </td></tr>
    </table>
    <a href="${WEB_URL}/dashboard" style="display:inline-block;background:#1DB954;color:#000;font-weight:700;font-size:14px;padding:12px 24px;border-radius:9999px;text-decoration:none;">
      View Watchlist
    </a>
  `)
  return { subject, html }
}

function monitoringPausedTemplate(
  displayName: string,
  payload: MonitoringPausedPayload
): { subject: string; html: string } {
  const subject = 'Spot tracK: Your monitoring has been paused'
  const html = buildEmailWrapper(subject, `
    <h2 style="margin:0 0 8px;font-size:18px;color:#FF4444;">Monitoring Paused</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#E0E0E0;">
      Hi ${displayName}, your Spotify connection has expired or been revoked.
      Spot tracK has paused monitoring your playlists until you reconnect.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:rgba(255,0,0,0.10);border:1px solid rgba(255,68,68,0.30);border-radius:8px;padding:16px;width:100%;margin-bottom:16px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:12px;color:#888;">PAUSED AT</p>
        <p style="margin:0;font-size:13px;color:#E0E0E0;">${payload.detectedAt}</p>
      </td></tr>
    </table>
    <a href="${WEB_URL}" style="display:inline-block;background:#CC00CC;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:9999px;text-decoration:none;">
      Reconnect Spotify
    </a>
  `)
  return { subject, html }
}

// ---------------------------------------------------------------------------
// Template dispatcher — resolves the right template from notification type
// ---------------------------------------------------------------------------

function renderEmail(
  type: NotificationType,
  payload: Record<string, unknown>,
  user: { displayName: string }
): { subject: string; html: string } {
  switch (type) {
    case 'TRACK_UNAVAILABLE':
      return trackUnavailableTemplate(payload as unknown as TrackPayload)
    case 'TRACK_REMOVED':
      return trackRemovedTemplate(payload as unknown as TrackPayload)
    case 'TRACK_RETURNED':
      return trackReturnedTemplate(payload as unknown as TrackPayload)
    case 'WATCHLIST_MATCH':
      return watchlistMatchTemplate(payload as unknown as WatchlistPayload)
    case 'MONITORING_PAUSED':
      return monitoringPausedTemplate(user.displayName, payload as unknown as MonitoringPausedPayload)
    default: {
      // Exhaustiveness guard — TypeScript will catch unhandled enum variants at compile time
      const _exhaustive: never = type
      throw new Error(`Unknown notification type: ${String(_exhaustive)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a Notification record in the DB and enqueues a BullMQ job.
 * The DB record is the source of truth for retry safety — `sent=false` until
 * the worker successfully delivers. The queue job carries only the record ID.
 */
export async function enqueueNotification(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>
): Promise<void> {
  const notification = await prisma.notification.create({
    // Prisma's Json field requires InputJsonValue — cast from Record<string, unknown>
    data: { userId, type, payload: payload as Prisma.InputJsonObject },
  })

  await notificationsQueue.add(type, { notificationId: notification.id })

  logger.info(
    { notificationId: notification.id, type, userId },
    'Notification record created and job enqueued'
  )
}

/**
 * Fetches the Notification + User from DB, renders the correct email template,
 * sends via Resend, then marks the record sent.
 * Called exclusively from the BullMQ notification worker — never inline.
 */
export async function sendNotificationEmail(notificationId: string): Promise<void> {
  const notification = await prisma.notification.findUniqueOrThrow({
    where: { id: notificationId },
    include: { user: true },
  })

  // Idempotency guard — if a worker retry fires after a partial success,
  // avoid sending the same email twice
  if (notification.sent) {
    logger.info({ notificationId }, 'Notification already sent — skipping duplicate delivery')
    return
  }

  const { subject, html } = renderEmail(
    notification.type,
    notification.payload as Record<string, unknown>,
    { displayName: notification.user.displayName }
  )

  // Email address is sensitive — log only at debug level per CLAUDE.md
  logger.debug({ notificationId, type: notification.type }, 'Sending notification email')

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: notification.user.email,
    subject,
    html,
  })

  if (error) {
    // Let BullMQ retry handle this — log the Resend error detail but do not
    // update `sent` so the record stays in a retriable state
    logger.error(
      { notificationId, type: notification.type, resendError: error.message },
      'Resend delivery failed — will retry'
    )
    throw new Error(`Resend error: ${error.message}`)
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { sent: true, sentAt: new Date() },
  })

  logger.info(
    { notificationId, type: notification.type },
    'Notification email sent successfully'
  )
}
