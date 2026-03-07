import { Request, Response, NextFunction } from 'express'

// Augment cookie-session's session object with our userId field
declare module 'express' {
  interface Request {
    session: {
      userId?: string
      [key: string]: unknown
    } | null
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
