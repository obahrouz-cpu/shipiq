// FLUTTER: lib/services/scrape_service.dart → scrapeProduct()
// Method: POST  Auth: none (rate-limited by IP)
// Body:   { url: string }
// Returns: ScrapeResult — see lib/api_schema.ts

import { NextRequest, NextResponse } from 'next/server'
import { SITE_INFO } from '@/lib/constants'
import { rateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

// ── Oxylabs Web Scraper API ───────────────────────────────────────────────────

const OXYLABS_USERNAME = process.env.OXYLABS_USERNAME || ''
const OXYLABS_PASSWORD = process.env.OXYLABS_PASSWORD || ''
const OXYLABS_AUTH = 'Basic ' + Buffer.from(`${OXYLABS_USERNAME}:${OXYLABS_PASSWORD}`).toString('base64')
const OXYLABS_ENDPOINT = 'https://realtime.oxylabs.io/v1/queries'

async function oxylabs(payload: Record<string, unknown>): Promise<{ content: unknown; status: number } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 50000)
  try {
    const res = await fetch(OXYLABS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: OXYLABS_AUTH },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error('[scrape] Oxylabs HTTP', res.status)
      return { content: null, status: res.status }
    }
    const data = await res.json()
    const result = data?.results?.[0]
    return { content: result?.content ?? null, status: result?.status_code ?? res.status }
  } catch (e) {
    console.error('[scrape] Oxylabs request failed:', e instanceof Error ? e.message : e)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// Rendered-HTML fetch for any site (source: universal, render: html).
async function oxylabsHtml(url: string): Promise<string | null> {
  const r = await oxylabs({ source: 'universal', url, render: 'html' })
  if (!r || typeof r.content !== 'string') return null
  return r.content
}

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

// UAE rate buckets — maps a free-text category/title to the rate key the
// frontend expects (UAE_Cosmetics / UAE_Supplements / UAE_Clothing / UAE_Accessories).
function detectUaeCategory(text: string): string {
  const c = (text || '').toLowerCase()
  if (/perfume|makeup|skincare|beauty|cosmetic|fragrance|lipstick|mascara|foundation|serum/.test(c)) return 'Cosmetics'
  if (/supplement|vitamin|protein|health|wellness|nutrition/.test(c)) return 'Supplements'
  if (/clothing|fashion|dress|shirt|shoes|footwear|apparel|trouser|pant|جلوبەرگ/.test(c)) return 'Clothing'
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

function extractOgImage(html: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  return m ? m[1] : null
}

function findField(sources: Record<string, unknown>[], keys: string[]): string | null {
  for (const key of keys) {
    for (const source of sources) {
      if (source[key]) return String(source[key])
    }
  }
  return null
}

// Case-insensitive fuzzy lookup over a flat key/value map.
function findFuzzy(kv: Record<string, string>, re: RegExp): string | null {
  for (const [k, v] of Object.entries(kv)) {
    if (re.test(k) && v) return v
  }
  return null
}

// Flattens an arbitrary parsed object into a { key: value } map, also unpacking
// arrays of { name/key, value } spec pairs (the shape Oxylabs uses for specs).
function collectKeyValues(obj: unknown, out: Record<string, string>, depth = 0): void {
  if (!obj || depth > 6) return
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>
        const k = rec.name ?? rec.key ?? rec.title ?? rec.label
        const v = rec.value ?? rec.val ?? rec.text ?? rec.description
        if (typeof k === 'string' && (typeof v === 'string' || typeof v === 'number')) {
          out[k] = String(v)
        }
        collectKeyValues(item, out, depth + 1)
      }
    }
    return
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number') {
        if (!(k in out)) out[k] = String(v)
      } else {
        collectKeyValues(v, out, depth + 1)
      }
    }
  }
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

function validateWeight(kg: number | null): number | null {
  if (kg === null) return null
  if (kg < 0.01 || kg > 50) return null
  return kg
}

function validateDims(dims: { l: number; w: number; h: number } | null): { l: number; w: number; h: number } | null {
  if (!dims) return null
  if (dims.l > 200 || dims.w > 200 || dims.h > 200) return null
  if ((dims.l * dims.w * dims.h) / 5000 > 50) return null
  return dims
}

