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
// `extra` merges into the payload — e.g. { geo_location: 'United Arab Emirates' }
// for region-locked sites (Noon/Boutiqaat block non-UAE IPs with status 613).
async function oxylabsHtml(url: string, extra: Record<string, unknown> = {}): Promise<string | null> {
  const r = await oxylabs({ source: 'universal', url, render: 'html', ...extra })
  if (!r || typeof r.content !== 'string') return null
  return r.content
}

const UAE_GEO = { geo_location: 'United Arab Emirates' } as const

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

// ── Category normalization ────────────────────────────────────────────────────
// Maps a raw breadcrumb/title to one of the buckets below. Easy to extend: just
// add keywords (lowercase) to a bucket. Bilingual (EN/TR/AR) because Trendyol
// returns Turkish taxonomy and Noon/Boutiqaat sometimes return Arabic.
// First bucket (in CATEGORY_PRIORITY order) with a matching keyword wins.
type MappedCategory = 'cosmetics' | 'supplements' | 'clothing' | 'electronics' | 'accessories' | 'uncategorized'

const CATEGORY_KEYWORDS: Record<Exclude<MappedCategory, 'uncategorized'>, string[]> = {
  supplements: ['vitamin', 'protein', 'supplement', 'nutrition', 'creatine', 'collagen', 'omega',
    'takviye', 'gıda takviyesi', 'مكمل', 'فيتامين'],
  cosmetics: ['makeup', 'make-up', 'skincare', 'skin care', 'perfume', 'fragrance', 'cosmetic', 'beauty',
    'lipstick', 'mascara', 'foundation', 'serum', 'moisturizer',
    'parfüm', 'kozmetik', 'makyaj', 'cilt', 'güzellik', 'ruj',
    'عطر', 'مكياج', 'تجميل', 'عناية بالبشرة'],
  clothing: ['shirt', 'dress', 'shoes', 'apparel', 'jacket', 'pants', 'clothing', 'footwear', 'trouser',
    't-shirt', 'hoodie', 'jeans', 'skirt', 'coat',
    'giyim', 'elbise', 'ayakkabı', 'gömlek', 'pantolon', 'ceket', 'tişört',
    'ملابس', 'حذاء', 'فستان'],
  electronics: ['phone', 'smartphone', 'laptop', 'tablet', 'headphone', 'earphone', 'earbud', 'camera',
    'console', 'controller', 'speaker', 'monitor', 'electronic', 'gadget', 'charger', 'smartwatch',
    'ssd', 'hard drive', 'gpu', 'graphics card', 'mouse', 'keyboard', 'television', ' tv',
    'telefon', 'bilgisayar', 'kulaklık', 'elektronik', 'kamera', 'şarj',
    'إلكترونيات', 'هاتف', 'لابتوب'],
  accessories: ['case', 'cable', 'watch band', 'strap', 'bag', 'wallet', 'jewelry', 'jewellery', 'accessory',
    'accessories', 'cover', 'sticker', 'keychain',
    'kılıf', 'çanta', 'cüzdan', 'aksesuar', 'kablo',
    'حقيبة', 'محفظة', 'اكسسوار', 'مجوهرات'],
}

// accessories last — it's the catch-all bucket per spec.
const CATEGORY_PRIORITY: Array<Exclude<MappedCategory, 'uncategorized'>> = [
  'supplements', 'cosmetics', 'clothing', 'electronics', 'accessories',
]

function mapCategory(rawCategory: string | null, productTitle?: string | null): MappedCategory {
  // Prefer the breadcrumb (authoritative); fall back to the product title.
  const text = `${rawCategory || ''} ${productTitle || ''}`.toLowerCase()
  if (!text.trim()) return 'uncategorized'
  for (const bucket of CATEGORY_PRIORITY) {
    if (CATEGORY_KEYWORDS[bucket].some(kw => text.includes(kw))) return bucket
  }
  return 'uncategorized'
}

