import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../routes/auth'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // 1. Check cookie-session (direct access / local dev)
  if (req.session?.userId) {
    next()
    return
  }

  // 2. Check Authorization: Bearer <sessionToken> (Vercel proxy)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const userId = verifyToken(token)
    if (userId) {
      // Populate session so downstream handlers can use req.session.userId as usual
      req.session!.userId = userId
      next()
      return
    }
  }

  res.status(401).json({ error: 'Unauthorized' })
}
