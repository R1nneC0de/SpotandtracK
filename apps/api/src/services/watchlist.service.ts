import { WatchlistEntry } from '@prisma/client'
import { AddWatchlistInput } from '@spotttrack/shared'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'

/**
 * Creates a new watchlist entry for the user.
 * The entry starts unresolved — the watchlist sweep job will check Spotify for a match.
 */
export async function addWatchlistEntry(
  userId: string,
  input: AddWatchlistInput
): Promise<WatchlistEntry> {
  const entry = await prisma.watchlistEntry.create({
    data: {
      userId,
      rawQuery: input.rawQuery,
      artistHint: input.artistHint ?? null,
      titleHint: input.titleHint ?? null,
    },
  })

  logger.info({ userId, entryId: entry.id }, 'Watchlist entry created')
  return entry
}

/**
 * Removes a watchlist entry only if it belongs to the requesting user.
 * Returns null if the entry doesn't exist or is owned by a different user,
 * so the route layer can respond with 404 without leaking ownership information.
 */
export async function removeWatchlistEntry(
  userId: string,
  entryId: string
): Promise<WatchlistEntry | null> {
  // Fetch first to verify ownership before deleting — a blind deleteMany
  // would silently succeed even if the entry belonged to another user
  const entry = await prisma.watchlistEntry.findUnique({
    where: { id: entryId },
  })

  if (!entry || entry.userId !== userId) {
    return null
  }

  await prisma.watchlistEntry.delete({ where: { id: entryId } })

  logger.info({ userId, entryId }, 'Watchlist entry removed')
  return entry
}

/**
 * Returns all watchlist entries for the user, newest first.
 */
export async function getWatchlistEntries(userId: string): Promise<WatchlistEntry[]> {
  return prisma.watchlistEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}
