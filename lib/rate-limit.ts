// Simple in-memory rate limiter — per IP, per route.
// In serverless environments each warm instance maintains its own Map.
// Good enough for abuse protection at this scale; upgrade to Upstash Redis for global enforcement.

interface Entry { count: number; reset: number }
const store = new Map<string, Entry>()

export function rateLimit(
  ip: string,
  route: string,
  limit = 20,
  windowMs = 60_000
): { ok: boolean; remaining: number } {
  const key = `${route}:${ip}`
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) return { ok: false, remaining: 0 }

  entry.count++
  return { ok: true, remaining: limit - entry.count }
}

// Periodically evict expired entries to prevent unbounded growth.
setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (now > entry.reset) store.delete(key)
  })
}, 5 * 60_000)
