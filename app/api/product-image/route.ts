import { NextRequest, NextResponse } from 'next/server'

const RAPIDAPI_KEY = 'ak_ih50qdl5j9zcal1fcrt9373dkzzbu7ahvizay953wvnxin7'

function extractAsin(url: string): string | null {
  const m = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|asin=([A-Z0-9]{10})/i)
  return m ? (m[1] || m[2] || m[3]) : null
}

function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+property=og:image[^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=og:image/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1] && m[1].startsWith('http')) return m[1]
  }
  return null
}

async function tryMicrolink(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false&meta=true`
    const res = await fetch(apiUrl, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.image?.url || data?.data?.logo?.url || null
  } catch {
    return null
  }
}

async function tryAmazonRapidApi(url: string): Promise<string | null> {
  const asin = extractAsin(url)
  if (!asin) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const apiUrl = `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=US`
    const res = await fetch(apiUrl, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.product_photo || data?.data?.product_main_image_url || data?.data?.product_photos?.[0] || null
  } catch {
    return null
  }
}

async function tryOgImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    return extractOgImage(await res.text())
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') return NextResponse.json({ image_url: null })

    const isAmazon = url.toLowerCase().includes('amazon.')

    if (isAmazon) {
      // Amazon: Microlink returns marketing/logo images, so use RapidAPI first
      const amazonImage = await tryAmazonRapidApi(url)
      if (amazonImage) return NextResponse.json({ image_url: amazonImage })
    } else {
      // All other sites: Microlink works well
      const microlinkImage = await tryMicrolink(url)
      if (microlinkImage) return NextResponse.json({ image_url: microlinkImage })
    }

    // Final fallback: og:image scrape
    const ogImage = await tryOgImage(url)
    return NextResponse.json({ image_url: ogImage })
  } catch {
    return NextResponse.json({ image_url: null })
  }
}
