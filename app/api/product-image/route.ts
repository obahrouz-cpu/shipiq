// FLUTTER: lib/services/product_service.dart → getProductImage()
// Method: POST  Auth: none (rate-limited by IP)
// Body:   { url: string }
// Returns: { image_url: string | null }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'

// Resolved product images are effectively immutable per URL — cache 24h.
const IMAGE_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800' }

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || ''
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
const BAD_IMAGE_WORDS = ['prime', 'logo', 'marketing', 'banner', 'icon', 'favicon']

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractAsin(url: string): string | null {
  const m = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|asin=([A-Z0-9]{10})/i)
  return m ? (m[1] || m[2] || m[3]) : null
}

function isBadImage(url: string): boolean {
  const lower = url.toLowerCase()
  return BAD_IMAGE_WORDS.some(w => lower.includes(w))
}

function extractMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1] && m[1].startsWith('http') && !isBadImage(m[1])) return m[1]
  }
  return null
}

async function fetchPage(url: string, extraHeaders: Record<string, string> = {}): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: {
        'User-Agent': MOBILE_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...extraHeaders,
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

// ── DB cache ──────────────────────────────────────────────────────────────────

async function checkDbCache(productUrl: string): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('photo_url')
      .eq('url', productUrl)
      .not('photo_url', 'is', null)
      .limit(1)
      .maybeSingle()
    return (data as { photo_url: string } | null)?.photo_url ?? null
  } catch {
    return null
  }
}

async function saveToDbCache(productUrl: string, imageUrl: string): Promise<void> {
  try {
    const supabase = createClient()
    await supabase
      .from('orders')
      .update({ photo_url: imageUrl })
      .eq('url', productUrl)
      .is('photo_url', null)
  } catch {
    // RLS may block this in server context — silent fail is fine
  }
}

// ── Site-specific fetchers ────────────────────────────────────────────────────

async function fetchAmazon(url: string): Promise<string | null> {
  const asin = extractAsin(url)
  if (!asin) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=US`,
      {
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
        },
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)
    if (res.ok) {
      const data = await res.json()
      const img: string | undefined =
        data?.data?.product_photo ||
        data?.data?.product_main_image_url ||
        data?.data?.product_photos?.[0]
      if (img) return img
    }
  } catch (err) {
    console.error('[product-image] Amazon API request failed:', err)
  }

  return null
}

async function fetchTrendyol(url: string): Promise<string | null> {
  const m = url.match(/-p-(\d+)/)
  const productId = m?.[1]

  if (productId) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 7000)
      const res = await fetch(
        `https://public.trendyol.com/discovery-web-productgw-service/api/productDetail/${productId}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': MOBILE_UA,
            'Origin': 'https://www.trendyol.com',
            'Referer': 'https://www.trendyol.com/',
          },
          signal: controller.signal,
        }
      )
      clearTimeout(timeout)
      if (res.ok) {
        const data = await res.json()
        const product = data?.result?.product || data?.result || data
        const images: string[] = product?.images || product?.productImages || []
        const first = images[0]
        if (first) {
          return first.startsWith('http') ? first : `https://cdn.dsmcdn.com${first}`
        }
      }
    } catch (err) {
      console.error('[product-image] Trendyol API failed:', err)
    }
  }

  // Fallback: og:image from page
  const html = await fetchPage(url, {
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
    'Referer': 'https://www.trendyol.com/',
  })
  return html ? extractMetaImage(html) : null
}

async function fetchGeneric(url: string): Promise<string | null> {
  const html = await fetchPage(url)
  return html ? extractMetaImage(html) : null
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { ok } = rateLimit(ip, 'product-image', 30, 60_000)
  if (!ok) return NextResponse.json({ image_url: null }, { status: 429 })

  try {
    const body = await req.json().catch(() => ({}))
    const url: unknown = body?.url
    if (!url || typeof url !== 'string') return NextResponse.json({ image_url: null })
    if (url.length > 2000) return NextResponse.json({ image_url: null })

    const lowerUrl = url.toLowerCase()

    // 1. Database cache check — never fetch the same URL twice
    const cached = await checkDbCache(url)
    if (cached) return NextResponse.json({ image_url: cached }, { headers: IMAGE_CACHE_HEADERS })

    // 2. Fetch by site type
    let imageUrl: string | null = null
    if (lowerUrl.includes('amazon.')) {
      imageUrl = await fetchAmazon(url)
    } else if (lowerUrl.includes('trendyol.com')) {
      imageUrl = await fetchTrendyol(url)
    } else {
      imageUrl = await fetchGeneric(url)
    }

    // 3. Persist result so the same URL is never fetched again
    if (imageUrl) await saveToDbCache(url, imageUrl)

    return NextResponse.json(
      { image_url: imageUrl },
      imageUrl ? { headers: IMAGE_CACHE_HEADERS } : undefined
    )
  } catch (err) {
    console.error('[product-image] Unhandled error:', err)
    return NextResponse.json({ image_url: null })
  }
}