// ── JSON-LD helpers (price + breadcrumb live here on most non-Amazon sites) ───
function parseJsonLdNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const tags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const tag of tags) {
    try {
      const parsed = JSON.parse(tag.replace(/<script[^>]*>|<\/script>/gi, ''))
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      for (const node of arr) {
        if (node && typeof node === 'object') {
          out.push(node)
          const graph = (node as Record<string, unknown>)['@graph']
          if (Array.isArray(graph)) for (const g of graph) if (g && typeof g === 'object') out.push(g)
        }
      }
    } catch { /* skip malformed */ }
  }
  return out
}

function jsonLdBreadcrumb(html: string): string | null {
  for (const node of parseJsonLdNodes(html)) {
    if (node['@type'] === 'BreadcrumbList' && Array.isArray(node.itemListElement)) {
      const names = (node.itemListElement as Array<Record<string, unknown>>)
        .map(e => {
          const item = e.item as Record<string, unknown> | undefined
          return (e.name ?? item?.name ?? '') as string
        })
        .filter(Boolean)
        .filter(n => n.toLowerCase() !== 'home')
      if (names.length) return names.join(' > ')
    }
  }
  return null
}

function jsonLdOffer(html: string): { price: number | null; currency: string | null } {
  for (const node of parseJsonLdNodes(html)) {
    const type = node['@type']
    const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'))
    if (!isProduct && !node.offers) continue
    const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers
    if (offers && typeof offers === 'object') {
      const o = offers as Record<string, unknown>
      const price = parseFloat(String(o.price ?? o.lowPrice ?? ''))
      const currency = o.priceCurrency ? String(o.priceCurrency) : null
      if (!isNaN(price) && price > 0) return { price, currency }
      if (currency) return { price: null, currency }
    }
  }
  return { price: null, currency: null }
}

// Amazon: price reflects the buy-box winner, which is often a 3rd-party seller,
// and price_buybox can be -1. Prefer an Amazon (1P) offer, then fall back to the
// resolved top-level price. Never use the "New & Used from $X" lowest figure.
const AMAZON_SELLER_IDS = new Set(['ATVPDKIKX0DER'])

function isAmazonSeller(o: Record<string, unknown> | undefined): boolean {
  if (!o) return false
  const name = String(o.seller_name ?? o.name ?? '').toLowerCase()
  return name === 'amazon.com' || name.startsWith('amazon') ||
    AMAZON_SELLER_IDS.has(String(o.seller_id ?? '')) || o.is_amazon_fulfilled === true
}

function extractAmazonPrice(content: Record<string, unknown>): { price: number | null; currency: string | null } {
  const currency = content.currency ? String(content.currency) : null
  const buybox = Array.isArray(content.buybox) ? content.buybox as Record<string, unknown>[] : []
  const amazonOffer = buybox.find(o => isAmazonSeller(o) && Number(o?.price) > 0)
  if (amazonOffer) return { price: Number(amazonOffer.price), currency }
  for (const key of ['price', 'price_buybox', 'price_upper'] as const) {
    const n = Number(content[key])
    if (n > 0) return { price: n, currency }
  }
  return { price: null, currency }
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
  if (lower.includes('kg') || lower.includes('kilogram')) return Math.round(num * 100) / 100
  if (lower.includes('g')) return Math.round(num / 1000 * 100) / 100
  return Math.round(num * 100) / 100
}

// Pulls a weight token (number + unit) out of an arbitrary string. Amazon often
// embeds weight inside the dimensions value, e.g. "11.5 x 13.4 x 4 inches; 16 Pounds".
function extractWeightToken(s: string | null): string | null {
  if (!s) return null
  const m = s.match(/([\d.]+)\s*(kilograms?|pounds?|ounces?|grams?|kgs?|lbs?|oz)\b/i)
  return m ? m[0] : null
}

