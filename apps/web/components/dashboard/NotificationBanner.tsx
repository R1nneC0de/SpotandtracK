'use client'

import { useUser } from '../../hooks/useUser'
import { useNotifications } from '../../hooks/useNotifications'
import type { NotificationDTO } from '@spotttrack/shared'

const ALERT_WORDS = ['unavailable', 'removed', 'unplayable', 'missing', 'paused', 'expired']

function highlightAlerts(text: string) {
  const regex = new RegExp(`(${ALERT_WORDS.join('|')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} className="text-text-alert bg-text-alertBg rounded-sm px-0.5">
        {part}
      </span>
    ) : (
      part
    )
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function notificationMessage(n: NotificationDTO): string {
  const p = n.payload as Record<string, string>
  switch (n.type) {
    case 'TRACK_UNAVAILABLE':
      return `"${p.trackName}" by ${p.artistName} in "${p.playlistName}" is temporarily unavailable.`
    case 'TRACK_REMOVED':
      return `"${p.trackName}" by ${p.artistName} was removed from Spotify.`
    case 'TRACK_RETURNED':
      return `"${p.trackName}" by ${p.artistName} is available again on Spotify.`
    case 'WATCHLIST_MATCH':
      return `"${p.trackName}" by ${p.artistName} just appeared on Spotify — check your watchlist.`
    case 'MONITORING_PAUSED':
      return 'Your Spotify connection expired. Monitoring is paused — reconnect to resume.'
    default:
      return 'You have a new notification.'
  }
}

export function NotificationBanner() {
  const { data: userData } = useUser()
  const { data: notifData } = useNotifications()

  const latest = notifData?.notifications?.[0]

  return (
    <div className="rounded-2xl border border-surface-cardBorder p-4 flex flex-col gap-2">
      {userData && (
        <span className="font-orbitron text-lg text-brand-green underline">
          Welcome {userData.displayName}
        </span>
      )}
      <p className="font-mono text-sm text-white/80">
        {latest ? (
          <>
            {highlightAlerts(notificationMessage(latest))}
            <span className="block text-xs text-white/30 mt-1">
              {formatDate(latest.createdAt)}
            </span>
          </>
        ) : (
          <span className="text-white/40">All your playlists are being monitored.</span>
        )}
      </p>
    </div>
  )
}
