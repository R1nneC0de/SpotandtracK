/**
 * AddWatchlistModal.tsx
 * Bottom-sheet modal for adding a new watchlist entry.
 * Accepts a song query plus optional artist and title hints,
 * then calls the POST /api/watchlist mutation and closes on success.
 */

'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useAddWatchlistEntry } from '../../hooks/useWatchlist'

interface AddWatchlistModalProps {
  // Called when the modal should be dismissed (cancel or post-success)
  onClose: () => void
}

/**
 * AddWatchlistModal
 * Fixed bottom-sheet overlay. Validates that rawQuery is non-empty before
 * submitting. Closes automatically when the mutation succeeds.
 */
export function AddWatchlistModal({ onClose }: AddWatchlistModalProps) {
  const addMutation = useAddWatchlistEntry()

  // Controlled form state — artistHint and titleHint are optional
  const [rawQuery, setRawQuery] = useState('')
  const [artistHint, setArtistHint] = useState('')
  const [titleHint, setTitleHint] = useState('')

  // Client-side validation error shown below the rawQuery field
  const [queryError, setQueryError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // rawQuery is the only required field per AddWatchlistSchema
    if (!rawQuery.trim()) {
      setQueryError('Please enter a song title or description.')
      return
    }
    setQueryError(null)

    addMutation.mutate(
      {
        rawQuery: rawQuery.trim(),
        // Pass undefined (not empty string) so the backend schema omits the field
        artistHint: artistHint.trim() || undefined,
        titleHint: titleHint.trim() || undefined,
      },
      {
        onSuccess: () => {
          onClose()
        },
      }
    )
  }

  return (
    // Backdrop — clicking outside the sheet closes the modal
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-20"
      onClick={(e) => {
        // Only close if the click landed on the backdrop itself
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-sm bg-surface-darkCard rounded-2xl border border-surface-cardBorder overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-cardBorder">
          <span className="font-orbitron font-bold text-sm text-brand-green">
            Watch for a Song
          </span>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-white/50 hover:text-white transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-4">
          {/* rawQuery — required */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="rawQuery"
              className="font-mono text-xs text-white/60"
            >
              Song title or description
              <span className="text-text-alert ml-0.5">*</span>
            </label>
            <input
              id="rawQuery"
              type="text"
              value={rawQuery}
              onChange={(e) => {
                setRawQuery(e.target.value)
                // Clear validation error as soon as the user starts typing
                if (queryError) setQueryError(null)
              }}
              placeholder="e.g. &quot;that song from the car scene&quot;"
              maxLength={500}
              className="w-full rounded-2xl border border-surface-cardBorder bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green transition-colors duration-150"
            />
            {queryError && (
              <span className="font-mono text-xs text-text-alert">
                {queryError}
              </span>
            )}
          </div>

          {/* artistHint — optional */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="artistHint"
              className="font-mono text-xs text-white/60"
            >
              Artist hint{' '}
              <span className="text-white/30">(optional)</span>
            </label>
            <input
              id="artistHint"
              type="text"
              value={artistHint}
              onChange={(e) => setArtistHint(e.target.value)}
              placeholder="e.g. Radiohead"
              maxLength={200}
              className="w-full rounded-2xl border border-surface-cardBorder bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green transition-colors duration-150"
            />
          </div>

          {/* titleHint — optional */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="titleHint"
              className="font-mono text-xs text-white/60"
            >
              Title hint{' '}
              <span className="text-white/30">(optional)</span>
            </label>
            <input
              id="titleHint"
              type="text"
              value={titleHint}
              onChange={(e) => setTitleHint(e.target.value)}
              placeholder="e.g. Exit Music"
              maxLength={200}
              className="w-full rounded-2xl border border-surface-cardBorder bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green transition-colors duration-150"
            />
          </div>

          {/* Mutation-level error (network / server) */}
          {addMutation.isError && (
            <p className="font-mono text-xs text-text-alert">
              {addMutation.error instanceof Error
                ? addMutation.error.message
                : 'Something went wrong. Please try again.'}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="w-full bg-brand-green text-black font-bold font-mono rounded-full px-8 py-3 text-sm flex items-center justify-center gap-2 transition-colors duration-150 hover:bg-brand-green/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addMutation.isPending && (
              <Loader2 size={15} className="animate-spin" />
            )}
            {addMutation.isPending ? 'Adding…' : 'Add to Watchlist'}
          </button>
        </form>
      </div>
    </div>
  )
}
