-- CreateEnum
CREATE TYPE "TrackState" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'REMOVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TRACK_UNAVAILABLE', 'TRACK_REMOVED', 'TRACK_RETURNED', 'WATCHLIST_MATCH', 'MONITORING_PAUSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "monitoringPaused" BOOLEAN NOT NULL DEFAULT false,
    "pauseReason" TEXT,
    "notificationMode" TEXT NOT NULL DEFAULT 'instant',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedPlaylist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "isTracked" BOOLEAN NOT NULL DEFAULT true,
    "lastSweptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedPlaylist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedTrack" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "spotifyTrackId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "albumName" TEXT NOT NULL,
    "state" "TrackState" NOT NULL DEFAULT 'AVAILABLE',
    "consecutiveMisses" INTEGER NOT NULL DEFAULT 0,
    "stateChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackStateHistory" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "fromState" "TrackState" NOT NULL,
    "toState" "TrackState" NOT NULL,
    "reason" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackStateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawQuery" TEXT NOT NULL,
    "artistHint" TEXT,
    "titleHint" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedTrackId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "WatchlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_spotifyId_key" ON "User"("spotifyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedPlaylist_userId_spotifyId_key" ON "TrackedPlaylist"("userId", "spotifyId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedTrack_playlistId_spotifyTrackId_key" ON "TrackedTrack"("playlistId", "spotifyTrackId");

-- AddForeignKey
ALTER TABLE "TrackedPlaylist" ADD CONSTRAINT "TrackedPlaylist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedTrack" ADD CONSTRAINT "TrackedTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "TrackedPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackStateHistory" ADD CONSTRAINT "TrackStateHistory_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "TrackedTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistEntry" ADD CONSTRAINT "WatchlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
