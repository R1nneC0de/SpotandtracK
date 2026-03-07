import { NextRequest, NextResponse } from 'next/server'
import https from 'node:https'
import http from 'node:http'

/**
 * Dedicated API route for /api/auth/me.
 * Uses Node.js http module to guarantee Cookie header is forwarded properly.
 */
export async function GET(req: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const target = new URL(`${apiUrl}/api/auth/me`)
  const client = target.protocol === 'https:' ? https : http
  const cookie = req.headers.get('cookie') ?? ''

  return new Promise<NextResponse>((resolve) => {
    const proxyReq = client.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname,
        method: 'GET',
        headers: { Cookie: cookie },
      },
      (proxyRes) => {
        let data = ''
        proxyRes.on('data', (chunk: Buffer) => (data += chunk.toString()))
        proxyRes.on('end', () => {
          resolve(
            new NextResponse(data, {
              status: proxyRes.statusCode ?? 500,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        })
      }
    )

    proxyReq.on('error', (err) => {
      resolve(
        NextResponse.json(
          { error: 'Proxy error', detail: err.message },
          { status: 502 }
        )
      )
    })

    proxyReq.end()
  })
}
