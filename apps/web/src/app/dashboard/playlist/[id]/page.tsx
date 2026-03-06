'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { PageShell } from '../../../../../components/layout/PageShell'
import { TrackRow } from '../../../../../components/playlist/TrackRow'
import { StateBadge } from '../../../../../components/playlist/StateBadge'
import { usePlaylistTracks } from '../../../../../hooks/usePlaylists'

export default function PlaylistDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()
  const { data, isLoading, isError } = usePlaylistTracks(id)

  const playlist = data?.playlist
  const tracks = playlist?.tracks ?? []

  const available = tracks.filter((t) => t.state === 'AVAILABLE').length
  const unavailable = tracks.filter((t) => t.state === 'UNAVAILABLE').length
  const removed = tracks.filter((t) => t.state === 'REMOVED').length

  return (
    <PageShell>
      <div className="flex flex-col gap-4">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors duration-150 text-sm font-mono w-fit"
        >
          <ArrowLeft size={14} />
          Dashboard
        </button>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-brand-green" />
          </div>
        )}

        {isError && (
          <p className="font-mono text-sm text-text-alert">
            Playlist not found or not tracked.
          </p>
        )}

        {playlist && (
          <>
            {/* Header */}
            <div className="flex flex-col gap-1">
              <h1 className="font-orbitron font-bold text-xl text-brand-green">
                {playlist.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-white/40">
                  {tracks.length} tracks
                </span>
                {unavailable > 0 && (
                  <StateBadge state="UNAVAILABLE" />
                )}
                {removed > 0 && (
                  <StateBadge state="REMOVED" />
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="rounded-2xl border border-surface-cardBorder p-4 flex justify-between">
              {[
                { label: 'Available', value: available, state: 'AVAILABLE' },
                { label: 'Unavailable', value: unavailable, state: 'UNAVAILABLE' },
                { label: 'Removed', value: removed, state: 'REMOVED' },
              ].map(({ label, value, state }) => (
                <div key={state} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-xl font-bold text-white">{value}</span>
                  <StateBadge state={state as 'AVAILABLE' | 'UNAVAILABLE' | 'REMOVED'} />
                </div>
              ))}
            </div>

            {/* Track list */}
            <div className="rounded-2xl border border-surface-cardBorder p-4 flex flex-col">
              {tracks.length === 0 ? (
                <p className="font-mono text-xs text-white/40 text-center py-4">
                  No tracks yet — snapshot in progress.
                </p>
              ) : (
                tracks.map((track) => (
                  <TrackRow key={track.id} track={track} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
