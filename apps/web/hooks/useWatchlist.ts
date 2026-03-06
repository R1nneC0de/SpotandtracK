/**
 * useWatchlist.ts
 * TanStack Query hooks for reading and mutating the user's watchlist.
 * Covers GET (list), POST (add), and DELETE (remove) via /api/watchlist.
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { WatchlistEntryDTO } from '@spotttrack/shared'
import type { AddWatchlistInput } from '@spotttrack/shared'

// ─── Query Keys ────────────────────────────────────────────────────────────────
// Centralised here so mutations can reliably invalidate the same key.
const WATCHLIST_KEY = ['watchlist'] as const

// ─── Response shape from GET /api/watchlist ────────────────────────────────────
interface WatchlistResponse {
  entries: WatchlistEntryDTO[]
}

/**
 * useWatchlist
 * Fetches all watchlist entries for the current user.
 * staleTime: 0 so the list always reflects the latest server state on focus.
 */
export function useWatchlist() {
  return useQuery<WatchlistResponse>({
    queryKey: WATCHLIST_KEY,
    queryFn: () => apiFetch<WatchlistResponse>('/api/watchlist'),
    staleTime: 0,
  })
}

/**
 * useAddWatchlistEntry
 * Mutation to POST a new entry to /api/watchlist.
 * Invalidates ['watchlist'] on success so the list refetches automatically.
 */
export function useAddWatchlistEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AddWatchlistInput) =>
      apiFetch<WatchlistEntryDTO>('/api/watchlist', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHLIST_KEY })
    },
  })
}

/**
 * useRemoveWatchlistEntry
 * Mutation to DELETE /api/watchlist/:id.
 * Invalidates ['watchlist'] on success so the list refetches automatically.
 */
export function useRemoveWatchlistEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/watchlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHLIST_KEY })
    },
  })
}
