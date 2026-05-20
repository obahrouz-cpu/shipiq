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

function detectAliExpressCategory(cat: string): string {
  const c = cat.toLowerCase()
  if (/clothing|fashion|apparel|dress|shirt|shoes|footwear|pants|jeans|women.*wear|men.*wear|tops|skirt/.test(c)) return 'Clothing'
  if (/beauty|hair|skin|makeup|cosmetic|perfume|fragrance|nail|lip|foundation|serum/.test(c)) return 'Cosmetics'
  return 'Electronics'
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
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
        const productIdMatch = url.match(/-p-(\d+)/)
        const productId = productIdMatch ? productIdMatch[1] : null

        let weightKg: number | null = null
        let dims: { l: number; w: number; h: number } | null = null
        let productName = 'Trendyol Product'
        let category: string | null = null
        let apiSuccess = false

        // Step 1: Try the Trendyol public product API
        if (productId) {
          const apiUrl = `https://public.trendyol.com/discovery-web-productgw-service/api/productDetail/${productId}`
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
            if (apiRes.ok) {
              const apiData = await apiRes.json()
              const product = apiData?.result?.product || apiData?.result || apiData?.product || apiData
              if (product) {
                productName = product.name || product.productName || productName
                category = product.categoryName || product.category?.name || null

                const attrs: Array<Record<string, unknown>> = [
                  ...(product.attributes || []),
                  ...(product.productDetailAttributes || []),
                  ...(product.allVariants?.[0]?.attributes || []),
                ]
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
                  }
                  if (/boyut|dimension|ölçü|en x boy|ebat/i.test(attrName) && attrVal && !dims) {
                    dims = parseDimensionsToCm(attrVal.replace(/\s*x\s*/gi, ' x '))
                  }
                }
                apiSuccess = true
              }
            }
          } catch (apiErr) {
            console.error('[scrape] Trendyol API failed:', apiErr)
          }
        }

        // Step 2: Fallback — fetch product HTML with mobile iPhone UA
        if (!apiSuccess || (!weightKg && !dims)) {
          const htmlRes = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
              'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Referer': 'https://www.trendyol.com',
            },
          })
          if (!htmlRes.ok) {
            return NextResponse.json({ found: false, reason: `Trendyol returned HTTP ${htmlRes.status}. Try entering manually.` })
          }
          const html = await htmlRes.text()

          const nameMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)
            || html.match(/<title>([^<]+)<\/title>/)
          if (nameMatch) productName = nameMatch[1].replace(/ \| Trendyol.*$/, '').trim()

          const catMatch = html.match(/"pattern"\s*:\s*"([^"]+)"/)
            || html.match(/"categoryName"\s*:\s*"([^"]+)"/)
          if (catMatch && !category) category = catMatch[1]

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
                }
                if (/boyut|dimension|ölçü|en x boy|ebat/i.test(attrName) && attrVal && !dims) {
                  dims = parseDimensionsToCm(attrVal.replace(/\s*x\s*/gi, ' x '))
                }
              }
            } catch { /* skip bad JSON */ }
          }

          if (!weightKg) {
            const wMatch = html.match(/[Aa]ğırlık[^:]*:\s*<[^>]*>([^<]+)|"Ağırlık"\s*,\s*"value"\s*:\s*"([^"]+)"|"attributeName"\s*:\s*"Ağırlık"\s*,\s*"attributeValue"\s*:\s*"([^"]+)"/)
            if (wMatch) {
              const raw = wMatch[1] || wMatch[2] || wMatch[3]
              weightKg = parseWeightToKg(raw)
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
            }
          }
        }

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
        console.error('[scrape] Trendyol unexpected error:', msg)
        return NextResponse.json({ found: false, reason: `Trendyol scrape failed: ${msg}` })
      }
    }

    if (siteInfo.site === 'noon.com') {
      try {
        const productIdMatch = url.match(/\/([A-Z][A-Z0-9]{6,18})\/p(?:\/|$)/i)
        const productId = productIdMatch ? productIdMatch[1].toUpperCase() : null

        let weightKg: number | null = null
        let productName = 'Noon Product'
        let category: string | null = null
        let apiSuccess = false

        if (productId) {
          const apiUrl = `https://www.noon.com/api/v2/pdp/product/${productId}?country=UAE`
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
            if (apiRes.ok) {
              const data = await apiRes.json()
              const product = data?.catalog_product || data?.product || data?.model || data?.item || data
              productName = product?.name || product?.title || product?.product_title || productName

              const catRaw = String(
                product?.category_name || product?.category?.name ||
                data?.catalog?.category?.name ||
                (Array.isArray(product?.categories) ? product.categories[product.categories.length - 1]?.name : null) || ''
              )
              if (catRaw) category = detectNoonCategory(catRaw)

              const attrs: Array<Record<string, unknown>> = product?.attributes || product?.specifications || product?.details || []
              if (Array.isArray(attrs)) {
                for (const attr of attrs) {
                  const name = String(attr.name || attr.key || attr.label || '').toLowerCase()
                  const value = String(attr.value || attr.val || attr.text || '')
                  if (/weight/i.test(name) && value && !weightKg) {
                    weightKg = parseWeightToKg(value)
                  }
                }
              }
              if (!weightKg) {
                const direct = product?.weight || product?.shipping_weight || product?.item_weight
                if (direct) weightKg = parseWeightToKg(String(direct))
              }
              apiSuccess = true
            }
          } catch (apiErr) {
            console.error('[scrape] Noon API failed:', apiErr)
          }
        }

        // Fallback: scrape product page HTML
        if (!apiSuccess || (!weightKg && !category)) {
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
            if (htmlRes.ok) {
              const html = await htmlRes.text()

              const nameMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/)
                || html.match(/<title>([^<]+)<\/title>/)
              if (nameMatch) productName = nameMatch[1].replace(/\s*[|\-–]\s*noon.*$/i, '').trim()

              const catMatch = html.match(/"categoryName"\s*:\s*"([^"]+)"/)
                || html.match(/<meta[^>]+property=["']product:category["'][^>]+content=["']([^"']+)["']/)
              if (catMatch && !category) category = detectNoonCategory(catMatch[1])

              if (!weightKg) {
                const wMatch = html.match(/[Ww]eight[^:]*:\s*<[^>]*>([^<]+)/)
                  || html.match(/"weight"\s*:\s*"([^"]+)"/i)
                if (wMatch) weightKg = parseWeightToKg(wMatch[1])
              }

              const jsonLdTags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
              for (const tag of jsonLdTags) {
                try {
                  const json = JSON.parse(tag.replace(/<script[^>]*>|<\/script>/gi, ''))
                  if (!category && json?.category) category = detectNoonCategory(String(json.category))
                  if (!weightKg && json?.weight) weightKg = parseWeightToKg(String(json.weight))
                  if (!productName || productName === 'Noon Product') productName = json?.name || productName
                } catch { /* skip */ }
              }
            }
          } catch (htmlErr) {
            console.error('[scrape] Noon HTML scrape failed:', htmlErr)
          }
        }

        const finalCategory = category || 'Accessories'

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
        console.error('[scrape] Noon unexpected error:', msg)
        return NextResponse.json({ found: false, reason: `Noon scrape failed: ${msg}` })
      }
    }

    if (siteInfo.site === 'boutiqaat.com') {
      try {
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

        if (!htmlRes.ok) {
          return NextResponse.json({
            found: false,
            reason: `Boutiqaat returned HTTP ${htmlRes.status}. Please select estimated weight below.`,
            category,
          })
        }

        const html = await htmlRes.text()

        const nameMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/)
          || html.match(/<h1[^>]*>([^<]+)<\/h1>/)
          || html.match(/<title>([^<]+)<\/title>/)
        if (nameMatch) productName = nameMatch[1].replace(/\s*[|\-–]\s*(boutiqaat|بوتيكات).*$/i, '').trim()

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
            if (parsed) { weightKg = parsed; break }
          }
        }

        const jsonLdTags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
        for (const tag of jsonLdTags) {
          try {
            const json = JSON.parse(tag.replace(/<script[^>]*>|<\/script>/gi, ''))
            if (!productName || productName === 'Boutiqaat Product') productName = json?.name || productName
            if (!weightKg && json?.weight) weightKg = parseWeightToKg(String(json.weight))
          } catch { /* skip */ }
        }

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
        console.error('[scrape] Boutiqaat unexpected error:', msg)
        return NextResponse.json({ found: false, reason: `Boutiqaat scrape failed: ${msg}`, category: 'Cosmetics' })
      }
    }

    // ── NEWEGG ───────────────────────────────────────────────────────────────────
    if (siteInfo.site === 'newegg.com') {
      try {
        let weightKg: number | null = null
        let dims: { l: number; w: number; h: number } | null = null
        let productName = 'Newegg Product'
        const category = 'Electronics'

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        const htmlRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        console.log('[scrape] Newegg HTTP status:', htmlRes.status)

        if (!htmlRes.ok) {
          return NextResponse.json({ found: false, reason: `Newegg returned HTTP ${htmlRes.status}. Enter details manually.` })
        }

        const html = await htmlRes.text()
        console.log('[scrape] Newegg HTML length:', html.length)

        // Product name
        const nameMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/)
          || html.match(/<h1[^>]*class=["'][^"']*product[^"']*["'][^>]*>([^<]+)<\/h1>/)
          || html.match(/<title>([^<]+)<\/title>/)
        if (nameMatch) productName = nameMatch[1].replace(/\s*-\s*Newegg\.com.*$/i, '').trim()
        console.log('[scrape] Newegg product name:', productName)

        // Method 1: table-horizontal spec rows
        const tableRe = /<table[^>]*class="[^"]*table-horizontal[^"]*"[^>]*>([\s\S]*?)<\/table>/gi
        let tblMatch
        while ((tblMatch = tableRe.exec(html)) !== null && (!weightKg || !dims)) {
          const tblHtml = tblMatch[1]
          const rowRe = /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi
          let rowM
          while ((rowM = rowRe.exec(tblHtml)) !== null) {
            const key = stripTags(rowM[1])
            const val = stripTags(rowM[2])
            if (/net\s*weight|item\s*weight|shipping\s*weight/i.test(key) && val && !weightKg) {
              weightKg = parseWeightToKg(val)
              console.log('[scrape] Newegg weight (table-horizontal):', key, '=', val, '->', weightKg, 'kg')
            }
            if (/product\s*dimensions|item\s*dimensions|package\s*dimensions/i.test(key) && val && !dims) {
              dims = parseDimensionsToCm(val)
              console.log('[scrape] Newegg dims (table-horizontal):', key, '=', val, '->', dims)
            }
          }
        }

        // Method 2: generic th/td anywhere (some Newegg pages use different table classes)
        if (!weightKg || !dims) {
          const genericRowRe = /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi
          let grm
          while ((grm = genericRowRe.exec(html)) !== null) {
            const key = stripTags(grm[1])
            const val = stripTags(grm[2])
            if (/net\s*weight|item\s*weight|shipping\s*weight/i.test(key) && val && !weightKg) {
              weightKg = parseWeightToKg(val)
              console.log('[scrape] Newegg weight (generic table):', key, '=', val, '->', weightKg, 'kg')
            }
            if (/product\s*dimensions|item\s*dimensions|package\s*dimensions/i.test(key) && val && !dims) {
              dims = parseDimensionsToCm(val)
              console.log('[scrape] Newegg dims (generic table):', key, '=', val, '->', dims)
            }
          }
        }

        // Method 3: dl/dt/dd spec patterns
        if (!weightKg || !dims) {
          const dlRe = /<dl[^>]*>([\s\S]*?)<\/dl>/gi
          let dlM
          while ((dlM = dlRe.exec(html)) !== null && (!weightKg || !dims)) {
            const pairRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi
            let pm
            while ((pm = pairRe.exec(dlM[1])) !== null) {
              const key = stripTags(pm[1])
              const val = stripTags(pm[2])
              if (/weight/i.test(key) && val && !weightKg) {
                weightKg = parseWeightToKg(val)
                console.log('[scrape] Newegg weight (dl):', key, '->', weightKg)
              }
              if (/dimension/i.test(key) && val && !dims) {
                dims = parseDimensionsToCm(val)
                console.log('[scrape] Newegg dims (dl):', key, '->', dims)
              }
            }
          }
        }

        // Method 4: JSON-LD
        const jsonLdTags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
        for (const tag of jsonLdTags) {
          try {
            const json = JSON.parse(tag.replace(/<script[^>]*>|<\/script>/gi, ''))
            if (!productName || productName === 'Newegg Product') productName = json?.name || productName
            if (!weightKg && json?.weight) {
              weightKg = parseWeightToKg(String(json.weight))
              console.log('[scrape] Newegg weight (JSON-LD):', json.weight, '->', weightKg)
            }
          } catch { /* skip */ }
        }

        // Method 5: regex fallbacks
        if (!weightKg) {
          const wm = html.match(/(?:Net|Item|Shipping)\s+Weight[^:]*:\s*<[^>]*>([^<]+)/)
            || html.match(/(?:Net|Item|Shipping)\s+Weight[^:]*:\s*([0-9.]+\s*(?:lbs?|oz|kg|g))/i)
          if (wm) {
            weightKg = parseWeightToKg(wm[1])
            console.log('[scrape] Newegg weight (regex):', wm[1], '->', weightKg)
          }
        }
        if (!dims) {
          const dm = html.match(/Product\s+Dimensions[^:]*:\s*([0-9.]+\s*x\s*[0-9.]+\s*x\s*[0-9.]+(?:\s*(?:inch|in|"|cm))?)/i)
          if (dm) {
            dims = parseDimensionsToCm(dm[1])
            console.log('[scrape] Newegg dims (regex):', dm[1], '->', dims)
          }
        }

        if (!weightKg && !dims) {
          return NextResponse.json({
            found: false,
            reason: 'Could not extract weight/dimensions from Newegg. Specs vary by product — please enter manually.',
            product_name: productName,
            category,
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
          length_cm: dims?.l ?? null,
          width_cm: dims?.w ?? null,
          height_cm: dims?.h ?? null,
          dimensional_weight_kg: dimensionalWeightKg,
          billable_weight_kg: billableWeightKg,
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.error('[scrape] Newegg unexpected error:', msg)
        return NextResponse.json({ found: false, reason: `Newegg scrape failed: ${msg}` })
      }
    }

    // ── ALIEXPRESS ────────────────────────────────────────────────────────────────
    if (siteInfo.site === 'aliexpress.com') {
      try {
        const productIdMatch = url.match(/\/item\/(\d+)(?:\.html)?/)
        const productId = productIdMatch ? productIdMatch[1] : null
        console.log('[scrape] AliExpress product ID:', productId)

        if (!productId) {
          return NextResponse.json({ found: false, reason: 'Could not extract product ID from AliExpress URL. Use a direct item link.' })
        }

        let weightKg: number | null = null
        let dims: { l: number; w: number; h: number } | null = null
        let productName = 'AliExpress Product'
        let category: string | null = null
        let imageUrl: string | null = null

        // Step 1: Try mobile page (less bot-protected than desktop)
        const mobileUrl = `https://m.aliexpress.com/item/${productId}.html`
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 10000)
          const mRes = await fetch(mobileUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: controller.signal,
          })
          clearTimeout(timeout)
          console.log('[scrape] AliExpress mobile HTTP status:', mRes.status)

          if (mRes.ok) {
            const html = await mRes.text()
            console.log('[scrape] AliExpress mobile HTML length:', html.length)

            // Product name
            const nameM = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/)
              || html.match(/<title>([^<]+)<\/title>/)
            if (nameM) productName = nameM[1].replace(/\s*[-|]\s*AliExpress.*$/i, '').trim()

            // Thumbnail
            const imgM = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/)
            if (imgM) imageUrl = imgM[1]

            // Try window.runParams — the main product JSON embedded in the page
            const runParamsM = html.match(/window\.runParams\s*=\s*(\{[\s\S]{10,200000}?\});\s*(?:window|var|let|const|<\/script>)/m)
            if (runParamsM) {
              try {
                const rp = JSON.parse(runParamsM[1])
                console.log('[scrape] AliExpress runParams top-level keys:', Object.keys(rp))

                // Product name
                const title = rp?.data?.titleModule?.subject || rp?.titleModule?.subject
                if (title) productName = String(title)

                // Image
                const img = rp?.data?.imageModule?.imagePathList?.[0] || rp?.imageModule?.imagePathList?.[0]
                if (img && !imageUrl) imageUrl = String(img)

                // Category from breadcrumbs
                const crumbs: Array<Record<string,unknown>> =
                  rp?.data?.breadcrumbModule?.breadcrumbs || rp?.breadcrumbModule?.breadcrumbs || []
                if (Array.isArray(crumbs) && crumbs.length >= 2) {
                  category = String(crumbs[crumbs.length - 2]?.name || crumbs[crumbs.length - 1]?.name || '')
                  console.log('[scrape] AliExpress category from breadcrumbs:', category)
                }

                // Specs — multiple possible locations
                const specsSources = [
                  rp?.data?.specsModule?.props,
                  rp?.specsModule?.props,
                  rp?.data?.productInfoModule?.specs,
                  rp?.data?.descriptionModule?.specs,
                ]
                for (const specs of specsSources) {
                  if (!Array.isArray(specs)) continue
                  console.log('[scrape] AliExpress specs array length:', specs.length)
                  for (const spec of specs) {
                    const attrName = String(spec.attrName || spec.name || spec.key || '').toLowerCase()
                    const attrVal  = String(spec.attrValue || spec.value || spec.val || '')
                    console.log('[scrape] AliExpress spec:', attrName, '=', attrVal)
                    if (/package\s*weight|item\s*weight|net\s*weight/i.test(attrName) && attrVal && !weightKg) {
                      weightKg = parseWeightToKg(attrVal)
                      console.log('[scrape] AliExpress weight from runParams:', attrVal, '->', weightKg)
                    }
                    if (/package\s*size|product\s*size|item\s*size|package\s*dimension/i.test(attrName) && attrVal && !dims) {
                      dims = parseDimensionsToCm(attrVal.replace(/[*×∗]/g, 'x').replace(/\s+x\s+/gi, ' x '))
                      console.log('[scrape] AliExpress dims from runParams:', attrVal, '->', dims)
                    }
                  }
                  if (weightKg || dims) break
                }
              } catch (parseErr) {
                console.error('[scrape] AliExpress runParams parse failed:', parseErr instanceof Error ? parseErr.message : parseErr)
              }
            } else {
              console.log('[scrape] AliExpress: no window.runParams found')
            }

            // Fallback regex on raw HTML
            if (!weightKg) {
              const wm = html.match(/[Pp]ackage\s+[Ww]eight[^:]*:\s*<[^>]*>([^<]+)/)
                || html.match(/"attrName"\s*:\s*"[Pp]ackage [Ww]eight"[^}]*"attrValue"\s*:\s*"([^"]+)"/)
                || html.match(/"name"\s*:\s*"[Pp]ackage [Ww]eight"[^}]*"value"\s*:\s*"([^"]+)"/)
                || html.match(/[Pp]ackage\s+[Ww]eight[^:]*:\s*([0-9.]+\s*(?:kg|g|oz|lb))/i)
              if (wm) {
                weightKg = parseWeightToKg(wm[1])
                console.log('[scrape] AliExpress weight (regex fallback):', wm[1], '->', weightKg)
              }
            }
            if (!dims) {
              const dm = html.match(/"attrName"\s*:\s*"[Pp]ackage [Ss]ize"[^}]*"attrValue"\s*:\s*"([^"]+)"/)
                || html.match(/"name"\s*:\s*"[Pp]ackage [Ss]ize"[^}]*"value"\s*:\s*"([^"]+)"/)
                || html.match(/[Pp]ackage\s+[Ss]ize[^:]*:\s*([0-9.]+\s*[*×x]\s*[0-9.]+\s*[*×x]\s*[0-9.]+\s*(?:cm|mm)?)/i)
              if (dm) {
                dims = parseDimensionsToCm(dm[1].replace(/[*×]/g, 'x'))
                console.log('[scrape] AliExpress dims (regex fallback):', dm[1], '->', dims)
              }
            }
          }
        } catch (mErr) {
          console.error('[scrape] AliExpress mobile fetch error:', mErr instanceof Error ? mErr.message : mErr)
        }

        // Step 2: If mobile failed, try desktop page
        if (!weightKg && !dims) {
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 10000)
            const dRes = await fetch(`https://www.aliexpress.com/item/${productId}.html`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
              },
              signal: controller.signal,
            })
            clearTimeout(timeout)
            console.log('[scrape] AliExpress desktop HTTP status:', dRes.status)

            if (dRes.ok) {
              const html = await dRes.text()
              console.log('[scrape] AliExpress desktop HTML length:', html.length)

              if (!productName || productName === 'AliExpress Product') {
                const nm = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/)
                if (nm) productName = nm[1].replace(/\s*[-|]\s*AliExpress.*$/i, '').trim()
              }

              const wm = html.match(/"attrName"\s*:\s*"[Pp]ackage [Ww]eight"[^}]*"attrValue"\s*:\s*"([^"]+)"/)
                || html.match(/[Pp]ackage\s+[Ww]eight[^:]*:\s*([0-9.]+\s*(?:kg|g|oz|lb))/i)
              if (wm && !weightKg) {
                weightKg = parseWeightToKg(wm[1])
                console.log('[scrape] AliExpress weight (desktop):', wm[1], '->', weightKg)
              }
              const dm = html.match(/"attrName"\s*:\s*"[Pp]ackage [Ss]ize"[^}]*"attrValue"\s*:\s*"([^"]+)"/)
                || html.match(/[Pp]ackage\s+[Ss]ize[^:]*:\s*([0-9.]+\s*[*×x]\s*[0-9.]+\s*[*×x]\s*[0-9.]+\s*(?:cm|mm)?)/i)
              if (dm && !dims) {
                dims = parseDimensionsToCm(dm[1].replace(/[*×]/g, 'x'))
                console.log('[scrape] AliExpress dims (desktop):', dm[1], '->', dims)
              }
            }
          } catch (dErr) {
            console.error('[scrape] AliExpress desktop fetch error:', dErr instanceof Error ? dErr.message : dErr)
          }
        }

        const detectedCategory = detectAliExpressCategory(category || productName)
        console.log('[scrape] AliExpress final — weight:', weightKg, 'dims:', dims, 'category:', detectedCategory)

        if (!weightKg && !dims) {
          return NextResponse.json({
            found: false,
            reason: 'AliExpress specs not available for this product. Please select an estimated weight below.',
            product_name: productName,
            category: detectedCategory,
            image_url: imageUrl,
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
          category: detectedCategory,
          actual_weight_kg: weightKg,
          length_cm: dims?.l ?? null,
          width_cm: dims?.w ?? null,
          height_cm: dims?.h ?? null,
          dimensional_weight_kg: dimensionalWeightKg,
          billable_weight_kg: billableWeightKg,
          image_url: imageUrl,
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.error('[scrape] AliExpress unexpected error:', msg)
        return NextResponse.json({ found: false, reason: `AliExpress scrape failed: ${msg}` })
      }
    }

    return NextResponse.json({ found: false, reason: 'Auto-calculate for this site is coming soon. Please enter details manually.' })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[scrape] Unhandled error:', message)
    return NextResponse.json({ found: false, reason: message }, { status: 500 })
  }
}
