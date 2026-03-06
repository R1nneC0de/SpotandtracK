/**
 * WatchlistSection.tsx
 * Dashboard card that lists the user's watchlist entries and lets them
 * add or remove songs they want to watch for on Spotify.
 */

'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useWatchlist } from '../../hooks/useWatchlist'
import { WatchlistEntryRow } from '../watchlist/WatchlistEntryRow'
import { AddWatchlistModal } from '../watchlist/AddWatchlistModal'

/**
 * WatchlistSection
 * Renders a full-width card with:
 *  - "Watchlists" Orbitron header + green "+" button to open AddWatchlistModal
 *  - Loading spinner while data is being fetched
 *  - Dashed empty state when the list is empty
 *  - WatchlistEntryRow for each entry
 */
export function WatchlistSection() {
  const { data, isLoading, isError } = useWatchlist()

  // Controls visibility of the AddWatchlistModal bottom sheet
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* ── Section header ── */}
        <div className="flex items-center justify-between">
          <span className="font-orbitron font-bold text-xl text-brand-green">
            Watchlists
          </span>

          {/* "+" button — opens the add modal */}
          <button
            onClick={() => setShowModal(true)}
            aria-label="Add watchlist entry"
            className="w-7 h-7 rounded-full bg-brand-green flex items-center justify-center text-black transition-colors duration-150 hover:bg-brand-green/80"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* ── Card body ── */}
        <div className="rounded-2xl border border-surface-cardBorder p-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-brand-green" />
            </div>
          )}

          {/* Error state */}
          {isError && !isLoading && (
            <p className="font-mono text-xs text-text-alert text-center py-4">
              Could not load watchlist. Please refresh.
            </p>
          )}

          {/* Empty state — dashed border inner card */}
          {!isLoading && !isError && data?.entries.length === 0 && (
            <div className="rounded-2xl border border-dashed border-surface-cardBorder p-6 flex flex-col items-center gap-2">
              <span className="font-mono text-xs text-white/40 text-center">
                No songs on your watchlist yet.
              </span>
              <span className="font-mono text-xs text-white/25 text-center">
                Tap + to watch for a song not yet on Spotify.
              </span>
            </div>
          )}

          {/* Entry list */}
          {!isLoading && !isError && (data?.entries.length ?? 0) > 0 && (
            <div>
              {data!.entries.map((entry) => (
                <WatchlistEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AddWatchlistModal — rendered outside the card so it can cover full screen */}
      {showModal && (
        <AddWatchlistModal onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
