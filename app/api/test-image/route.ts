import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

function extractAsin(url: string): string | null {
  const m = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|asin=([A-Z0-9]{10})/i)
  return m ? (m[1] || m[2] || m[3]) : null
}

function extractAllImageMeta(html: string): string[] {
  const found: string[] = []
  // Match all meta tags that have "image" in property or name attribute
  const metaRegex = /<meta[^>]+>/gi
  let m: RegExpExecArray | null
  while ((m = metaRegex.exec(html)) !== null) {
    const tag = m[0]
    if (/property=["'][^"']*image[^"']*["']/i.test(tag) || /name=["'][^"']*image[^"']*["']/i.test(tag)) {
      found.push(tag.replace(/\s+/g, ' ').trim())
    }
  }
  return found
}

function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ]
  for (const p of patterns) {
    const match = html.match(p)
    if (match?.[1]) return match[1]
  }
  return null
}

async function testAmazonUrl(label: string, amazonUrl: string) {
  const asin = extractAsin(amazonUrl)
  const fetchUrl = asin ? `https://www.amazon.com/dp/${asin}` : amazonUrl

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': MOBILE_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const status = res.status
    const html = await res.text()
    const first2000 = html.slice(0, 2000)
    const imageMetas = extractAllImageMeta(html)
    const ogImage = extractOgImage(html)

    return {
      label,
      asin,
      fetchUrl,
      status,
      htmlFirst2000: first2000,
      imageMetaTags: imageMetas,
      ogImage,
    }
  } catch (e: unknown) {
    return {
      label,
      asin,
      fetchUrl,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function GET(_req: NextRequest) {
  const results = []

  // Hard-coded test URL
  results.push(await testAmazonUrl('B0F6PLQ93N (laptop)', 'https://www.amazon.com/dp/B0F6PLQ93N'))

  // Look up the two broken orders from Supabase
  try {
    const supabase = createClient()
    const { data: orders } = await supabase
      .from('orders')
      .select('id, url')
      .in('id', ['ORD-ECD4E982', 'ORD-002A95B8'])

    if (orders && orders.length > 0) {
      for (const order of orders as { id: string; url: string }[]) {
        if (order.url) {
          results.push(await testAmazonUrl(order.id, order.url))
        } else {
          results.push({ label: order.id, error: 'No URL stored for this order' })
        }
      }
    } else {
      results.push({ label: 'Supabase lookup', error: 'Orders not found or RLS blocked read' })
    }
  } catch (e: unknown) {
    results.push({ label: 'Supabase lookup', error: e instanceof Error ? e.message : String(e) })
  }

  return NextResponse.json(results, { status: 200 })
}
