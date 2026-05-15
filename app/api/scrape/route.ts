import { NextRequest, NextResponse } from 'next/server'

const OPENWEBNINJA_KEY = 'ak_ih50qdl5j9zcal1fcrt9373dkzzbu7ahvizay953wvnxin7'

const SITE_INFO: Record<string, { country: string; flag: string }> = {
  'amazon.com':       { country: 'USA',     flag: '🇺🇸' },
  'amazon.co.uk':     { country: 'UK',      flag: '🇬🇧' },
  'amazon.de':        { country: 'Germany', flag: '🇩🇪' },
  'amazon.ae':        { country: 'UAE',     flag: '🇦🇪' },
  'amazon.ca':        { country: 'Canada',  flag: '🇨🇦' },
  'bhphotovideo.com': { country: 'USA',     flag: '🇺🇸' },
  'newegg.com':       { country: 'USA',     flag: '🇺🇸' },
  'bestbuy.com':      { country: 'USA',     flag: '🇺🇸' },
  'ebay.com':         { country: 'USA',     flag: '🇺🇸' },
  'trendyol.com':     { country: 'Turkey',  flag: '🇹🇷' },
  'hepsiburada.com':  { country: 'Turkey',  flag: '🇹🇷' },
  'n11.com':          { country: 'Turkey',  flag: '🇹🇷' },
  'aliexpress.com':   { country: 'China',   flag: '🇨🇳' },
  'taobao.com':       { country: 'China',   flag: '🇨🇳' },
  '1688.com':         { country: 'China',   flag: '🇨🇳' },
  'jd.com':           { country: 'China',   flag: '🇨🇳' },
}

function detectSite(url: string) {
  for (const [site, info] of Object.entries(SITE_INFO)) {
    if (url.toLowerCase().includes(site)) return { site, ...info }
  }
  return null
}

function extractAsin(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|asin=([A-Z0-9]{10})/)
  return match ? (match[1] || match[2] || match[3]) : null
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
  // Convert inches to cm if needed
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

    // Amazon — use OpenWeb Ninja API
    if (siteInfo.site.includes('amazon')) {
      const asin = extractAsin(url)
      if (!asin) return NextResponse.json({ found: false, reason: 'Could not extract ASIN from URL' })

      // Detect Amazon country
      let country = 'US'
      if (url.includes('amazon.co.uk')) country = 'GB'
      else if (url.includes('amazon.de')) country = 'DE'
      else if (url.includes('amazon.ae')) country = 'AE'
      else if (url.includes('amazon.ca')) country = 'CA'

const apiUrl = `https://api.openwebninja.com/realtime-amazon-data/product-details?asin=${asin}&country=${country}`
const response = await fetch(apiUrl, {
  headers: {
    'x-api-key': OPENWEBNINJA_KEY,
  }
})
      if (!response.ok) {
        return NextResponse.json({ found: false, reason: 'Could not fetch product data from Amazon' })
      }

      const data = await response.json()
      const info = data?.data?.product_information || {}
      const details = data?.data?.product_details || {}

      const rawWeight = info['Item Weight'] || info['Weight'] || details['Item Weight'] || details['Weight'] || null
      const rawDimensions = info['Product Dimensions'] || info['Package Dimensions'] || details['Product Dimensions'] || null
      const productName = data?.data?.product_title || 'Unknown Product'

      if (!rawWeight && !rawDimensions) {
        return NextResponse.json({ found: false, reason: 'Weight and dimensions not listed for this product. Enter manually.' })
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

    // Other sites — manual for now
    return NextResponse.json({ found: false, reason: 'Auto calculate for this site coming soon. Enter manually.' })

  } catch (e: any) {
    return NextResponse.json({ found: false, reason: e.message }, { status: 500 })
  }
}