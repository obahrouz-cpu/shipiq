// FLUTTER: lib/services/pricing_service.dart → calculatePricing()
// Method: POST  Auth: none (rate-limited by IP)
// Body:   { country, billableWeightKg, qty, category, itemPrice, insuranceOptIn }
// Returns: PricingBreakdown — see lib/pricing.ts / lib/api_schema.ts
//
// The pricing RULES live in lib/pricing.ts (shared with the website calculator);
// the RATES live in Supabase (public.pricing_config), edited from the admin
// Pricing tab. This endpoint just loads the config + runs the engine, so the web
// app and the Flutter app can never diverge on pricing math.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import {
  calculatePricing,
  normalizeConfig,
  defaultConfig,
  ORIGIN_COUNTRIES,
  PRICING_CATEGORIES,
  type OriginCountry,
  type PricingCategory,
} from '@/lib/pricing'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { ok } = rateLimit(ip, 'calculate', 60, 60_000)
  if (!ok) return NextResponse.json({ ok: false, reason: 'Too many requests. Please wait a moment.' }, { status: 429 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid JSON body.' }, { status: 400 })
  }

  const country = String(body.country ?? '') as OriginCountry
  if (!ORIGIN_COUNTRIES.includes(country)) {
    return NextResponse.json(
      { ok: false, reason: `Unsupported country. Use one of: ${ORIGIN_COUNTRIES.join(', ')}.` },
      { status: 400 }
    )
  }

  const billableWeightKg = Number(body.billableWeightKg)
  if (isNaN(billableWeightKg) || billableWeightKg < 0) {
    return NextResponse.json({ ok: false, reason: 'billableWeightKg must be a non-negative number.' }, { status: 400 })
  }

  const rawCategory = String(body.category ?? 'uncategorized') as PricingCategory
  const category: PricingCategory = PRICING_CATEGORIES.includes(rawCategory) ? rawCategory : 'uncategorized'
  const qty = Number(body.qty)
  const itemPriceRaw = body.itemPrice
  const itemPrice =
    itemPriceRaw == null || itemPriceRaw === '' || isNaN(Number(itemPriceRaw)) ? null : Number(itemPriceRaw)
  const insuranceOptIn = body.insuranceOptIn === true || body.insuranceOptIn === 'true'

  // Load this country's config (public read). Fall back to all-zero defaults so a
  // missing/unseeded row never 500s — the breakdown just comes back as zeros.
  const supabase = createClient()
  const { data, error } = await supabase.from('pricing_config').select('*').eq('country', country).maybeSingle()
  const config = !error && data ? normalizeConfig(data as Record<string, unknown>) : defaultConfig(country)

  const breakdown = calculatePricing(config, {
    billableWeightKg,
    qty: isNaN(qty) ? 1 : qty,
    category,
    itemPrice,
    insuranceOptIn,
  })

  return NextResponse.json(breakdown)
}
