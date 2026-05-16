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

    // ── Amazon ────────────────────────────────────────────────────────────────
    if (url.toLowerCase().includes('amazon.')) {
      const asin = extractAsin(url)
      console.log('[product-image] Amazon — ASIN:', asin)
      if (!asin) return NextResponse.json({ image_url: null })

      let country = 'US'
      if (url.includes('amazon.co.uk')) country = 'GB'
      else if (url.includes('amazon.de')) country = 'DE'
      else if (url.includes('amazon.ae')) country = 'AE'
      else if (url.includes('amazon.ca')) country = 'CA'

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const apiUrl = `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=${country}`
        console.log('[product-image] Amazon RapidAPI request:', apiUrl)
        const apiRes = await fetch(apiUrl, {
          headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com',
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        console.log('[product-image] Amazon RapidAPI status:', apiRes.status)
        if (apiRes.ok) {
          const data = await apiRes.json()
          console.log('[product-image] Amazon data.data keys:', JSON.stringify(Object.keys(data?.data || {})))
          const image =
            data?.data?.product_photo ||
            data?.data?.product_main_image_url ||
            data?.data?.product_photos?.[0] ||
            null
          console.log('[product-image] Amazon image result:', image)
          if (image) return NextResponse.json({ image_url: image })
        } else {
          console.log('[product-image] Amazon RapidAPI non-OK body:', await apiRes.text().catch(() => ''))
        }
      } catch (e) {
        console.log('[product-image] Amazon RapidAPI failed:', e instanceof Error ? e.message : e)
      }

      // Fallback: og:image from product page
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)
        console.log('[product-image] Amazon fallback: scraping og:image')
        const pageRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        console.log('[product-image] Amazon page status:', pageRes.status)
        if (pageRes.ok) {
          const image = extractOgImage(await pageRes.text())
          console.log('[product-image] Amazon og:image:', image)
          return NextResponse.json({ image_url: image })
        }
      } catch (e) {
        console.log('[product-image] Amazon page scrape failed:', e instanceof Error ? e.message : e)
      }

      return NextResponse.json({ image_url: null })
    }

    // ── Trendyol ──────────────────────────────────────────────────────────────
    if (url.toLowerCase().includes('trendyol.com')) {
      const productIdMatch = url.match(/-p-(\d+)/)
      const productId = productIdMatch?.[1] ?? null
      console.log('[product-image] Trendyol — productId:', productId)

      if (productId) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 7000)
          const apiUrl = `https://public.trendyol.com/discovery-web-productgw-service/api/productDetail/${productId}`
          console.log('[product-image] Trendyol API request:', apiUrl)
          const apiRes = await fetch(apiUrl, {
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Origin': 'https://www.trendyol.com',
              'Referer': 'https://www.trendyol.com/',
            },
            signal: controller.signal,
          })
          clearTimeout(timeout)
          console.log('[product-image] Trendyol API status:', apiRes.status)
          if (apiRes.ok) {
            const data = await apiRes.json()
            const product = data?.result?.product || data?.result || data?.product || data
            const images: string[] = product?.images || product?.productImages || []
            console.log('[product-image] Trendyol images (first 3):', images?.slice(0, 3))
            const first = images[0]
            if (first) {
              const fullUrl = first.startsWith('http') ? first : `https://cdn.dsmcdn.com${first}`
              console.log('[product-image] Trendyol image:', fullUrl)
              return NextResponse.json({ image_url: fullUrl })
            }
          } else {
            console.log('[product-image] Trendyol API non-OK body:', await apiRes.text().catch(() => '').then(t => t.slice(0, 200)))
          }
        } catch (e) {
          console.log('[product-image] Trendyol API failed:', e instanceof Error ? e.message : e)
        }
      }

      // Fallback: og:image from mobile page
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 7000)
        console.log('[product-image] Trendyol fallback: scraping og:image')
        const pageRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
            'Referer': 'https://www.trendyol.com/',
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        console.log('[product-image] Trendyol page status:', pageRes.status)
        if (pageRes.ok) {
          const image = extractOgImage(await pageRes.text())
          console.log('[product-image] Trendyol og:image:', image)
          return NextResponse.json({ image_url: image })
        }
      } catch (e) {
        console.log('[product-image] Trendyol page scrape failed:', e instanceof Error ? e.message : e)
      }

      return NextResponse.json({ image_url: null })
    }

    // ── All other sites: og:image ─────────────────────────────────────────────
    console.log('[product-image] Generic fetch for:', url)
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
      console.log('[product-image] Generic page status:', pageRes.status)
      if (!pageRes.ok) return NextResponse.json({ image_url: null })
      const image = extractOgImage(await pageRes.text())
      console.log('[product-image] Generic og:image:', image)
      return NextResponse.json({ image_url: image })
    } catch (e) {
      console.log('[product-image] Generic fetch failed:', e instanceof Error ? e.message : e)
      return NextResponse.json({ image_url: null })
    }
  } catch {
    return NextResponse.json({ image_url: null })
  }
}
