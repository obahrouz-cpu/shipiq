import { NextRequest, NextResponse } from 'next/server'

const OPENWEBNINJA_KEY = 'ak_ih50qdl5j9zcal1fcrt9373dkzzbu7ahvizay953wvnxin7'

function extractAsin(url: string): string | null {
  const m = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|asin=([A-Z0-9]{10})/i)
  return m ? (m[1] || m[2] || m[3]) : null
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') return NextResponse.json({ image_url: null })

    // Amazon: use OpenWebNinja product details API (same key as scrape route)
    if (url.toLowerCase().includes('amazon.')) {
      const asin = extractAsin(url)
      if (!asin) return NextResponse.json({ image_url: null })
      let country = 'US'
      if (url.includes('amazon.co.uk')) country = 'GB'
      else if (url.includes('amazon.de')) country = 'DE'
      else if (url.includes('amazon.ae')) country = 'AE'
      else if (url.includes('amazon.ca')) country = 'CA'
      const apiRes = await fetch(
        `https://api.openwebninja.com/realtime-amazon-data/product-details?asin=${asin}&country=${country}`,
        { headers: { 'x-api-key': OPENWEBNINJA_KEY }, signal: AbortSignal.timeout(8000) }
      )
      if (!apiRes.ok) return NextResponse.json({ image_url: null })
      const data = await apiRes.json()
      const image = data?.data?.product_photo || data?.data?.product_photos?.[0] || null
      return NextResponse.json({ image_url: image })
    }

    // All other sites: fetch page HTML and extract og:image meta tag
    // Works for Trendyol, Noon, AliExpress, Shein, and essentially every modern store
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!pageRes.ok) return NextResponse.json({ image_url: null })

    const html = await pageRes.text()
    // Match both attribute orderings of og:image
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)

    return NextResponse.json({ image_url: m ? m[1] : null })
  } catch {
    return NextResponse.json({ image_url: null })
  }
}
