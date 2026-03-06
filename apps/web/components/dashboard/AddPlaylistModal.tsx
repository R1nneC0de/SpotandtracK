'use client'

import { X, Plus, Minus, Loader2 } from 'lucide-react'
import { useAllPlaylists, useTrackPlaylist, useUntrackPlaylist } from '../../hooks/usePlaylists'
import type { TrackedPlaylistDTO } from '@spotttrack/shared'

interface Props {
  trackedPlaylists: TrackedPlaylistDTO[]
  onClose: () => void
}

export function AddPlaylistModal({ trackedPlaylists, onClose }: Props) {
  const { data, isLoading } = useAllPlaylists()
  const trackMutation = useTrackPlaylist()
  const untrackMutation = useUntrackPlaylist()

  const trackedIds = new Set(trackedPlaylists.map((p) => p.spotifyId))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-20">
      <div className="w-full max-w-sm bg-surface-darkCard rounded-2xl border border-surface-cardBorder overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-cardBorder">
          <span className="font-orbitron font-bold text-sm text-brand-green">
            Browse Playlists
          </span>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors duration-150">
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-80">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-brand-green" />
            </div>
          )}
          {data?.playlists.map((playlist) => {
            const isTracked = trackedIds.has(playlist.spotifyId)
            const isPending =
              trackMutation.isPending || untrackMutation.isPending
            return (
              <div
                key={playlist.spotifyId}
                className="flex items-center justify-between px-4 py-3 border-b border-surface-cardBorder/50 last:border-0"
              >
                <div className="flex flex-col min-w-0 pr-3">
                  <span className="font-mono text-sm text-white truncate">{playlist.name}</span>
                  {isTracked && (
                    <span className="font-mono text-xs text-brand-green/60">Tracked</span>
                  )}
                </div>
                <button
                  disabled={isPending}
                  onClick={() => {
                    if (isTracked) {
                      untrackMutation.mutate(playlist.spotifyId)
                    } else {
                      trackMutation.mutate(playlist.spotifyId)
                    }
                  }}
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150 ${
                    isTracked
                      ? 'bg-state-removed/20 text-state-removed hover:bg-state-removed/40'
                      : 'bg-brand-green/20 text-brand-green hover:bg-brand-green/40'
                  }`}
                >
                  {isTracked ? <Minus size={14} /> : <Plus size={14} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
