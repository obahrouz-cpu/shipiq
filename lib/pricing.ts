// ── ShipIQ Pricing Engine ─────────────────────────────────────────────────────
// Single source of truth for quote math. The RULES live here; the RATES live in
// Supabase (public.pricing_config) and are read by BOTH the web app and the
// Flutter app. Never hardcode rates in either codebase — only edit them in the
// admin Pricing tab, which writes to Supabase.
//
// Keyed by origin country (USA, UAE, Turkey, China).
//   shipping  = billable weight (in the country's unit) × rate (flat or per-category)
//   service   = max(itemPrice × %, minimum)  OR  per-piece flat × qty
//   customs   = flat per country  OR  per-category amount
//   insurance = itemPrice × %  (opt-in)
// service fee and insurance both compute off ITEM PRICE ONLY (never a subtotal).
// All amounts (rates, fees, itemPrice in, breakdown out) are in `currency`.

export type OriginCountry = 'USA' | 'UAE' | 'Turkey' | 'China'
export type WeightUnit = 'lb' | 'kg'
export type ServiceFeeMode = 'percentage' | 'per_piece'
export type PricingCategory =
  | 'cosmetics' | 'supplements' | 'clothing' | 'electronics' | 'accessories' | 'uncategorized'

export const ORIGIN_COUNTRIES: OriginCountry[] = ['USA', 'UAE', 'Turkey', 'China']
export const PRICING_CATEGORIES: PricingCategory[] = [
  'cosmetics', 'supplements', 'clothing', 'electronics', 'accessories', 'uncategorized',
]

const KG_TO_LB = 2.20462

// ── Config (one per origin country, mirrors a pricing_config row) ──────────────

export type CategoryAmounts = Record<PricingCategory, number>

export interface CountryPricingConfig {
  country: OriginCountry
  currency: string            // currency all amounts are expressed in (default 'USD')
  weight_unit: WeightUnit     // billing unit; billable kg is converted to this before ×rate

  // Shipping — flat per-unit rate, or a per-category rate when the toggle is on
  shipping_per_category: boolean
  shipping_flat_rate: number              // per weight-unit, used when per_category = false
  shipping_category_rates: CategoryAmounts // per weight-unit, used when per_category = true

  // Service fee — admin picks ONE mode
  service_fee_mode: ServiceFeeMode
  service_fee_percent: number   // percentage mode: e.g. 5 = 5% of item price
  service_fee_min: number       // percentage mode: internal floor, applied only after a price exists
  service_fee_per_piece: number // per_piece mode: flat amount × qty

  // Customs — flat per country, or per-category amounts when the toggle is on
  customs_per_category: boolean
  customs_flat: number                      // used when per_category = false
  customs_category_amounts: CategoryAmounts // used when per_category = true

  // Insurance — admin-set %, customer opts in at order time. % of item price only.
  insurance_percent: number
}

// ── Calculation input / output ────────────────────────────────────────────────

export interface PricingInput {
  billableWeightKg: number   // from the scrape contract, normalized to kg (per item)
  qty: number
  category: PricingCategory
  itemPrice: number | null   // in config currency; null/blank when unknown (Noon / skipped price)
  insuranceOptIn: boolean
}

export type PendingComponent = 'item_price' | 'service_fee' | 'insurance' | 'shipping'

export interface PricingBreakdown {
  ok: boolean
  country: OriginCountry
  currency: string
  weightUnit: WeightUnit
  category: PricingCategory
  qty: number

  itemPrice: number | null
  billableWeight: number      // total, converted to weightUnit (kg→unit × qty)

  shipping: number | null     // null when ratesUnavailable (rate not set yet — TBD)
  shippingRate: number        // the per-unit rate actually used (0 when unavailable)
  ratesUnavailable: boolean   // true when this country/category has no shipping rate set

  serviceFee: number | null   // null when percentage mode + no item price yet
  serviceFeeMode: ServiceFeeMode
  serviceFeePending: boolean
  serviceFeeMessage: string | null

  customs: number             // always computable (no price needed)

