import { NextRequest, NextResponse } from 'next/server'

const OPENWEBNINJA_KEY = 'ak_ih50qdl5j9zcal1fcrt9373dkzzbu7ahvizay953wvnxin7'

function extractAsin(url: string): string | null {
  const m = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|asin=([A-Z0-9]{10})/i)
  return m ? (m[1] || m[2] || m[3]) : null
}

function extractOgImage(html: string): string | null {
  // Handle all attribute orderings and quote styles
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+property=og:image[^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=og:image/i,
    /og:image.*?content=["']([^"']+)["']/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1] && m[1].startsWith('http')) return m[1]
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') return NextResponse.json({ image_url: null })

    // ── Amazon: OpenWebNinja product-details API ──────────────────────────────
    if (url.toLowerCase().includes('amazon.')) {
      const asin = extractAsin(url)
      if (!asin) return NextResponse.json({ image_url: null })
      let country = 'US'
      if (url.includes('amazon.co.uk')) country = 'GB'
      else if (url.includes('amazon.de')) country = 'DE'
      else if (url.includes('amazon.ae')) country = 'AE'
      else if (url.includes('amazon.ca')) country = 'CA'

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const apiRes = await fetch(
          `https://api.openwebninja.com/realtime-amazon-data/product-details?asin=${asin}&country=${country}`,
          { headers: { 'x-api-key': OPENWEBNINJA_KEY }, signal: controller.signal }
        )
        clearTimeout(timeout)
        if (apiRes.ok) {
          const data = await apiRes.json()
          const image =
            data?.data?.product_photo ||
            data?.data?.product_main_image_url ||
            data?.data?.product_photos?.[0] ||
            null
          if (image) return NextResponse.json({ image_url: image })
        }
      } catch { /* fall through to og:image */ }

      // Amazon fallback: scrape og:image from the product page
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)
        const pageRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (pageRes.ok) {
          const image = extractOgImage(await pageRes.text())
          return NextResponse.json({ image_url: image })
        }
      } catch { /* ignore */ }

      return NextResponse.json({ image_url: null })
    }

    // ── All other sites: extract og:image from page HTML ─────────────────────
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!pageRes.ok) return NextResponse.json({ image_url: null })
      const image = extractOgImage(await pageRes.text())
      return NextResponse.json({ image_url: image })
    } catch {
      return NextResponse.json({ image_url: null })
    }
  } catch {
    return NextResponse.json({ image_url: null })
  }
}
