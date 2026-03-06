'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PlaylistTile } from './PlaylistTile'
import { AddPlaylistModal } from './AddPlaylistModal'
import type { TrackedPlaylistDTO } from '@spotttrack/shared'

interface Props {
  playlists: TrackedPlaylistDTO[]
}

export function TrackedPlaylists({ playlists }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-orbitron font-bold text-xl text-brand-green">Playlists</span>
          <button
            onClick={() => setModalOpen(true)}
            className="w-7 h-7 rounded-full bg-brand-green flex items-center justify-center text-black transition-colors duration-150 hover:bg-brand-green/80"
            aria-label="Add playlist"
          >
            <Plus size={16} />
          </button>
        </div>

        {playlists.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-cardBorder p-6 flex flex-col items-center gap-2">
            <span className="font-mono text-xs text-white/40 text-center">
              No playlists tracked yet.
            </span>
            <button
              onClick={() => setModalOpen(true)}
              className="font-mono text-xs text-brand-green underline"
            >
              Add your first playlist
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto flex gap-3 pb-2 -mx-4 px-4">
            {playlists.map((p) => (
              <PlaylistTile key={p.id} playlist={p} />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <AddPlaylistModal
          trackedPlaylists={playlists}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