  insuranceOptIn: boolean
  insurance: number | null    // null when opted-in + no item price; 0 when not opted in
  insurancePending: boolean
  insuranceMessage: string | null

  total: number               // sum of the calculable parts
  partialTotal: boolean        // true when some part can't be computed yet (blank price)
  pending: PendingComponent[] // which parts are still unknown
  totalMessage: string | null // human hint, e.g. "+ service fee & insurance once price entered"
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg * KG_TO_LB : kg
}

const EMPTY_CATEGORY_AMOUNTS = (): CategoryAmounts => ({
  cosmetics: 0, supplements: 0, clothing: 0, electronics: 0, accessories: 0, uncategorized: 0,
})

// Coerces an arbitrary jsonb/value into a full CategoryAmounts map (missing → 0).
function toCategoryAmounts(raw: unknown): CategoryAmounts {
  const out = EMPTY_CATEGORY_AMOUNTS()
  if (raw && typeof raw === 'object') {
    for (const cat of PRICING_CATEGORIES) {
      const v = Number((raw as Record<string, unknown>)[cat])
      if (!isNaN(v)) out[cat] = v
    }
  }
  return out
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v)
  return isNaN(n) ? fallback : n
}

// A safe, all-zero default so the UI/engine never crash when a country has no row.
export function defaultConfig(country: OriginCountry): CountryPricingConfig {
  return {
    country,
    currency: 'USD',
    weight_unit: country === 'USA' ? 'lb' : 'kg',
    shipping_per_category: false,
    shipping_flat_rate: 0,
    shipping_category_rates: EMPTY_CATEGORY_AMOUNTS(),
    service_fee_mode: 'percentage',
    service_fee_percent: 0,
    service_fee_min: 0,
    service_fee_per_piece: 0,
    customs_per_category: false,
    customs_flat: 0,
    customs_category_amounts: EMPTY_CATEGORY_AMOUNTS(),
    insurance_percent: 0,
  }
}

// Normalizes a raw Supabase row (loose types, partial jsonb) into a typed config.
export function normalizeConfig(row: Record<string, unknown>): CountryPricingConfig {
  const country = String(row.country ?? 'USA') as OriginCountry
  const base = defaultConfig(country)
  return {
    country,
    currency: String(row.currency ?? base.currency) || 'USD',
    weight_unit: row.weight_unit === 'lb' || row.weight_unit === 'kg' ? row.weight_unit : base.weight_unit,
    shipping_per_category: row.shipping_per_category === true || row.shipping_per_category === 'true',
    shipping_flat_rate: num(row.shipping_flat_rate),
    shipping_category_rates: toCategoryAmounts(row.shipping_category_rates),
    service_fee_mode: row.service_fee_mode === 'per_piece' ? 'per_piece' : 'percentage',
    service_fee_percent: num(row.service_fee_percent),
    service_fee_min: num(row.service_fee_min),
    service_fee_per_piece: num(row.service_fee_per_piece),
    customs_per_category: row.customs_per_category === true || row.customs_per_category === 'true',
    customs_flat: num(row.customs_flat),
    customs_category_amounts: toCategoryAmounts(row.customs_category_amounts),
    insurance_percent: num(row.insurance_percent),
  }
}

// ── The engine ─────────────────────────────────────────────────────────────

