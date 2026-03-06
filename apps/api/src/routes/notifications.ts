import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { asyncHandler } from '../lib/async-handler'
import { prisma } from '../lib/prisma'
import { PaginationSchema } from '@spotttrack/shared'
import type { NotificationDTO } from '@spotttrack/shared'

const router = Router()

router.use(requireAuth)

/**
 * GET /api/notifications
 * Returns the authenticated user's notifications, newest first, paginated.
 * Default: page 1, limit 20. Max limit 100 (enforced by PaginationSchema).
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parseResult = PaginationSchema.safeParse(req.query)
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parseResult.error.flatten() })
      return
    }

    const { page, limit } = parseResult.data
    const userId = req.session.userId!
    const skip = (page - 1) * limit

    // Run count and data fetch in parallel — both use the same filter, no join needed
    const [total, records] = await Promise.all([
      prisma.notification.count({ where: { userId } }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const notifications: NotificationDTO[] = records.map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payload as Record<string, unknown>,
      sent: n.sent,
      sentAt: n.sentAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }))

    res.json({ notifications, total, page, limit })
  })
)

export default router
