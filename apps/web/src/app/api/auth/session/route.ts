import { NextRequest, NextResponse } from 'next/server'
import https from 'node:https'
import http from 'node:http'

/**
 * Dedicated API route for the session exchange.
 * Uses Node.js http module (not fetch) to get rawHeaders — this guarantees
 * Set-Cookie headers are preserved individually. The Fetch API's Headers
 * object may merge or drop Set-Cookie in some runtimes.
 *
 * This route takes precedence over the [...path] catch-all for /api/auth/session.
 */
export async function POST(req: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const body = await req.text()
  const target = new URL(`${apiUrl}/api/auth/session`)
  const client = target.protocol === 'https:' ? https : http

  return new Promise<NextResponse>((resolve) => {
    const proxyReq = client.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (proxyRes) => {
        let data = ''
        proxyRes.on('data', (chunk: Buffer) => (data += chunk.toString()))
        proxyRes.on('end', () => {
          const response = new NextResponse(data, {
            status: proxyRes.statusCode ?? 500,
            headers: { 'Content-Type': 'application/json' },
          })

          // rawHeaders preserves each Set-Cookie individually: ['Set-Cookie', 'val1', 'Set-Cookie', 'val2']
          const raw = proxyRes.rawHeaders
          for (let i = 0; i < raw.length; i += 2) {
            if (raw[i].toLowerCase() === 'set-cookie') {
              response.headers.append('Set-Cookie', raw[i + 1])
            }
          }

          resolve(response)
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

    proxyReq.write(body)
    proxyReq.end()
  })
}
