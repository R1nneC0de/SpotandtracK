import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const COOKIE_NAME = 'st-session'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds

/**
 * Exchange a one-time auth token for a session.
 * Calls the backend to verify the token and get a long-lived session token.
 * Stores the session token in an httpOnly cookie on the Vercel domain.
 * No Set-Cookie forwarding needed — we own the cookie entirely.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()

  const backendRes = await fetch(`${API_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!backendRes.ok) {
    const err = await backendRes.text()
    return new NextResponse(err, { status: backendRes.status })
  }

  const data = (await backendRes.json()) as { ok: boolean; sessionToken: string }

  // Set the session token as an httpOnly cookie on the Vercel domain
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, data.sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })

  return NextResponse.json({ ok: true })
}
