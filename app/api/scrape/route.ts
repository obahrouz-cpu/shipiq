import { NextRequest, NextResponse } from 'next/server'
import { SITE_INFO } from '@/lib/constants'

const OPENWEBNINJA_KEY = 'ak_ih50qdl5j9zcal1fcrt9373dkzzbu7ahvizay953wvnxin7'

const WEIGHT_KEYS = [
  'Item Weight', 'Weight', 'Package Weight', 'Shipping Weight',
  'Item Weight ‏ ‎', 'Gross Weight',
]

const DIM_KEYS = [
  'Product Dimensions', 'Package Dimensions',
  'Item Dimensions LxWxH', 'Item Dimensions  LxWxH', 'Item Dimensions',
  'Package Dimensions LxWxH', 'Dimensions',
]

function detectSite(url: string) {
  for (const [site, info] of Object.entries(SITE_INFO)) {
    if (url.toLowerCase().includes(site)) return { site, ...info }
  }
  return null
}

function detectNoonCategory(cat: string): string {
  const c = cat.toLowerCase()
  if (/perfume|makeup|skincare|beauty|cosmetic|fragrance|lipstick|mascara|foundation|serum/.test(c)) return 'Cosmetics'
  if (/supplement|vitamin|protein|health|wellness|nutrition/.test(c)) return 'Supplements'
  if (/clothing|fashion|dress|shirt|shoes|footwear|apparel|trouser|pant/.test(c)) return 'Clothing'
  return 'Accessories'
}

function extractAsin(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|asin=([A-Z0-9]{10})/i)
  return match ? (match[1] || match[2] || match[3]) : null
}

function findField(sources: Record<string, unknown>[], keys: string[]): string | null {
  for (const key of keys) {
    for (const source of sources) {
      if (source[key]) return String(source[key])
    }
  }
  return null
}