function parseDimensionsToCm(dimStr: string): { l: number; w: number; h: number } | null {
  if (!dimStr) return null
  // Handles "30 x 20 x 10 cm", "11.5 x 13.4 x 4 inches", and Amazon's labelled
  // form 11.81"L x 0.51"W x 8.03"Th — number, optional unit, optional L/W/H/Th label.
  const match = dimStr.match(
    /([\d.]+)\s*(?:"|inches?|in|cm|mm)?\s*[a-z]{0,3}\s*[x×*]\s*([\d.]+)\s*(?:"|inches?|in|cm|mm)?\s*[a-z]{0,3}\s*[x×*]\s*([\d.]+)/i
  )
  if (!match) return null
  let l = parseFloat(match[1])
  let w = parseFloat(match[2])
  let h = parseFloat(match[3])
  if (isNaN(l) || isNaN(w) || isNaN(h)) return null
  const lower = dimStr.toLowerCase()
  if (lower.includes('mm')) {
    l /= 10; w /= 10; h /= 10
  } else if (!lower.includes('cm')) {
    // Inches (explicit " / inch, or no metric unit — Amazon's default)
    l *= 2.54; w *= 2.54; h *= 2.54
  }
  return {
    l: Math.round(l * 10) / 10,
    w: Math.round(w * 10) / 10,
    h: Math.round(h * 10) / 10,
  }
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
  // ── scrape-contract additions (see Step 2–4) ──
  price?: number | null
  currency?: string | null
  rawCategory?: string | null
  rawWeight?: string | null
}) {
  const { siteInfo, productName, category, imageUrl } = opts
  const actualWeightKg = validateWeight(opts.weightKg)
  const dims = validateDims(opts.dims)
  const dimensionalWeightKg = dims ? Math.round((dims.l * dims.w * dims.h) / 5000 * 100) / 100 : null

  // Billable weight is the greater of actual weight and dimensional weight.
  let billableWeightKg: number | null
  if (actualWeightKg != null && dimensionalWeightKg != null) {
    billableWeightKg = Math.max(actualWeightKg, dimensionalWeightKg)
  } else {
    billableWeightKg = actualWeightKg ?? dimensionalWeightKg
  }

  console.error('Actual weight:', actualWeightKg, 'kg')
  console.error('Dimensional weight:', dimensionalWeightKg, 'kg')
  console.error('Billable weight:', billableWeightKg, 'kg')

  const weightKg = actualWeightKg

  return NextResponse.json({
    found: true,
    site: siteInfo,
    product_name: productName,
    category: category ?? undefined,            // unchanged — feeds existing UAE rate buckets
    actual_weight_kg: weightKg,
    length_cm: dims?.l ?? null,
    width_cm: dims?.w ?? null,
    height_cm: dims?.h ?? null,
    dimensional_weight_kg: dimensionalWeightKg,
    billable_weight_kg: billableWeightKg,
    image_url: imageUrl ?? null,
    // ── new scrape contract ──
    price: opts.price ?? null,
    currency: opts.currency ?? null,
    rawCategory: opts.rawCategory ?? null,
    mappedCategory: mapCategory(opts.rawCategory ?? null, productName),
    weightUnit: weightKg != null ? 'kg' : null,  // all weights normalized to kg
    raw_weight: opts.rawWeight ?? null,           // native source string, for debugging
  }, {
    // A product's weight/dimensions don't change — cache successful scrapes 30 min.
    headers: { 'Cache-Control': 'public, s-maxage=1800, max-age=1800, stale-while-revalidate=3600' },
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

      let rawWeight = findFuzzy(kv, /weight/i) || findField([kv], WEIGHT_KEYS)
      const rawDimensions = findFuzzy(kv, /dimension/i) || findField([kv], DIM_KEYS)
      // Amazon frequently lists weight only inside the dimensions value
      // (e.g. "11.5 x 13.4 x 4 inches; 16 Pounds"), with no standalone weight field.
      if (!rawWeight) rawWeight = extractWeightToken(rawDimensions)
      const productName = String(content.title || content.product_name || content.product_title || kv.title || 'Unknown Product')

      const images = content.images
      const imageUrl = Array.isArray(images) ? String(images[0] ?? '') || null : (content.main_image ? String(content.main_image) : null)

      // Raw breadcrumb from the amazon_product parser's category ladder (often
      // populated, but empty for some 3P/variant pages — then fall back to title).
      let rawCategory: string | null = null
      try {
        const catArr = content.category as Array<{ ladder?: Array<{ name?: string }> }> | undefined
        if (Array.isArray(catArr)) {
          const names: string[] = []
          for (const c of catArr) for (const l of (c.ladder || [])) if (l?.name) names.push(String(l.name))
          if (names.length) rawCategory = names.join(' > ')
        }
      } catch { /* ignore */ }

      // Seller-aware price: prefer the Amazon (1P) offer over a 3P buy-box.
      const { price, currency } = extractAmazonPrice(content)

      let category: string | null = null   // unchanged — existing UAE rate bucket
      if (siteInfo.country === 'UAE') {
        category = detectUaeCategory(`${rawCategory || ''} ${productName}`)
      }

      if (!rawWeight && !rawDimensions) {
        return NextResponse.json({
          found: false,
          reason: 'Weight and dimensions not listed for this product. Please enter manually.',
          product_name: productName,
          category: category ?? undefined,
          image_url: imageUrl,
          price,
          currency,
          rawCategory,
          mappedCategory: mapCategory(rawCategory, productName),
        })
      }

      const weightKg = validateWeight(rawWeight ? parseWeightToKg(rawWeight) : null)
      const dims = validateDims(rawDimensions ? parseDimensionsToCm(rawDimensions) : null)
      return buildWeightResponse({ siteInfo, productName, category, weightKg, dims, imageUrl, price, currency, rawCategory, rawWeight })
    }

    // ── EBAY — source: ebay_product ─────────────────────────────────────────────
    if (siteInfo.site === 'ebay.com') {
      try {
        let productName = 'eBay Product'
        let weightKg: number | null = null
        let imageUrl: string | null = null
        let rawWeightStr: string | null = null
        let price: number | null = null
        let currency: string | null = null
        let rawCategory: string | null = null

        const r = await oxylabs({ source: 'ebay_product', url, parse: true })
        if (r && r.content && typeof r.content === 'object') {
          const content = r.content as Record<string, unknown>
          const kv: Record<string, string> = {}
          collectKeyValues(content, kv)
          productName = String(content.title || content.product_name || kv.title || productName)
          rawWeightStr = findFuzzy(kv, /weight/i)
          if (rawWeightStr) weightKg = parseWeightToKg(rawWeightStr)
          const images = content.images
          imageUrl = Array.isArray(images) ? String(images[0] ?? '') || null : null
          // eBay parser: price is a number or { value, currency }
          const p = content.price as unknown
          if (typeof p === 'number') price = p
          else if (p && typeof p === 'object') {
            const po = p as Record<string, unknown>
            const v = parseFloat(String(po.value ?? po.amount ?? ''))
            if (!isNaN(v) && v > 0) price = v
            if (po.currency) currency = String(po.currency)
          } else if (typeof p === 'string') {
            const v = parseFloat(p.replace(/[^0-9.]/g, '')); if (!isNaN(v) && v > 0) price = v
          }
          if (!currency && content.currency) currency = String(content.currency)
          const cat = content.categories ?? content.category ?? content.breadcrumbs
          if (Array.isArray(cat)) rawCategory = cat.map(c => (typeof c === 'string' ? c : (c as Record<string, unknown>)?.name)).filter(Boolean).join(' > ') || null
        }

        // Fallback to rendered HTML if the parsed source gave us nothing useful.
        if (!weightKg || price == null || !rawCategory) {
          const html = await oxylabsHtml(url)
          if (html) {
            const scan = genericHtmlScan(html)
            if (scan.productName) productName = scan.productName
            if (scan.weightKg && !weightKg) weightKg = scan.weightKg
            if (scan.imageUrl && !imageUrl) imageUrl = scan.imageUrl
            if (price == null) { const o = jsonLdOffer(html); if (o.price) { price = o.price; currency = currency || o.currency } }
            if (!rawCategory) rawCategory = jsonLdBreadcrumb(html)
          }
        }

        weightKg = validateWeight(weightKg)

        if (!weightKg) {
          return NextResponse.json({
            found: false,
            reason: 'Weight not listed for this eBay item. Please enter manually.',
            product_name: productName,
            image_url: imageUrl,
            price,
            currency,
            rawCategory,
            mappedCategory: mapCategory(rawCategory, productName),
          })
        }

        return buildWeightResponse({ siteInfo, productName, weightKg, dims: null, imageUrl, price, currency, rawCategory, rawWeight: rawWeightStr })
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

        // Category: prefer JSON-LD breadcrumb, then Trendyol's embedded category
        // fields. NOTE: Trendyol's taxonomy is Turkish (e.g. "iPhone IOS Cep
        // Telefonları") — mapCategory() carries Turkish keywords to handle it.
        const catMatch = html.match(/"categoryName"\s*:\s*"([^"]+)"/) || html.match(/"pattern"\s*:\s*"([^"]+)"/)
        const rawCategory = jsonLdBreadcrumb(html) || (catMatch ? catMatch[1] : null)
        const category = rawCategory   // unchanged downstream usage

        // Price: Trendyol exposes it in JSON-LD offers and embedded sellingPrice.
        let price: number | null = null
        let currency: string | null = null
        const offer = jsonLdOffer(html)
        if (offer.price) { price = offer.price; currency = offer.currency }
        if (price == null) {
          const pm = html.match(/"sellingPrice"\s*:\s*\{[^}]*?"(?:value|text)"\s*:\s*"?([0-9.,]+)/)
            || html.match(/"sellingPrice"\s*:\s*"?([0-9.,]+)/)
            || html.match(/"price"\s*:\s*"?([0-9]+(?:[.,][0-9]+)?)"?/)
          if (pm) { const v = parseFloat(pm[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')); if (!isNaN(v) && v > 0) price = v }
          if (!currency) currency = 'TRY'
        }

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
            price,
            currency,
            rawCategory,
            mappedCategory: mapCategory(rawCategory, productName),
          })
        }

        return buildWeightResponse({ siteInfo, productName, category, weightKg, dims, imageUrl: scan.imageUrl, price, currency, rawCategory })
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
        let rawCategory: string | null = jsonLdBreadcrumb(html)
        let price: number | null = null
        let currency: string | null = null

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
              const path = crumbs.map(c => c?.name).filter(Boolean).join(' > ')
              if (path) rawCategory = rawCategory || path
            }

            const priceModule = data.priceModule as Record<string, unknown> | undefined
            if (priceModule) {
              const min = priceModule.minActivAmount ?? priceModule.minAmount
              const v = parseFloat(String((min as Record<string, unknown>)?.value ?? priceModule.formatedActivityPrice ?? priceModule.formatedPrice ?? '').replace(/[^0-9.]/g, ''))
              if (!isNaN(v) && v > 0) price = v
              const cur = (min as Record<string, unknown>)?.currency ?? priceModule.currencyCode
              if (cur) currency = String(cur)
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
        if (!rawCategory && category) rawCategory = category
        weightKg = validateWeight(weightKg)
        dims = validateDims(dims)

        if (!weightKg && !dims) {
          return NextResponse.json({
            found: false,
            reason: 'AliExpress specs not available for this product. Please select an estimated weight below.',
            product_name: productName,
            category: detectedCategory,
            image_url: imageUrl,
            price,
            currency,
            rawCategory,
            mappedCategory: mapCategory(rawCategory, productName),
          })
        }

        return buildWeightResponse({ siteInfo, productName, category: detectedCategory, weightKg, dims, imageUrl, price, currency, rawCategory })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.error('[scrape] AliExpress error:', msg)
        return NextResponse.json({ found: false, reason: `AliExpress scrape failed: ${msg}` })
      }
    }

    // ── NOON — source: universal (render html) ──────────────────────────────────
    // Region-locked: needs UAE geo or Oxylabs returns status 613 / empty.
    if (siteInfo.site === 'noon.com') {
      try {
        const html = await oxylabsHtml(url, UAE_GEO)
        if (!html) {
          return NextResponse.json({ found: false, reason: 'Could not fetch Noon page. Please select an estimated weight below.', category: 'Accessories' })
        }

        const scan = genericHtmlScan(html)
        const productName = scan.productName ? scan.productName.replace(/\s*[|\-–]\s*noon.*$/i, '').trim() : 'Noon Product'
        let weightKg = validateWeight(scan.weightKg)

        // Category: JSON-LD breadcrumb is cleanest on Noon; fall back to embedded fields.
        const catMatch = html.match(/"categoryName"\s*:\s*"([^"]+)"/)
          || html.match(/<meta[^>]+property=["']product:category["'][^>]+content=["']([^"']+)["']/)
        const rawCategory = jsonLdBreadcrumb(html) || (catMatch ? catMatch[1] : null)
        const category = detectUaeCategory(`${rawCategory || ''} ${productName}`)

        // Price: JSON-LD offers, then embedded salePrice/sellingPrice (AED).
        const offer = jsonLdOffer(html)
        let price: number | null = offer.price
        let currency: string | null = offer.currency
        if (price == null) {
          const pm = html.match(/"salePrice"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)/)
            || html.match(/"sellingPrice"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)/)
          if (pm) { const v = parseFloat(pm[1]); if (!isNaN(v) && v > 0) price = v }
        }
        if (!currency && price != null) currency = 'AED'

        if (!weightKg) {
          return NextResponse.json({
            found: false,
            reason: 'Could not extract weight from Noon. Please select an estimated weight below.',
            product_name: productName,
            category,
            price,
            currency,
            rawCategory,
            mappedCategory: mapCategory(rawCategory, productName),
          })
        }

        return buildWeightResponse({ siteInfo, productName, category, weightKg, dims: scan.dims, imageUrl: scan.imageUrl, price, currency, rawCategory })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scrape error'
        console.error('[scrape] Noon error:', msg)
        return NextResponse.json({ found: false, reason: `Noon scrape failed: ${msg}`, category: 'Accessories' })
      }
    }

    // ── BOUTIQAAT — source: universal (render html) ─────────────────────────────
    // Region-locked (UAE), like Noon — pass UAE geo.
    if (siteInfo.site === 'boutiqaat.com') {
      try {
        const category = 'Cosmetics'
        const html = await oxylabsHtml(url, UAE_GEO)
        if (!html) {
          return NextResponse.json({ found: false, reason: 'Could not fetch Boutiqaat page. Please select an estimated weight below.', category })
        }

        const scan = genericHtmlScan(html)
        const productName = scan.productName ? scan.productName.replace(/\s*[|\-–]\s*(boutiqaat|بوتيكات).*$/i, '').trim() : 'Boutiqaat Product'
        const weightKg = validateWeight(scan.weightKg)
        const rawCategory = jsonLdBreadcrumb(html)
        const offer = jsonLdOffer(html)
        const price = offer.price
        const currency = offer.currency || (price != null ? 'AED' : null)

        if (!weightKg) {
          return NextResponse.json({
            found: false,
            reason: 'Could not extract weight from Boutiqaat. Please select an estimated weight below.',
            product_name: productName,
            category,
            price,
            currency,
            rawCategory,
            mappedCategory: 'cosmetics',
          })
        }

        return buildWeightResponse({ siteInfo, productName, category, weightKg, dims: scan.dims, imageUrl: scan.imageUrl, price, currency, rawCategory: rawCategory || 'cosmetics' })
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
        // Both expose a clean JSON-LD breadcrumb + offer price in raw HTML.
        const rawCategory = jsonLdBreadcrumb(html)
        const offer = jsonLdOffer(html)
        const price = offer.price
        const currency = offer.currency || (price != null ? 'USD' : null)

        if (!validWeightKg && !validDims) {
          return NextResponse.json({
            found: false,
            reason: `Could not extract weight/dimensions from ${label}. Specs vary by product — please enter manually.`,
            product_name: productName,
            category,
            price,
            currency,
            rawCategory,
            mappedCategory: mapCategory(rawCategory, productName),
          })
        }

        return buildWeightResponse({ siteInfo, productName, category, weightKg: validWeightKg, dims: validDims, imageUrl: scan.imageUrl, price, currency, rawCategory })
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
        const rawCategory = jsonLdBreadcrumb(html)
        const offer = jsonLdOffer(html)
        const price = offer.price
        const currency = offer.currency
        if (scan.weightKg || scan.dims) {
          return buildWeightResponse({
            siteInfo,
            productName: scan.productName || 'Product',
            weightKg: scan.weightKg,
            dims: scan.dims,
            imageUrl: scan.imageUrl,
            price,
            currency,
            rawCategory,
          })
        }
        return NextResponse.json({
          found: false,
          reason: 'Weight not listed for this product. Please enter details manually.',
          product_name: scan.productName || undefined,
          image_url: scan.imageUrl,
          price,
          currency,
          rawCategory,
          mappedCategory: mapCategory(rawCategory, scan.productName),
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
