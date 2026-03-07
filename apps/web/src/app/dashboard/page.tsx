'use client'

/**
 * dashboard/page.tsx
 * Main dashboard page. Composes the notification banner, playlist strip,
 * and watchlist section. Handles auth redirect and monitoring-paused state.
 */

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { PageShell } from '../../../components/layout/PageShell'
import { NotificationBanner } from '../../../components/dashboard/NotificationBanner'
import { TrackedPlaylists } from '../../../components/dashboard/TrackedPlaylists'
import { WatchlistSection } from '../../../components/dashboard/WatchlistSection'
import { useUser } from '../../../hooks/useUser'
import { useTrackedPlaylists } from '../../../hooks/usePlaylists'

export default function DashboardPage() {
  const router = useRouter()
  const { data: user, isLoading: userLoading, isError: userError } = useUser()
  const { data: playlistData, isLoading: playlistsLoading } = useTrackedPlaylists()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userLoading && userError) {
      router.replace('/')
    }
  }, [userLoading, userError, router])

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-brand-green" />
      </div>
    )
  }

  if (!user) return null

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        {/* Phase 7: Monitoring paused banner — shown when the user's Spotify
            OAuth token has been revoked and the sweep worker set monitoringPaused.
            Clicking Reconnect re-runs the full OAuth flow to obtain fresh tokens. */}
        {user.monitoringPaused && (
          <div className="rounded-2xl border border-text-alert bg-text-alertBg p-4 flex items-center justify-between gap-3">
            {/* Left: warning icon + explanation */}
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle size={18} className="text-text-alert shrink-0" />
              <span className="font-mono text-sm text-white">
                Monitoring paused — your Spotify connection expired.
              </span>
            </div>

            {/* Right: OAuth reconnect link — triggers the same flow as the login page */}
            <a
              href="/api/auth/spotify"
              className="font-mono text-sm font-bold text-brand-green underline shrink-0"
            >
              Reconnect
            </a>
          </div>
        )}

        <NotificationBanner />

        {playlistsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin text-brand-green" />
          </div>
        ) : (
          <TrackedPlaylists playlists={playlistData?.playlists ?? []} />
        )}

        <WatchlistSection />
      </div>
    </PageShell>
  )
}
