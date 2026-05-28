// ── ShipIQ API Schema ─────────────────────────────────────────────────────────
// This file documents all Next.js API endpoints for Flutter app development.
// Flutter services should mirror these endpoints in lib/services/.
// Auth: pass the Supabase access_token as a field in the JSON body where required.

export interface ApiEndpoint {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  auth: 'none' | 'bearer' | 'service_role'
  description: string
  body?: Record<string, string>
  response: Record<string, string>
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  // ── Orders ────────────────────────────────────────────────────────────────
  {
    path: '/api/orders/confirm',
    method: 'POST',
    auth: 'bearer',
    description: 'Customer confirms a calculated order (status: calculated → confirmed)',
    body: { order_id: 'string', access_token: 'string (Supabase JWT)' },
    response: { success: 'boolean', error: 'string?' },
  },

  // ── Agent ─────────────────────────────────────────────────────────────────
  {
    path: '/api/agent/orders',
    method: 'POST',
    auth: 'bearer',
    description: "Fetch orders assigned to agent's country (confirmed → delivered)",
    body: { access_token: 'string (Supabase JWT)' },
    response: { orders: 'Order[]', country: 'string', error: 'string?' },
  },

  // ── Scrape ────────────────────────────────────────────────────────────────
  {
    path: '/api/scrape',
    method: 'POST',
    auth: 'none',
    description: 'Scrape product weight/dimensions from a supported e-commerce URL',
    body: { url: 'string' },
    response: {
      found: 'boolean',
      site: 'ScrapeResultSite?',
      product_name: 'string?',
      category: 'string?',
      actual_weight_kg: 'number?',
      length_cm: 'number?',
      width_cm: 'number?',
      height_cm: 'number?',
      dimensional_weight_kg: 'number?',
      billable_weight_kg: 'number?',
      image_url: 'string?',
      price: 'number? (null when unavailable — never fabricated)',
      currency: 'string? (e.g. USD, TRY, AED — needed by rate engine)',
      rawCategory: 'string? (untouched breadcrumb/taxonomy, for debugging)',
      mappedCategory: "string? (cosmetics|supplements|clothing|electronics|accessories|uncategorized)",
      weightUnit: "string? ('kg' — all weights normalized to kg)",
      reason: 'string? (when found=false)',
    },
  },

  // ── Pricing Engine ────────────────────────────────────────────────────────
  {
    path: '/api/calculate',
    method: 'POST',
    auth: 'none',
    description:
      'Compute the full price breakdown for an order from the admin-configured rates ' +
      '(public.pricing_config). Rules live in lib/pricing.ts (shared with the website ' +
      'calculator) so web + app never diverge. All amounts are in `currency` (USD).',
    body: {
      country: "string ('USA' | 'UAE' | 'Turkey' | 'China')",
      billableWeightKg: 'number (from /api/scrape billable_weight_kg, per item, in kg)',
      qty: 'number (default 1)',
      category: 'string (cosmetics|supplements|clothing|electronics|accessories|uncategorized)',
      itemPrice: 'number? (in `currency`; null/omit when unknown — Noon / skipped price)',
      insuranceOptIn: 'boolean (customer opt-in checkbox)',
    },
    response: {
      ok: 'boolean',
      country: 'string',
      currency: "string (e.g. 'USD')",
      weightUnit: "string ('lb' | 'kg' — the country's billing unit)",
      category: 'string',
      qty: 'number',
      itemPrice: 'number? (echoed; null when not provided)',
      billableWeight: 'number (total, converted to weightUnit, × qty)',
      shipping: 'number? (null when ratesUnavailable — rate not set yet / TBD)',
      shippingRate: 'number (per-unit rate used; 0 when unavailable)',
      ratesUnavailable: 'boolean (true → country/category has no shipping rate set; show "contact us")',
      serviceFee: 'number? (null when percentage mode + no item price yet)',
      serviceFeeMode: "string ('percentage' | 'per_piece')",
      serviceFeePending: 'boolean (true → show serviceFeeMessage, not a number)',
      serviceFeeMessage: 'string? ("Service fee is X% of item price — enter item price…")',
      customs: 'number (always present — needs no price)',
      insuranceOptIn: 'boolean',
      insurance: 'number? (null when opted-in + no price; 0 when not opted in)',
      insurancePending: 'boolean',
      insuranceMessage: 'string? ("Insurance is X% of item price — enter item price…")',
      total: 'number (sum of the calculable parts; excludes shipping when unavailable)',
      partialTotal: 'boolean (true when a part can\'t be computed yet — blank price or unset rate)',
      pending: "string[] (subset of 'shipping' | 'item_price' | 'service_fee' | 'insurance')",
      totalMessage: 'string? (hint, e.g. "+ service fee & insurance once price entered")',
    },
  },

  // ── Product Image ─────────────────────────────────────────────────────────
  {
    path: '/api/product-image',
    method: 'POST',
    auth: 'none',
    description: 'Fetch product thumbnail image URL from a product page URL',
    body: { url: 'string' },
    response: { image_url: 'string | null' },
  },

  // ── Exchange Rate ─────────────────────────────────────────────────────────
  {
    path: '/api/exchange-rate',
    method: 'GET',
    auth: 'none',
    description: 'Get current USD/IQD exchange rate (cached 1 hour)',
    response: { rate: 'number', source: 'string', updated: 'string (ISO 8601)' },
  },

  // ── WhatsApp Notifications ────────────────────────────────────────────────
  {
    path: '/api/whatsapp/notify',
    method: 'POST',
    auth: 'service_role',
    description: 'Send WhatsApp notification for an order event (internal use)',
    body: {
      orderId: 'string?',
      userId: 'string?',
      event: 'WhatsappEvent',
      amount: 'number?',
      balance: 'number?',
      reason: 'string?',
      city: 'string?',
    },
    response: { success: 'boolean', skipped: 'boolean?', sent: 'boolean?' },
  },

  // ── Accounting Sync ───────────────────────────────────────────────────────
  {
    path: '/api/accounting/sync',
    method: 'POST',
    auth: 'service_role',
    description: 'Sync a charged order to Wave or Zoho (internal use)',
    body: {
      order_id: 'string',
      customer_name: 'string',
      customer_email: 'string',
      description: 'string',
      shipping_iqd: 'number',
      service_fee_iqd: 'number',
      customs_fee_iqd: 'number',
      delivery_fee_iqd: 'number',
      total_iqd: 'number',
    },
    response: { ok: 'boolean', invoiceId: 'string?', provider: 'string?', error: 'string?' },
  },

  // ── Payments ─────────────────────────────────────────────────────────────
  {
    path: '/api/payments/fib',
    method: 'POST',
    auth: 'bearer',
    description: 'FIB (First Iraqi Bank) payment — not yet implemented',
    response: { error: 'string' },
  },
  {
    path: '/api/payments/qicard',
    method: 'POST',
    auth: 'bearer',
    description: 'Qi Card payment — not yet implemented',
    response: { error: 'string' },
  },
]

// ── Supabase table names (for Flutter Dart SDK direct access) ─────────────────
export const SUPABASE_TABLES = {
  profiles: 'profiles',
  orders: 'orders',
  transactions: 'transactions',
  notifications: 'notifications',
  order_notes: 'order_notes',
  wishlist: 'wishlist',
  delivery_requests: 'delivery_requests',
  tier_settings: 'tier_settings',
  app_settings: 'app_settings',
  pricing_config: 'pricing_config',   // one row per origin country — read directly for offline quoting
} as const
