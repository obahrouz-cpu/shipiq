// ── Domain types ─────────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'calculated' | 'confirmed' | 'ordered' | 'warehouse' | 'transit' | 'arrived' | 'out_for_delivery' | 'delivered' | 'rejected'

export interface StatusConfigEntry {
  label: string
  labelAr: string
  cls: string
  icon: string
}

export interface ShippingRate {
  min: number
  max: number
}

// ── Database row types ────────────────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  balance: number
  balance_usd: number
  role: 'admin' | 'customer' | 'agent'
  language?: 'en' | 'ar' | 'sorani' | 'badini'
  tier?: string
  total_spent?: number
  assigned_country?: string
  delivery_lat?: number
  delivery_lng?: number
  delivery_address?: string
  delivery_city?: string
  delivery_notes?: string
  is_suspended?: boolean
  suspension_reason?: string
  last_seen_at?: string
  created_at: string
}

export interface TierSettings {
  tier: string
  name_en: string
  name_ar: string
  min_spend: number
  color: string
  icon: string
  benefits: string
  is_active: boolean
}

export interface Order {
  id: string
  user_id: string
  url: string
  description: string
  category: string
  qty: number
  item_price?: number
  item_price_currency: string
  note?: string
  urgency: boolean
  photo_url?: string
  status: OrderStatus
  shipping_price?: number
  shipping_currency?: string
  service_fee?: number
  customs_fee?: number
  delivery_fee?: number
  total_cost?: number
  delivery_preference?: string
  delivery_city?: string
  weight?: string
  reject_reason?: string
  country_origin?: string
  agent_receipt_url?: string
  agent_warehouse_photo_url?: string
  ordered_at?: string
  warehoused_at?: string
  total_charged?: number
  is_charged?: boolean
  charged_at?: string
  wave_invoice_id?: string
  wave_synced_at?: string
  wave_sync_status?: string
  created_at: string
  profiles?: Pick<Profile, 'full_name' | 'email'>
}

export interface WishlistItem {
  id: string
  user_id: string
  url: string
  description?: string
  photo_url?: string
  notes?: string
  created_at: string
}

export interface DeliveryRequest {
  id: string
  user_id: string
  order_ids: string[]
  delivery_preference: string
  delivery_city?: string
  delivery_address?: string
  delivery_lat?: number
  delivery_lng?: number
  delivery_notes?: string
  delivery_fee: number
  status: string
  created_at: string
  scheduled_at?: string
  completed_at?: string
  profiles?: Pick<Profile, 'full_name' | 'email' | 'phone'>
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  created_at: string
}

export interface OrderNote {
  id: string
  order_id: string
  user_id: string
  message: string
  is_admin: boolean
  is_read_by_customer: boolean
  is_read_by_admin: boolean
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  amount_usd?: number
  currency: string
  note: string
  order_id?: string
  created_at: string
}

// ── UI state types ────────────────────────────────────────────────────────────

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

export interface NavItem {
  id: string
  icon: string
  label: string
  badge?: number
}

export interface OrderForm {
  url: string
  description: string
  category: string
  qty: number
  itemPrice: string
  itemPriceCurrency: string
  note: string
  urgency: boolean
  deliveryPreference: string
  deliveryCity: string
}

export interface AuthForm {
  name: string
  email: string
  phone: string
  password: string
}

// ── Scrape API types ──────────────────────────────────────────────────────────

export interface ScrapeResultSite {
  site: string
  country: string
  flag: string
}

export type MappedCategory =
  | 'cosmetics' | 'supplements' | 'clothing' | 'electronics' | 'accessories' | 'uncategorized'

export interface ScrapeResult {
  found: boolean
  site?: ScrapeResultSite
  product_name?: string
  category?: string
  actual_weight_kg?: number | null
  length_cm?: number | null
  width_cm?: number | null
  height_cm?: number | null
  dimensional_weight_kg?: number | null
  billable_weight_kg?: number | null
  raw_weight?: string | null
  raw_dimensions?: string | null
  // ── scrape contract (price + normalized category + weight unit) ──
  price?: number | null
  currency?: string | null
  rawCategory?: string | null
  mappedCategory?: MappedCategory | null
  weightUnit?: 'kg' | null
  reason?: string
  error?: string
}

// ── Store types ───────────────────────────────────────────────────────────────

export interface Store {
  name: string
  emoji: string
  country: 'US' | 'UAE' | 'Turkey' | 'China'
  flag: string
  category: string
  domain: string
  color: string
  bg: string
}

export interface RecentStore {
  name: string
  emoji: string
  flag: string
  country: string
  category: string
  domain: string
  color: string
  bg: string
}
