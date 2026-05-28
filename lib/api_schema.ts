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
} as const