// Generic spec extraction over rendered HTML: title, weight, dimensions, image.
function genericHtmlScan(html: string): {
  productName: string | null
  weightKg: number | null
  dims: { l: number; w: number; h: number } | null
  imageUrl: string | null
} {
  let productName: string | null = null
  let weightKg: number | null = null
  let dims: { l: number; w: number; h: number } | null = null

  const nameMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    || html.match(/<title>([^<]+)<\/title>/i)
  if (nameMatch) productName = nameMatch[1].trim()

  const imageUrl = extractOgImage(html)

  // <tr><th>key</th><td>value</td>
  const rowRe = /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi
  let rm: RegExpExecArray | null
  while ((rm = rowRe.exec(html)) !== null) {
    const key = stripTags(rm[1])
    const val = stripTags(rm[2])
    if (/weight/i.test(key) && val && !weightKg) weightKg = parseWeightToKg(val)
    if (/dimension/i.test(key) && val && !dims) dims = parseDimensionsToCm(val)
  }

  // <dt>key</dt><dd>value</dd>
  if (!weightKg || !dims) {
    const pairRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi
    let pm: RegExpExecArray | null
    while ((pm = pairRe.exec(html)) !== null) {
      const key = stripTags(pm[1])
      const val = stripTags(pm[2])
      if (/weight/i.test(key) && val && !weightKg) weightKg = parseWeightToKg(val)
      if (/dimension/i.test(key) && val && !dims) dims = parseDimensionsToCm(val)
    }
  }

  // JSON-LD
  const jsonLdTags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const tag of jsonLdTags) {
    try {
      const parsed = JSON.parse(tag.replace(/<script[^>]*>|<\/script>/gi, ''))
      const node = Array.isArray(parsed) ? parsed[0] : parsed
      if (!productName && node?.name) productName = String(node.name)
      if (!weightKg && node?.weight) {
        const w = typeof node.weight === 'object' ? (node.weight.value ?? '') : node.weight
        weightKg = parseWeightToKg(String(w))
      }
    } catch { /* skip */ }
  }

  // Regex fallback
  if (!weightKg) {
    const wm = html.match(/(?:Item|Net|Shipping|Package)?\s*Weight[^:<]{0,20}[:：]\s*([0-9.,]+\s*(?:kg|kilograms?|g|grams?|lbs?|pounds?|oz|ounces?))/i)
    if (wm) weightKg = parseWeightToKg(wm[1])
  }
  if (!dims) {
    const dm = html.match(/([0-9.]+\s*[x×*]\s*[0-9.]+\s*[x×*]\s*[0-9.]+\s*(?:inch|in|"|cm|mm)?)/i)
    if (dm) dims = parseDimensionsToCm(dm[1].replace(/[×*]/g, 'x'))
  }

  return { productName, weightKg, dims, imageUrl }
}

function buildWeightResponse(opts: {
  siteInfo: { site: string; country: string; flag: string }
  productName: string
  category?: string | null
  weightKg: number | null
  dims: { l: number; w: number; h: number } | null
  imageUrl?: string | null
}) {
  const { siteInfo, productName, category, imageUrl } = opts
  const weightKg = validateWeight(opts.weightKg)
  const dims = validateDims(opts.dims)
  const dimensionalWeightKg = dims ? Math.round((dims.l * dims.w * dims.h) / 5000 * 100) / 100 : null
  const billableWeightKg = weightKg && dimensionalWeightKg
    ? Math.max(weightKg, dimensionalWeightKg)
    : (weightKg || dimensionalWeightKg)

  return NextResponse.json({
    found: true,
    site: siteInfo,
    product_name: productName,
    category: category ?? undefined,
    actual_weight_kg: weightKg,
    length_cm: dims?.l ?? null,
    width_cm: dims?.w ?? null,
    height_cm: dims?.h ?? null,
    dimensional_weight_kg: dimensionalWeightKg,
    billable_weight_kg: billableWeightKg,
    image_url: imageUrl ?? null,
  })
}

export async function POST(req: NextRequest) {
  // Rate limit: 15 scrape requests per IP per minute (each call costs Oxylabs credit)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { ok } = rateLimit(ip, 'scrape', 15, 60_000)
  if (!ok) return NextResponse.json({ found: false, reason: 'Too many requests. Please wait a moment.' }, { status: 429 })

  if (!OXYLABS_USERNAME || !OXYLABS_PASSWORD) {
    return NextResponse.json({ found: false, reason: 'Scraper not configured.' }, { status: 503 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const url: unknown = body?.url
    if (!url || typeof url !== 'string') return NextResponse.json({ error: 'URL required' }, { status: 400 })
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json({ found: false, reason: 'Invalid URL.' }, { status: 400 })
    }
    if (url.length > 2000) return NextResponse.json({ found: false, reason: 'URL too long.' }, { status: 400 })

    const siteInfo = detectSite(url)
    if (!siteInfo) return NextResponse.json({ found: false, reason: 'Unsupported site' }, { status: 400 })

    // ── AMAZON (amazon.com, amazon.ae, …) — source: amazon_product ──────────────
    if (siteInfo.site.includes('amazon')) {
      const asin = extractAsin(url)
      if (!asin) return NextResponse.json({ found: false, reason: 'Could not extract product ID from URL. Make sure it is a direct product link.' })

      let domain = 'com'
      if (url.includes('amazon.co.uk')) domain = 'co.uk'
      else if (url.includes('amazon.de')) domain = 'de'
      else if (url.includes('amazon.ae')) domain = 'ae'
      else if (url.includes('amazon.ca')) domain = 'ca'

      const r = await oxylabs({ source: 'amazon_product', query: asin, domain, parse: true })
      if (!r || !r.content || typeof r.content !== 'object') {
        return NextResponse.json({ found: false, reason: 'Could not fetch product data. Try again or enter manually.' })
      }

      const content = r.content as Record<string, unknown>
      const kv: Record<string, string> = {}
      collectKeyValues(content, kv)

      const rawWeight = findFuzzy(kv, /weight/i) || findField([kv], WEIGHT_KEYS)
      const rawDimensions = findFuzzy(kv, /dimension/i) || findField([kv], DIM_KEYS)
      const productName = String(content.title || content.product_name || content.product_title || kv.title || 'Unknown Product')

      const images = content.images
      const imageUrl = Array.isArray(images) ? String(images[0] ?? '') || null : (content.main_image ? String(content.main_image) : null)

      let category: string | null = null
      if (siteInfo.country === 'UAE') {
        let catText = ''
        try {
          const catArr = content.category as Array<{ ladder?: Array<{ name?: string }> }> | undefined
          if (Array.isArray(catArr)) catText = catArr.map(c => (c.ladder || []).map(l => l.name).join(' ')).join(' ')
        } catch { /* ignore */ }
        category = detectUaeCategory(`${catText} ${productName}`)
      }

      if (!rawWeight && !rawDimensions) {
        return NextResponse.json({
          found: false,
          reason: 'Weight and dimensions not listed for this product. Please enter manually.',
          product_name: productName,
          category: category ?? undefined,
          image_url: imageUrl,
        })
      }

      const weightKg = validateWeight(rawWeight ? parseWeightToKg(rawWeight) : null)
      const dims = validateDims(rawDimensions ? parseDimensionsToCm(rawDimensions) : null)
      return buildWeightResponse({ siteInfo, productName, category, weightKg, dims, imageUrl })
    }

    // ── EBAY — source: ebay_product ─────────────────────────────────────────────
    if (siteInfo.site === 'ebay.com') {
      try {
        let productName = 'eBay Product'
        let weightKg: number | null = null
        let imageUrl: string | null = null

        const r = await oxylabs({ source: 'ebay_product', url, parse: true })
        if (r && r.content && typeof r.content === 'object') {
          const content = r.content as Record<string, unknown>
          const kv: Record<string, string> = {}
          collectKeyValues(content, kv)
          productName = String(content.title || content.product_name || kv.title || productName)
          const rawWeight = findFuzzy(kv, /weight/i)
          if (rawWeight) weightKg = parseWeightToKg(rawWeight)
          const images = content.images
          imageUrl = Array.isArray(images) ? String(images[0] ?? '') || null : null
        }

        // Fallback to rendered HTML if the parsed source gave us nothing useful.
        if (!weightKg) {
          const html = await oxylabsHtml(url)
          if (html) {
            const scan = genericHtmlScan(html)
            if (scan.productName) productName = scan.productName
            if (scan.weightKg) weightKg = scan.weightKg
            if (scan.imageUrl) imageUrl = scan.imageUrl
          }
        }

        weightKg = validateWeight(weightKg)

        if (!weightKg) {
          return NextResponse.json({
            found: false,
            reason: 'Weight not listed for this eBay item. Please enter manually.',
            product_name: productName,
            image_url: imageUrl,
          })
        }

        return buildWeightResponse({ siteInfo, productName, weightKg, dims: null, imageUrl })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.error('[scrape] eBay error:', msg)
        return NextResponse.json({ found: false, reason: `eBay scrape failed: ${msg}` })
      }
    }

    // ── TRENDYOL — source: universal (render html) ──────────────────────────────
    if (siteInfo.site === 'trendyol.com') {
      try {
        const html = await oxylabsHtml(url)
        if (!html) return NextResponse.json({ found: false, reason: 'Could not fetch Trendyol page. Please enter manually.' })

        const scan = genericHtmlScan(html)
        let productName = scan.productName ? scan.productName.replace(/ \| Trendyol.*$/, '').trim() : 'Trendyol Product'
        // Do NOT use scan.weightKg for Trendyol — generic scan grabs wrong numbers.
        // Weight is extracted only from the spec table and JSON-LD below.
        let weightKg: number | null = null
        let dims = scan.dims

        const catMatch = html.match(/"categoryName"\s*:\s*"([^"]+)"/) || html.match(/"pattern"\s*:\s*"([^"]+)"/)
        const category = catMatch ? catMatch[1] : null

        // 1. Spec table rows — Trendyol stores weight in grams in these rows
        const weightTableKeys = ['Ağırlık', 'Net Ağırlık', 'Paket Ağırlığı']
        const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
        let trM: RegExpExecArray | null
        while ((trM = trRe.exec(html)) !== null && !weightKg) {
          const cells = trM[1].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []
          if (cells.length >= 2 && cells[0] && cells[1]) {
            const key = stripTags(cells[0]).trim()
            const val = stripTags(cells[1]).trim()
            if (weightTableKeys.some(k => key.includes(k)) && val) {
              const num = parseFloat(val.replace(/[^0-9.]/g, ''))
              if (!isNaN(num) && num > 0) {
                weightKg = val.toLowerCase().includes('kg')
                  ? Math.round(num * 100) / 100
                  : Math.round(num / 1000 * 100) / 100
              }
            }
          }
        }

        // 2. JSON-LD structured data
        if (!weightKg) {
          const jsonLdTags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
          for (const tag of jsonLdTags) {
            try {
              const parsed = JSON.parse(tag.replace(/<script[^>]*>|<\/script>/gi, ''))
              const node = Array.isArray(parsed) ? parsed[0] : parsed
              if (!weightKg && node?.weight) {
                const w = typeof node.weight === 'object' ? (node.weight.value ?? '') : node.weight
                weightKg = parseWeightToKg(String(w))
              }
            } catch { /* skip */ }
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

        // Validate before returning — rejects obviously wrong values
        weightKg = validateWeight(weightKg)
        dims = validateDims(dims)

        if (!weightKg && !dims) {
          return NextResponse.json({
            found: false,
            reason: 'Could not extract weight/dimensions from Trendyol. Trendyol does not always include shipping specs — please enter manually.',
            product_name: productName,
            category,
          })
        }

        return buildWeightResponse({ siteInfo, productName, category, weightKg, dims, imageUrl: scan.imageUrl })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.error('[scrape] Trendyol error:', msg)
        return NextResponse.json({ found: false, reason: `Trendyol scrape failed: ${msg}` })
      }
    }

    // ── ALIEXPRESS — source: universal (render html) ────────────────────────────
    if (siteInfo.site === 'aliexpress.com') {
      try {
        const html = await oxylabsHtml(url)
        if (!html) return NextResponse.json({ found: false, reason: 'Could not fetch AliExpress page. Please select an estimated weight below.' })

        const scan = genericHtmlScan(html)
        let productName = scan.productName ? scan.productName.replace(/\s*[-|]\s*AliExpress.*$/i, '').trim() : 'AliExpress Product'
        let weightKg = scan.weightKg
        let dims = scan.dims
        const imageUrl = scan.imageUrl
        let category: string | null = null

        // window.runParams — main product JSON embedded in the page
        const runParamsM = html.match(/window\.runParams\s*=\s*(\{[\s\S]{10,200000}?\});\s*(?:window|var|let|const|<\/script>)/m)
        if (runParamsM) {
          try {
            const rp = JSON.parse(runParamsM[1]) as Record<string, unknown>
            const data = (rp.data as Record<string, unknown>) || rp
            const titleModule = data.titleModule as { subject?: string } | undefined
            if (titleModule?.subject) productName = String(titleModule.subject)

            const breadcrumbModule = data.breadcrumbModule as { breadcrumbs?: Array<{ name?: string }> } | undefined
            const crumbs = breadcrumbModule?.breadcrumbs
            if (Array.isArray(crumbs) && crumbs.length >= 1) {
              category = String(crumbs[crumbs.length - 2]?.name || crumbs[crumbs.length - 1]?.name || '')
            }

            const specsModule = data.specsModule as { props?: Array<Record<string, unknown>> } | undefined
            const specs = specsModule?.props
            if (Array.isArray(specs)) {
              for (const spec of specs) {
                const attrName = String(spec.attrName || spec.name || '').toLowerCase()
                const attrVal = String(spec.attrValue || spec.value || '')
                if (/package\s*weight|item\s*weight|net\s*weight/i.test(attrName) && attrVal && !weightKg) {
                  weightKg = parseWeightToKg(attrVal)
                }
                if (/package\s*size|product\s*size|item\s*size|package\s*dimension/i.test(attrName) && attrVal && !dims) {
                  dims = parseDimensionsToCm(attrVal.replace(/[*×∗]/g, 'x').replace(/\s+x\s+/gi, ' x '))
                }
              }
            }
          } catch { /* skip bad JSON */ }
        }

        // Regex fallbacks on raw HTML
        if (!weightKg) {
          const wm = html.match(/"attrName"\s*:\s*"[Pp]ackage [Ww]eight"[^}]*"attrValue"\s*:\s*"([^"]+)"/)
            || html.match(/[Pp]ackage\s+[Ww]eight[^:]*:\s*([0-9.]+\s*(?:kg|g|oz|lb))/i)
          if (wm) weightKg = parseWeightToKg(wm[1])
        }
        if (!dims) {
          const dm = html.match(/"attrName"\s*:\s*"[Pp]ackage [Ss]ize"[^}]*"attrValue"\s*:\s*"([^"]+)"/)
            || html.match(/[Pp]ackage\s+[Ss]ize[^:]*:\s*([0-9.]+\s*[*×x]\s*[0-9.]+\s*[*×x]\s*[0-9.]+\s*(?:cm|mm)?)/i)
          if (dm) dims = parseDimensionsToCm(dm[1].replace(/[*×]/g, 'x'))
        }

        const detectedCategory = detectAliExpressCategory(category || productName)
        weightKg = validateWeight(weightKg)
        dims = validateDims(dims)

        if (!weightKg && !dims) {
          return NextResponse.json({
            found: false,
            reason: 'AliExpress specs not available for this product. Please select an estimated weight below.',
            product_name: productName,
            category: detectedCategory,
            image_url: imageUrl,
          })
        }

        return buildWeightResponse({ siteInfo, productName, category: detectedCategory, weightKg, dims, imageUrl })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.error('[scrape] AliExpress error:', msg)
        return NextResponse.json({ found: false, reason: `AliExpress scrape failed: ${msg}` })
      }
    }

    // ── NOON — source: universal (render html) ──────────────────────────────────
    if (siteInfo.site === 'noon.com') {
      try {
        const html = await oxylabsHtml(url)
        if (!html) {
          return NextResponse.json({ found: false, reason: 'Could not fetch Noon page. Please select an estimated weight below.', category: 'Accessories' })
        }

        const scan = genericHtmlScan(html)
        const productName = scan.productName ? scan.productName.replace(/\s*[|\-–]\s*noon.*$/i, '').trim() : 'Noon Product'
        let weightKg = validateWeight(scan.weightKg)

        let categoryRaw = ''
        const catMatch = html.match(/"categoryName"\s*:\s*"([^"]+)"/)
          || html.match(/<meta[^>]+property=["']product:category["'][^>]+content=["']([^"']+)["']/)
        if (catMatch) categoryRaw = catMatch[1]
        const category = detectUaeCategory(`${categoryRaw} ${productName}`)

        if (!weightKg) {
          return NextResponse.json({
            found: false,
            reason: 'Could not extract weight from Noon. Please select an estimated weight below.',
            product_name: productName,
            category,
          })
        }

        return buildWeightResponse({ siteInfo, productName, category, weightKg, dims: scan.dims, imageUrl: scan.imageUrl })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.error('[scrape] Noon error:', msg)
        return NextResponse.json({ found: false, reason: `Noon scrape failed: ${msg}`, category: 'Accessories' })
      }
    }

    // ── BOUTIQAAT — source: universal (render html) ─────────────────────────────
    if (siteInfo.site === 'boutiqaat.com') {
      try {
        const category = 'Cosmetics'
        const html = await oxylabsHtml(url)
        if (!html) {
          return NextResponse.json({ found: false, reason: 'Could not fetch Boutiqaat page. Please select an estimated weight below.', category })
        }

        const scan = genericHtmlScan(html)
        const productName = scan.productName ? scan.productName.replace(/\s*[|\-–]\s*(boutiqaat|بوتيكات).*$/i, '').trim() : 'Boutiqaat Product'
        const weightKg = validateWeight(scan.weightKg)

        if (!weightKg) {
          return NextResponse.json({
            found: false,
            reason: 'Could not extract weight from Boutiqaat. Please select an estimated weight below.',
            product_name: productName,
            category,
          })
        }

        return buildWeightResponse({ siteInfo, productName, category, weightKg, dims: scan.dims, imageUrl: scan.imageUrl })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.error('[scrape] Boutiqaat error:', msg)
        return NextResponse.json({ found: false, reason: `Boutiqaat scrape failed: ${msg}`, category: 'Cosmetics' })
      }
    }

    // ── NEWEGG / BEST BUY — source: universal (render html) ─────────────────────
    if (siteInfo.site === 'newegg.com' || siteInfo.site === 'bestbuy.com') {
      const label = siteInfo.site === 'newegg.com' ? 'Newegg' : 'Best Buy'
      try {
        const category = 'Electronics'
        const html = await oxylabsHtml(url)
        if (!html) {
          return NextResponse.json({ found: false, reason: `Could not fetch ${label} page. Please enter details manually.`, category })
        }

        const scan = genericHtmlScan(html)
        const stripSuffix = siteInfo.site === 'newegg.com' ? /\s*-\s*Newegg\.com.*$/i : /\s*[-|]\s*Best Buy.*$/i
        const productName = scan.productName ? scan.productName.replace(stripSuffix, '').trim() : `${label} Product`

        const validWeightKg = validateWeight(scan.weightKg)
        const validDims = validateDims(scan.dims)

        if (!validWeightKg && !validDims) {
          return NextResponse.json({
            found: false,
            reason: `Could not extract weight/dimensions from ${label}. Specs vary by product — please enter manually.`,
            product_name: productName,
            category,
          })
        }

        return buildWeightResponse({ siteInfo, productName, category, weightKg: validWeightKg, dims: validDims, imageUrl: scan.imageUrl })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.error(`[scrape] ${label} error:`, msg)
        return NextResponse.json({ found: false, reason: `${label} scrape failed: ${msg}` })
      }
    }

    // ── ALL OTHER SUPPORTED SITES — universal HTML, thumbnail only ──────────────
    try {
      const html = await oxylabsHtml(url)
      if (html) {
        const scan = genericHtmlScan(html)
        if (scan.weightKg || scan.dims) {
          return buildWeightResponse({
            siteInfo,
            productName: scan.productName || 'Product',
            weightKg: scan.weightKg,
            dims: scan.dims,
            imageUrl: scan.imageUrl,
          })
        }
        return NextResponse.json({
          found: false,
          reason: 'Weight not listed for this product. Please enter details manually.',
          product_name: scan.productName || undefined,
          image_url: scan.imageUrl,
        })
      }
    } catch (e: unknown) {
      console.error('[scrape] universal fallback error:', e instanceof Error ? e.message : e)
    }

    return NextResponse.json({ found: false, reason: 'Auto-calculate for this site is coming soon. Please enter details manually.' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[scrape] Unhandled error:', message)
    return NextResponse.json({ found: false, reason: message }, { status: 500 })
  }
}
