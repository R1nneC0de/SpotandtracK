'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { TrackedPlaylistDTO } from '@spotttrack/shared'

interface SpotifyPlaylistItem {
  spotifyId: string
  name: string
  coverImageUrl: string | null
  trackTotal: number
}

export function useTrackedPlaylists() {
  return useQuery<{ playlists: TrackedPlaylistDTO[] }>({
    queryKey: ['playlists', 'tracked'],
    queryFn: () => apiFetch('/api/playlists/tracked'),
    staleTime: 0,
  })
}

export function useAllPlaylists() {
  return useQuery<{ playlists: SpotifyPlaylistItem[] }>({
    queryKey: ['playlists', 'all'],
    queryFn: () => apiFetch('/api/playlists'),
    staleTime: 60_000,
  })
}

export function usePlaylistTracks(spotifyId: string) {
  return useQuery({
    queryKey: ['playlists', spotifyId, 'tracks'],
    queryFn: () => apiFetch<{ playlist: TrackedPlaylistDTO & { tracks: TrackWithHistory[] } }>(
      `/api/playlists/${spotifyId}/tracks`
    ),
    enabled: !!spotifyId,
    staleTime: 0,
  })
}

export interface TrackWithHistory {
  id: string
  spotifyTrackId: string
  name: string
  artistName: string
  albumName: string
  state: 'AVAILABLE' | 'UNAVAILABLE' | 'REMOVED'
  stateChangedAt: string
  firstSeenAt: string
  consecutiveMisses: number
  stateHistory: {
    fromState: string
    toState: string
    reason: string | null
    detectedAt: string
  }[]
}

export function useTrackPlaylist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (spotifyId: string) =>
      apiFetch(`/api/playlists/${spotifyId}/track`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists', 'tracked'] })
      queryClient.invalidateQueries({ queryKey: ['playlists', 'all'] })
    },
  })
}

export function useUntrackPlaylist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (spotifyId: string) =>
      apiFetch(`/api/playlists/${spotifyId}/track`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists', 'tracked'] })
      queryClient.invalidateQueries({ queryKey: ['playlists', 'all'] })
    },
  })
}
