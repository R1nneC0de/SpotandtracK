import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '../lib/logger'

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: err.errors })
    return
  }

  const message = err instanceof Error ? err.message : 'Internal server error'
  logger.error({ err, path: req.path, method: req.method }, 'Request error')
  res.status(500).json({ error: message })
}