export function calculatePricing(config: CountryPricingConfig, input: PricingInput): PricingBreakdown {
  const qty = Math.max(1, Math.floor(input.qty || 1))
  const category: PricingCategory = PRICING_CATEGORIES.includes(input.category) ? input.category : 'uncategorized'
  const hasPrice = input.itemPrice != null && !isNaN(input.itemPrice)
  const price = hasPrice ? Math.max(0, input.itemPrice as number) : 0

  // ── Shipping (needs no price; unavailable when the rate is unset/TBD = 0) ──
  const totalBillableKg = Math.max(0, num(input.billableWeightKg)) * qty
  const billableWeight = round2(kgToUnit(totalBillableKg, config.weight_unit))
  const shippingRate = config.shipping_per_category
    ? num(config.shipping_category_rates[category], config.shipping_category_rates.uncategorized)
    : config.shipping_flat_rate
  // A rate of 0 (or less) means "not set yet" — surface ratesUnavailable instead
  // of a misleading $0 shipping line.
  const ratesUnavailable = !(shippingRate > 0)
  const shipping: number | null = ratesUnavailable ? null : round2(billableWeight * shippingRate)

  // ── Customs (always computable; needs no price) ──
  const customs = round2(
    config.customs_per_category
      ? num(config.customs_category_amounts[category], config.customs_category_amounts.uncategorized)
      : config.customs_flat
  )

  // ── Service fee ──
  let serviceFee: number | null = null
  let serviceFeePending = false
  let serviceFeeMessage: string | null = null
  if (config.service_fee_mode === 'per_piece') {
    // Per-piece is a flat amount × qty — shown normally even with a blank price.
    serviceFee = round2(config.service_fee_per_piece * qty)
  } else if (hasPrice) {
    // Percentage: max(price × %, minimum). The minimum is an internal floor
    // applied only AFTER a price exists.
    serviceFee = round2(Math.max((price * config.service_fee_percent) / 100, config.service_fee_min))
  } else {
    // Percentage + blank price: do NOT surface the minimum as a number.
    serviceFeePending = true
    serviceFeeMessage = `Service fee is ${config.service_fee_percent}% of item price — enter item price for the exact amount.`
  }

  // ── Insurance (opt-in, % of item price only) ──
  let insurance: number | null = 0
  let insurancePending = false
  let insuranceMessage: string | null = null
  if (input.insuranceOptIn) {
    if (hasPrice) {
      insurance = round2((price * config.insurance_percent) / 100)
    } else {
      insurance = null
      insurancePending = true
      insuranceMessage = `Insurance is ${config.insurance_percent}% of item price — enter item price for the exact amount.`
    }
  }

  // ── Total ──
  const pending: PendingComponent[] = []
  if (ratesUnavailable) pending.push('shipping')
  if (!hasPrice) pending.push('item_price')
  if (serviceFeePending) pending.push('service_fee')
  if (insurancePending) pending.push('insurance')

  let total = customs
  if (shipping != null) total += shipping
  if (hasPrice) total += price
  if (serviceFee != null) total += serviceFee
  if (insurance != null) total += insurance
  total = round2(total)

  const partialTotal = pending.length > 0
  const totalMessage = partialTotal ? buildPartialMessage(pending) : null

  return {
    ok: true,
    country: config.country,
    currency: config.currency,
    weightUnit: config.weight_unit,
    category,
    qty,
    itemPrice: hasPrice ? round2(price) : null,
    billableWeight,
    shipping,
    shippingRate,
    ratesUnavailable,
    serviceFee,
    serviceFeeMode: config.service_fee_mode,
    serviceFeePending,
    serviceFeeMessage,
    customs,
    insuranceOptIn: input.insuranceOptIn,
    insurance,
    insurancePending,
    insuranceMessage,
    total,
    partialTotal,
    pending,
    totalMessage,
  }
}

function buildPartialMessage(pending: PendingComponent[]): string {
  const segments: string[] = []
  // Shipping rate not set yet — nothing the customer can do; we quote manually.
  if (pending.includes('shipping')) {
    segments.push('shipping rates are not set yet — contact us for a quote')
  }
  // These fees can only be computed once the item price is entered.
  const dependent = pending
    .filter(p => p === 'service_fee' || p === 'insurance')
    .map(p => (p === 'service_fee' ? 'service fee' : 'insurance'))
  if (dependent.length > 0) {
    const joined = dependent.length === 1 ? dependent[0] : dependent.join(' & ')
    segments.push(`+ ${joined} once item price is entered`)
  }
  if (segments.length === 0) {
    // Only the item price itself is missing (e.g. per-piece service fee + no insurance).
    return 'Partial total — enter item price for the full amount.'
  }
  return `Partial total — ${segments.join('; ')}.`
}
