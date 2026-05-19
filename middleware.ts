import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter — resets on cold start, good enough for edge
const hits = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 60

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const record = hits.get(ip)
  if (!record || now > record.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (record.count >= MAX_REQUESTS) return false
  record.count++
  return true
}

export function middleware(req: NextRequest) {
  // Only rate-limit API routes
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next()

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(ip)) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
