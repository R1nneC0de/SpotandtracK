import { z } from 'zod'

export const AddWatchlistSchema = z.object({
  rawQuery: z.string().min(1).max(500),
  artistHint: z.string().max(200).optional(),
  titleHint: z.string().max(200).optional(),
})

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type AddWatchlistInput = z.infer<typeof AddWatchlistSchema>
