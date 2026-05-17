// ── Domain types ─────────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'calculated' | 'confirmed' | 'ordered' | 'warehouse' | 'transit' | 'arrived' | 'delivered' | 'rejected'

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
  role: 'admin' | 'customer'
  language?: 'en' | 'ar'
  tier?: string
  total_spent?: number
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
  weight?: string
  reject_reason?: string
  created_at: string
  profiles?: Pick<Profile, 'full_name' | 'email'>
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
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
