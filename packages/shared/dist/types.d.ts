export type TrackState = 'AVAILABLE' | 'UNAVAILABLE' | 'REMOVED';
export type NotificationType = 'TRACK_UNAVAILABLE' | 'TRACK_REMOVED' | 'TRACK_RETURNED' | 'WATCHLIST_MATCH' | 'MONITORING_PAUSED';
export interface TrackedTrackDTO {
    id: string;
    spotifyTrackId: string;
    name: string;
    artistName: string;
    albumName: string;
    state: TrackState;
    stateChangedAt: string;
    firstSeenAt: string;
}
export interface TrackedPlaylistDTO {
    id: string;
    spotifyId: string;
    name: string;
    coverImageUrl: string | null;
    isTracked: boolean;
    lastSweptAt: string | null;
    tracks?: TrackedTrackDTO[];
}
export interface WatchlistEntryDTO {
    id: string;
    rawQuery: string;
    artistHint: string | null;
    titleHint: string | null;
    resolved: boolean;
    resolvedTrackId: string | null;
    createdAt: string;
}
export interface NotificationDTO {
    id: string;
    type: NotificationType;
    payload: Record<string, unknown>;
    sent: boolean;
    sentAt: string | null;
    createdAt: string;
}
export interface UserDTO {
    id: string;
    spotifyId: string;
    email: string;
    displayName: string;
    monitoringPaused: boolean;
    pauseReason: string | null;
    notificationMode: 'instant' | 'daily_digest';
}
//# sourceMappingURL=types.d.ts.map