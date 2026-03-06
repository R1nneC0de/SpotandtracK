/**
 * WatchlistEntryRow.tsx
 * Renders a single row in the watchlist list.
 * Shows query text + optional artist hint on the left, a resolved/pending
 * badge on the right, and a trash button that fires the remove mutation.
 */

'use client'

import { Trash2 } from 'lucide-react'
import { useRemoveWatchlistEntry } from '../../hooks/useWatchlist'
import type { WatchlistEntryDTO } from '@spotttrack/shared'

interface WatchlistEntryRowProps {
  // The watchlist entry to display
  entry: WatchlistEntryDTO
}

/**
 * WatchlistEntryRow
 * Flex row: rawQuery + artistHint on the left; state badge + delete button on the right.
 * The row bottom-border is suppressed on the last child via `last:border-0`.
 */
export function WatchlistEntryRow({ entry }: WatchlistEntryRowProps) {
  const removeMutation = useRemoveWatchlistEntry()

  function handleRemove() {
    removeMutation.mutate(entry.id)
  }

  return (
    <div className="flex justify-between items-center py-3 border-b border-surface-cardBorder/50 last:border-0">
      {/* ── Left: query text + optional artist hint ── */}
      <div className="flex flex-col min-w-0 pr-3">
        <span className="font-mono text-sm text-white truncate">
          {entry.rawQuery}
        </span>
        {entry.artistHint && (
          <span className="font-mono text-xs text-white/40 truncate">
            {entry.artistHint}
          </span>
        )}
      </div>

      {/* ── Right: state badge + delete button ── */}
      <div className="flex items-center gap-2 shrink-0">
        {entry.resolved ? (
          // "Found" badge — the song has been matched on Spotify
          <span className="rounded-full px-2 py-0.5 text-xs font-mono bg-state-available/20 text-state-available">
            Found
          </span>
        ) : (
          // "Watching" badge — still waiting for a match
          <span className="rounded-full px-2 py-0.5 text-xs font-mono bg-white/10 text-white/40">
            Watching
          </span>
        )}

        {/* Delete button — disabled while a remove request is in flight */}
        <button
          onClick={handleRemove}
          disabled={removeMutation.isPending}
          aria-label={`Remove watchlist entry: ${entry.rawQuery}`}
          className="text-white/30 hover:text-text-alert transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
