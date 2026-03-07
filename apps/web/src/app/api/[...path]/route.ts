import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Catch-all API proxy for /api/* routes.
 * Reads the session token from our httpOnly cookie (set by /api/auth/session)
 * and forwards it as an Authorization: Bearer header to the backend.
 * No cookie forwarding needed — the backend accepts the Bearer token directly.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const COOKIE_NAME = 'st-session'

async function proxyRequest(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const backendUrl = `${API_URL}${url.pathname}${url.search}`

  const headers: Record<string, string> = {}

  // Read our session cookie and convert to Authorization header
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`
  }

  // Forward content-type for POST/PUT/PATCH
  const contentType = req.headers.get('content-type')
  if (contentType) headers['Content-Type'] = contentType

  const backendRes = await fetch(backendUrl, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
    redirect: 'manual',
  })

  // For redirects, forward them to the browser
  if (backendRes.status >= 300 && backendRes.status < 400) {
    const location = backendRes.headers.get('location') ?? '/'
    return NextResponse.redirect(location, backendRes.status)
  }

  const data = await backendRes.arrayBuffer()
  const response = new NextResponse(data, { status: backendRes.status })

  const resContentType = backendRes.headers.get('content-type')
  if (resContentType) {
    response.headers.set('Content-Type', resContentType)
  }

  return response
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
export const DELETE = proxyRequest
