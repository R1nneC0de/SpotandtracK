import { Job } from 'bullmq'
import { logger } from '../lib/logger'
import { sendNotificationEmail } from '../services/notification.service'

/**
 * BullMQ processor for the `notifications` queue.
 * Receives only a `notificationId` — all payload/recipient data is fetched
 * from the DB inside `sendNotificationEmail`. This keeps the queue lean and
 * avoids stale data issues on retry.
 */
export async function runNotificationJob(job: Job<{ notificationId: string }>): Promise<void> {
  const { notificationId } = job.data

  if (!notificationId) {
    // A job without an ID cannot be retried meaningfully — log and bail
    logger.error({ jobId: job.id, jobName: job.name }, 'Notification job missing notificationId')
    return
  }

  logger.info({ jobId: job.id, notificationId }, 'Processing notification job')

  await sendNotificationEmail(notificationId)
}
