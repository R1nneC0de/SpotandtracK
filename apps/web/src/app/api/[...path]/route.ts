import { NextRequest, NextResponse } from 'next/server'

/**
 * Catch-all API proxy that replaces Next.js rewrites for /api/* routes.
 * Runs as a Vercel serverless function so we can explicitly forward
 * Cookie and Set-Cookie headers — Vercel's rewrite proxy silently strips them.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function proxyRequest(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const backendUrl = `${API_URL}${url.pathname}${url.search}`

  const headers: Record<string, string> = {}
  // Forward essential request headers
  const cookie = req.headers.get('cookie')
  if (cookie) headers['Cookie'] = cookie
  const contentType = req.headers.get('content-type')
  if (contentType) headers['Content-Type'] = contentType

  const backendRes = await fetch(backendUrl, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
    redirect: 'manual', // Don't follow redirects — pass them through
  })

  // For redirects, forward them directly to the browser
  if (backendRes.status >= 300 && backendRes.status < 400) {
    const location = backendRes.headers.get('location') ?? '/'
    const response = NextResponse.redirect(location, backendRes.status)
    // Forward Set-Cookie even on redirects
    for (const cookie of backendRes.headers.getSetCookie()) {
      response.headers.append('Set-Cookie', cookie)
    }
    return response
  }

  const data = await backendRes.arrayBuffer()
  const response = new NextResponse(data, {
    status: backendRes.status,
  })

  // Forward content-type
  const resContentType = backendRes.headers.get('content-type')
  if (resContentType) {
    response.headers.set('Content-Type', resContentType)
  }

  // Forward Set-Cookie headers from backend
  for (const cookie of backendRes.headers.getSetCookie()) {
    response.headers.append('Set-Cookie', cookie)
  }

  return response
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
export const DELETE = proxyRequest