function parseWeightToKg(weightStr: string): number | null {
  if (!weightStr) return null
  const lower = weightStr.toLowerCase()
  const num = parseFloat(weightStr.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return null
  if (lower.includes('lb') || lower.includes('pound')) return Math.round(num * 0.453592 * 100) / 100
  if (lower.includes('oz') || lower.includes('ounce')) return Math.round(num * 0.0283495 * 100) / 100
  if (lower.includes('kg')) return Math.round(num * 100) / 100
  if (lower.includes('g') && !lower.includes('kg')) return Math.round(num / 1000 * 100) / 100
  return Math.round(num * 100) / 100
}

function parseDimensionsToCm(dimStr: string): { l: number; w: number; h: number } | null {
  if (!dimStr) return null
  const match = dimStr.match(/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*(inch|in|"|cm)?/i)
  if (!match) return null
  let l = parseFloat(match[1])
  let w = parseFloat(match[2])
  let h = parseFloat(match[3])
  const unit = (match[4] || '').toLowerCase()
  if (!unit || unit.includes('in') || unit === '"') {
    l = Math.round(l * 2.54 * 10) / 10
    w = Math.round(w * 2.54 * 10) / 10
    h = Math.round(h * 2.54 * 10) / 10
  }
  return { l, w, h }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const siteInfo = detectSite(url)
    if (!siteInfo) return NextResponse.json({ found: false, reason: 'Unsupported site' }, { status: 400 })

    if (siteInfo.site.includes('amazon')) {
      const asin = extractAsin(url)
      if (!asin) return NextResponse.json({ found: false, reason: 'Could not extract product ID from URL. Make sure it is a direct product link.' })

      let country = 'US'
      if (url.includes('amazon.co.uk')) country = 'GB'
      else if (url.includes('amazon.de')) country = 'DE'
      else if (url.includes('amazon.ae')) country = 'AE'
      else if (url.includes('amazon.ca')) country = 'CA'

      const apiUrl = `https://api.openwebninja.com/realtime-amazon-data/product-details?asin=${asin}&country=${country}`
      const response = await fetch(apiUrl, { headers: { 'x-api-key': OPENWEBNINJA_KEY } })

      if (!response.ok) {
        return NextResponse.json({ found: false, reason: `Could not fetch product data (API ${response.status}). Try again or enter manually.` })
      }

      const data = await response.json()

      if (!data?.data) {
        return NextResponse.json({ found: false, reason: 'Product data unavailable for this listing. Enter weight manually.' })
      }

      const sources = [
        data.data.product_information || {},
        data.data.product_details || {},
        data.data.product_specifications || {},
      ]

      const rawWeight = findField(sources, WEIGHT_KEYS)
      const rawDimensions = findField(sources, DIM_KEYS)
      const productName = data.data.product_title || data.data.title || 'Unknown Product'

      if (!rawWeight && !rawDimensions) {
        return NextResponse.json({
          found: false,
          reason: 'Weight and dimensions not listed for this product. Please enter manually.',
          product_name: productName,
        })
      }

      const actualWeightKg = rawWeight ? parseWeightToKg(rawWeight) : null
      const dims = rawDimensions ? parseDimensionsToCm(rawDimensions) : null
      const dimensionalWeightKg = dims ? Math.round((dims.l * dims.w * dims.h) / 5000 * 100) / 100 : null
      const billableWeightKg = actualWeightKg && dimensionalWeightKg
        ? Math.max(actualWeightKg, dimensionalWeightKg)
        : (actualWeightKg || dimensionalWeightKg)

      return NextResponse.json({
        found: true,
        site: siteInfo,
        product_name: productName,
        actual_weight_kg: actualWeightKg,
        length_cm: dims?.l || null,
        width_cm: dims?.w || null,
        height_cm: dims?.h || null,
        dimensional_weight_kg: dimensionalWeightKg,
        billable_weight_kg: billableWeightKg,
        raw_weight: rawWeight,
        raw_dimensions: rawDimensions,
      })
    }

    if (siteInfo.site === 'trendyol.com') {
      try {
        console.log('[Trendyol] Starting scrape for URL:', url)

        // Extract productId from URL: brand/name-p-{productId}
        const productIdMatch = url.match(/-p-(\d+)/)
        const productId = productIdMatch ? productIdMatch[1] : null
        console.log('[Trendyol] Extracted productId:', productId)

        let weightKg: number | null = null
        let dims: { l: number; w: number; h: number } | null = null
        let productName = 'Trendyol Product'
        let category: string | null = null
        let apiSuccess = false

        // Step 1: Try the Trendyol public product API
        if (productId) {
          const apiUrl = `https://public.trendyol.com/discovery-web-productgw-service/api/productDetail/${productId}`
          console.log('[Trendyol] Trying public API:', apiUrl)
          try {
            const apiRes = await fetch(apiUrl, {
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US,en;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Origin': 'https://www.trendyol.com',
                'Referer': 'https://www.trendyol.com/',
              },
            })
            console.log('[Trendyol] Public API status:', apiRes.status)
            if (apiRes.ok) {
              const apiData = await apiRes.json()
              console.log('[Trendyol] API response keys:', Object.keys(apiData || {}))
              const product = apiData?.result?.product || apiData?.result || apiData?.product || apiData
              if (product) {
                productName = product.name || product.productName || productName
                category = product.categoryName || product.category?.name || null
                console.log('[Trendyol] Product name:', productName, '| Category:', category)

                // Parse attributes array — two common shapes
                const attrs: Array<Record<string, unknown>> = [
                  ...(product.attributes || []),
                  ...(product.productDetailAttributes || []),
                  ...(product.allVariants?.[0]?.attributes || []),
                ]
                console.log('[Trendyol] Total attributes found:', attrs.length)
                for (const attr of attrs) {
                  // Shape A: { attributeName, attributeValue }
                  // Shape B: { key: { name }, value: { name } }
                  // Shape C: { name, value }
                  const attrName = String(
                    attr.attributeName ||
                    (attr.key as Record<string,unknown>)?.name ||
                    attr.name || ''
                  ).toLowerCase()
                  const attrVal = String(
                    attr.attributeValue ||
                    (attr.value as Record<string,unknown>)?.name ||
                    attr.value || ''
                  )
                  console.log('[Trendyol] Attr:', attrName, '=', attrVal)
                  if (/ağırlık|weight/i.test(attrName) && attrVal && !weightKg) {
                    weightKg = parseWeightToKg(attrVal)
                    console.log('[Trendyol] Parsed weight:', weightKg, 'kg from', attrVal)
                  }
                  if (/boyut|dimension|ölçü|en x boy|ebat/i.test(attrName) && attrVal && !dims) {
                    dims = parseDimensionsToCm(attrVal.replace(/\s*x\s*/gi, ' x '))
                    console.log('[Trendyol] Parsed dims:', dims, 'from', attrVal)
                  }
                }
                apiSuccess = true
              }
            }
          } catch (apiErr) {
            console.log('[Trendyol] Public API failed:', apiErr instanceof Error ? apiErr.message : apiErr)
          }
        }

        // Step 2: Fallback — fetch product HTML with mobile iPhone UA
        if (!apiSuccess || (!weightKg && !dims)) {
          console.log('[Trendyol] Falling back to HTML scrape...')
          const htmlRes = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
              'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Referer': 'https://www.trendyol.com',
            },
          })
          console.log('[Trendyol] HTML response status:', htmlRes.status)
          if (!htmlRes.ok) {
            return NextResponse.json({ found: false, reason: `Trendyol returned HTTP ${htmlRes.status}. Try entering manually.` })
          }
          const html = await htmlRes.text()
          console.log('[Trendyol] HTML length:', html.length)
          console.log('[Trendyol] HTML preview (first 500):', html.slice(0, 500))

          // Product name from og:title or <title>
          const nameMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)
            || html.match(/<title>([^<]+)<\/title>/)
          if (nameMatch) productName = nameMatch[1].replace(/ \| Trendyol.*$/, '').trim()

          // Category from breadcrumb or JSON-LD pattern
          const catMatch = html.match(/"pattern"\s*:\s*"([^"]+)"/)
            || html.match(/"categoryName"\s*:\s*"([^"]+)"/)
          if (catMatch && !category) category = catMatch[1]

          // Try to extract attributes from embedded JSON (shape with nested key/value objects)
          // Trendyol embeds: "attributes":[{"key":{"id":N,"name":"..."},"value":{"id":N,"name":"..."}}]
          const attrRegex = /"attributes"\s*:\s*(\[[^\]]{0,4000}\])/g
          let attrMatch: RegExpExecArray | null
          while ((attrMatch = attrRegex.exec(html)) !== null) {
            const m = attrMatch
            try {
              const attrs: Array<Record<string, unknown>> = JSON.parse(m[1])
              for (const attr of attrs) {
                const attrName = String(
                  attr.attributeName ||
                  (attr.key as Record<string,unknown>)?.name ||
                  attr.name || ''
                ).toLowerCase()
                const attrVal = String(
                  attr.attributeValue ||
                  (attr.value as Record<string,unknown>)?.name ||
                  attr.value || ''
                )
                if (/ağırlık|weight/i.test(attrName) && attrVal && !weightKg) {
                  weightKg = parseWeightToKg(attrVal)
                  console.log('[Trendyol] HTML attr weight:', weightKg, 'from', attrVal)
                }
                if (/boyut|dimension|ölçü|en x boy|ebat/i.test(attrName) && attrVal && !dims) {
                  dims = parseDimensionsToCm(attrVal.replace(/\s*x\s*/gi, ' x '))
                  console.log('[Trendyol] HTML attr dims:', dims, 'from', attrVal)
                }
              }
            } catch { /* skip bad JSON */ }
          }

          // Fallback weight/dim text patterns in raw HTML
          if (!weightKg) {
            const wMatch = html.match(/[Aa]ğırlık[^:]*:\s*<[^>]*>([^<]+)|"Ağırlık"\s*,\s*"value"\s*:\s*"([^"]+)"|"attributeName"\s*:\s*"Ağırlık"\s*,\s*"attributeValue"\s*:\s*"([^"]+)"/)
            if (wMatch) {
              const raw = wMatch[1] || wMatch[2] || wMatch[3]
              weightKg = parseWeightToKg(raw)
              console.log('[Trendyol] Text weight match:', raw, '->', weightKg)
            }
          }
          if (!dims) {
            const dMatch = html.match(/(\d+(?:[.,]\d+)?)\s*[Xx]\s*(\d+(?:[.,]\d+)?)\s*[Xx]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm)/)
            if (dMatch) {
              let l = parseFloat(dMatch[1].replace(',', '.'))
              let w = parseFloat(dMatch[2].replace(',', '.'))
              let h = parseFloat(dMatch[3].replace(',', '.'))
              if ((dMatch[4] || '').toLowerCase() === 'mm') { l /= 10; w /= 10; h /= 10 }
              dims = { l: Math.round(l * 10) / 10, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 }
              console.log('[Trendyol] Text dims match:', dims)
            }
          }
        }

        console.log('[Trendyol] Final result — weight:', weightKg, '| dims:', dims, '| name:', productName)

        if (!weightKg && !dims) {
          return NextResponse.json({
            found: false,
            reason: 'Could not extract weight/dimensions from Trendyol. Trendyol does not always include shipping specs — please enter manually.',
            product_name: productName,
          })
        }

        const dimensionalWeightKg = dims ? Math.round((dims.l * dims.w * dims.h) / 5000 * 100) / 100 : null
        const billableWeightKg = weightKg && dimensionalWeightKg
          ? Math.max(weightKg, dimensionalWeightKg)
          : (weightKg || dimensionalWeightKg)

        return NextResponse.json({
          found: true,
          site: siteInfo,
          product_name: productName,
          category,
          actual_weight_kg: weightKg,
          length_cm: dims?.l || null,
          width_cm: dims?.w || null,
          height_cm: dims?.h || null,
          dimensional_weight_kg: dimensionalWeightKg,
          billable_weight_kg: billableWeightKg,
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.log('[Trendyol] Unexpected error:', msg)
        return NextResponse.json({ found: false, reason: `Trendyol scrape failed: ${msg}` })
      }
    }

    if (siteInfo.site === 'noon.com') {
      try {
        console.log('[Noon] Starting scrape for URL:', url)

        // Extract product ID — pattern: /{ID}/p/ e.g. /N79004521V/p/
        const productIdMatch = url.match(/\/([A-Z][A-Z0-9]{6,18})\/p(?:\/|$)/i)
        const productId = productIdMatch ? productIdMatch[1].toUpperCase() : null
        console.log('[Noon] Extracted productId:', productId)

        let weightKg: number | null = null
        let productName = 'Noon Product'
        let category: string | null = null
        let apiSuccess = false

        if (productId) {
          const apiUrl = `https://www.noon.com/api/v2/pdp/product/${productId}?country=UAE`
          console.log('[Noon] Trying product API:', apiUrl)
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 8000)
            const apiRes = await fetch(apiUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                'Accept': 'application/json',
              },
              signal: controller.signal,
            })
            clearTimeout(timeout)
            console.log('[Noon] API status:', apiRes.status)
            if (apiRes.ok) {
              const data = await apiRes.json()
              console.log('[Noon] API response keys:', JSON.stringify(Object.keys(data || {})))
              console.log('[Noon] Full API response (truncated):', JSON.stringify(data).slice(0, 2000))

              const product = data?.catalog_product || data?.product || data?.model || data?.item || data
              productName = product?.name || product?.title || product?.product_title || productName

              const catRaw = String(
                product?.category_name || product?.category?.name ||
                data?.catalog?.category?.name ||
                (Array.isArray(product?.categories) ? product.categories[product.categories.length - 1]?.name : null) || ''
              )
              if (catRaw) { category = detectNoonCategory(catRaw); console.log('[Noon] Raw category:', catRaw, '→', category) }

              const attrs: Array<Record<string, unknown>> = product?.attributes || product?.specifications || product?.details || []
              if (Array.isArray(attrs)) {
                for (const attr of attrs) {
                  const name = String(attr.name || attr.key || attr.label || '').toLowerCase()
                  const value = String(attr.value || attr.val || attr.text || '')
                  console.log('[Noon] Attr:', name, '=', value)
                  if (/weight/i.test(name) && value && !weightKg) {
                    weightKg = parseWeightToKg(value)
                    console.log('[Noon] Found weight from attr:', weightKg, 'kg from', value)
                  }
                }
              }
              if (!weightKg) {
                const direct = product?.weight || product?.shipping_weight || product?.item_weight
                if (direct) { weightKg = parseWeightToKg(String(direct)); console.log('[Noon] Direct weight field:', weightKg) }
              }
              apiSuccess = true
            }
          } catch (apiErr) {
            console.log('[Noon] API failed:', apiErr instanceof Error ? apiErr.message : apiErr)
          }
        }

        // Fallback: scrape product page HTML
        if (!apiSuccess || (!weightKg && !category)) {
          console.log('[Noon] Falling back to HTML scrape...')
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 8000)
            const htmlRes = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
              },
              signal: controller.signal,
            })
            clearTimeout(timeout)
            console.log('[Noon] HTML status:', htmlRes.status)
            if (htmlRes.ok) {
              const html = await htmlRes.text()
              console.log('[Noon] HTML length:', html.length)

              const nameMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/)
                || html.match(/<title>([^<]+)<\/title>/)
              if (nameMatch) productName = nameMatch[1].replace(/\s*[|\-–]\s*noon.*$/i, '').trim()

              const catMatch = html.match(/"categoryName"\s*:\s*"([^"]+)"/)
                || html.match(/<meta[^>]+property=["']product:category["'][^>]+content=["']([^"']+)["']/)
              if (catMatch && !category) { category = detectNoonCategory(catMatch[1]); console.log('[Noon] HTML category:', catMatch[1], '→', category) }

              if (!weightKg) {
                const wMatch = html.match(/[Ww]eight[^:]*:\s*<[^>]*>([^<]+)/)
                  || html.match(/"weight"\s*:\s*"([^"]+)"/i)
                if (wMatch) { weightKg = parseWeightToKg(wMatch[1]); console.log('[Noon] HTML weight:', weightKg, 'from', wMatch[1]) }
              }

              // JSON-LD
              const jsonLdTags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
              for (const tag of jsonLdTags) {
                try {
                  const json = JSON.parse(tag.replace(/<script[^>]*>|<\/script>/gi, ''))
                  console.log('[Noon] JSON-LD type:', json?.['@type'])
                  if (!category && json?.category) category = detectNoonCategory(String(json.category))
                  if (!weightKg && json?.weight) { weightKg = parseWeightToKg(String(json.weight)); console.log('[Noon] JSON-LD weight:', weightKg) }
                  if (!productName || productName === 'Noon Product') productName = json?.name || productName
                } catch { /* skip */ }
              }
            }
          } catch (htmlErr) {
            console.log('[Noon] HTML scrape failed:', htmlErr instanceof Error ? htmlErr.message : htmlErr)
          }
        }

        const finalCategory = category || 'Accessories'
        console.log('[Noon] Final — weight:', weightKg, '| category:', finalCategory, '| name:', productName)

        if (!weightKg) {
          return NextResponse.json({
            found: false,
            reason: 'Could not extract weight from Noon. Please select an estimated weight below.',
            product_name: productName,
            category: finalCategory,
          })
        }

        return NextResponse.json({
          found: true,
          site: siteInfo,
          product_name: productName,
          category: finalCategory,
          actual_weight_kg: weightKg,
          length_cm: null,
          width_cm: null,
          height_cm: null,
          dimensional_weight_kg: null,
          billable_weight_kg: weightKg,
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.log('[Noon] Unexpected error:', msg)
        return NextResponse.json({ found: false, reason: `Noon scrape failed: ${msg}` })
      }
    }

    if (siteInfo.site === 'boutiqaat.com') {
      try {
        console.log('[Boutiqaat] Starting scrape for URL:', url)

        let weightKg: number | null = null
        let productName = 'Boutiqaat Product'
        const category = 'Cosmetics'

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const htmlRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        console.log('[Boutiqaat] HTML status:', htmlRes.status)

        if (!htmlRes.ok) {
          return NextResponse.json({
            found: false,
            reason: `Boutiqaat returned HTTP ${htmlRes.status}. Please select estimated weight below.`,
            category,
          })
        }

        const html = await htmlRes.text()
        console.log('[Boutiqaat] HTML length:', html.length)

        const nameMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/)
          || html.match(/<h1[^>]*>([^<]+)<\/h1>/)
          || html.match(/<title>([^<]+)<\/title>/)
        if (nameMatch) productName = nameMatch[1].replace(/\s*[|\-–]\s*(boutiqaat|بوتيكات).*$/i, '').trim()
        console.log('[Boutiqaat] Product name:', productName)

        // Weight from various patterns
        const weightPatterns = [
          /[Ww]eight[^:]*:\s*<[^>]*>([^<]+)/,
          /[Ww]eight[^:]*:([^<\n,]{1,20})/,
          /"(?:net_?|shipping_?)?weight"\s*:\s*"([^"]+)"/i,
          /"(?:net_?|shipping_?)?weight"\s*:\s*([\d.]+)/i,
        ]
        for (const p of weightPatterns) {
          const m = html.match(p)
          if (m) {
            const parsed = parseWeightToKg(m[1])
            if (parsed) { weightKg = parsed; console.log('[Boutiqaat] Weight:', weightKg, 'kg from', m[1]); break }
          }
        }

        // JSON-LD
        const jsonLdTags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
        for (const tag of jsonLdTags) {
          try {
            const json = JSON.parse(tag.replace(/<script[^>]*>|<\/script>/gi, ''))
            console.log('[Boutiqaat] JSON-LD:', JSON.stringify(json).slice(0, 500))
            if (!productName || productName === 'Boutiqaat Product') productName = json?.name || productName
            if (!weightKg && json?.weight) { weightKg = parseWeightToKg(String(json.weight)); console.log('[Boutiqaat] JSON-LD weight:', weightKg) }
          } catch { /* skip */ }
        }

        console.log('[Boutiqaat] Final — weight:', weightKg, '| category:', category, '| name:', productName)

        if (!weightKg) {
          return NextResponse.json({
            found: false,
            reason: 'Could not extract weight from Boutiqaat. Please select an estimated weight below.',
            product_name: productName,
            category,
          })
        }

        return NextResponse.json({
          found: true,
          site: siteInfo,
          product_name: productName,
          category,
          actual_weight_kg: weightKg,
          length_cm: null,
          width_cm: null,
          height_cm: null,
          dimensional_weight_kg: null,
          billable_weight_kg: weightKg,
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.log('[Boutiqaat] Unexpected error:', msg)
        return NextResponse.json({ found: false, reason: `Boutiqaat scrape failed: ${msg}`, category: 'Cosmetics' })
      }
    }

    return NextResponse.json({ found: false, reason: 'Auto-calculate for this site is coming soon. Please enter details manually.' })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ found: false, reason: message }, { status: 500 })
  }
}
