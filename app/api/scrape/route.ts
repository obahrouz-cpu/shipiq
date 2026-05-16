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

    return NextResponse.json({ found: false, reason: 'Auto-calculate for this site is coming soon. Please enter details manually.' })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ found: false, reason: message }, { status: 500 })
  }
}
