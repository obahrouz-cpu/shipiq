import type { StatusConfigEntry, ShippingRate, Store } from './types'

// ── Supported sites + country metadata (single source of truth) ───────────────

export const SITE_INFO: Record<string, { country: string; flag: string }> = {
  'amazon.com':       { country: 'USA',    flag: '🇺🇸' },
  'amazon.co.uk':     { country: 'UK',     flag: '🇬🇧' },
  'amazon.de':        { country: 'Germany',flag: '🇩🇪' },
  'amazon.ae':        { country: 'UAE',    flag: '🇦🇪' },
  'amazon.ca':        { country: 'Canada', flag: '🇨🇦' },
  'bhphotovideo.com': { country: 'USA',    flag: '🇺🇸' },
  'newegg.com':       { country: 'USA',    flag: '🇺🇸' },
  'bestbuy.com':      { country: 'USA',    flag: '🇺🇸' },
  'ebay.com':         { country: 'USA',    flag: '🇺🇸' },
  'trendyol.com':     { country: 'Turkey', flag: '🇹🇷' },
  'hepsiburada.com':  { country: 'Turkey', flag: '🇹🇷' },
  'n11.com':          { country: 'Turkey', flag: '🇹🇷' },
  'noon.com':          { country: 'UAE',    flag: '🇦🇪' },
  'boutiqaat.com':     { country: 'UAE',    flag: '🇦🇪' },
  'aliexpress.com':   { country: 'China',  flag: '🇨🇳' },
  'taobao.com':       { country: 'China',  flag: '🇨🇳' },
  '1688.com':         { country: 'China',  flag: '🇨🇳' },
  'jd.com':           { country: 'China',  flag: '🇨🇳' },
}

export const SUPPORTED_SITES: string[] = Object.keys(SITE_INFO)

// ── Shipping rates (IQD per kg) ───────────────────────────────────────────────

export const SHIPPING_RATES: Record<string, ShippingRate> = {
  USA:     { min: 12000, max: 19000 },
  UK:      { min: 11000, max: 17000 },
  Germany: { min: 11000, max: 17000 },
  Canada:  { min: 10000, max: 16000 },
  UAE:              { min:  6000, max: 10000 },
  UAE_Cosmetics:    { min: 10513, max: 10513 },
  UAE_Supplements:  { min: 50750, max: 50750 },
  UAE_Clothing:     { min:  5075, max:  5075 },
  UAE_Accessories:  { min:  5075, max:  5075 },
  Turkey:           { min:  5000, max:  8000 },
  China:            { min:  8000, max: 14000 },
}

// ── Order status display config ───────────────────────────────────────────────

export const STATUS_CONFIG: Record<string, StatusConfigEntry> = {
  pending:    { label: 'Pending',        labelAr: 'قيد الانتظار',  cls: 'pending',    icon: '⏳' },
  calculated: { label: 'Calculated',     labelAr: 'تم الحساب',     cls: 'calculated', icon: '💰' },
  confirmed:  { label: 'Confirmed',      labelAr: 'مؤكد',          cls: 'confirmed',  icon: '✅' },
  ordered:    { label: 'Ordered',        labelAr: 'تم الطلب',      cls: 'ordered',    icon: '🛒' },
  warehouse:  { label: 'At Warehouse',   labelAr: 'في المستودع',   cls: 'warehouse',  icon: '🏭' },
  transit:    { label: 'In Transit',     labelAr: 'في الطريق',     cls: 'transit',    icon: '✈️' },
  arrived:          { label: 'Arrived in City',   labelAr: 'وصل للمدينة',   cls: 'arrived',          icon: '🏙️' },
  out_for_delivery: { label: 'Out for Delivery',  labelAr: 'خرج للتوصيل',   cls: 'out_for_delivery', icon: '🛵' },
  delivered:        { label: 'Delivered',         labelAr: 'تم التوصيل',    cls: 'delivered',        icon: '📬' },
  rejected:         { label: 'Rejected',          labelAr: 'مرفوض',         cls: 'rejected',         icon: '❌' },
}

// ── Order form categories ─────────────────────────────────────────────────────

export const CATEGORIES = [
  'Electronics', 'Clothing', 'Cosmetics', 'Books',
  'Home & Kitchen', 'Toys', 'Sports', 'Other',
] as const

// ── Shop section filters ──────────────────────────────────────────────────────

export const COUNTRY_FILTERS = [
  { id: 'All',    label: 'All' },
  { id: 'US',     label: '🇺🇸 US' },
  { id: 'UAE',    label: '🇦🇪 UAE' },
  { id: 'Turkey', label: '🇹🇷 Turkey' },
  { id: 'China',  label: '🇨🇳 China' },
]

export const CATEGORY_FILTERS = [
  'All', 'Electronics', 'Clothing', 'Cosmetics', 'Home',
  'Gaming', 'Shoes', 'Sports', 'Watches', 'Beauty',
]

// ── Store catalogue ───────────────────────────────────────────────────────────

export const STORES: Store[] = [
  // ── United States ──────────────────────────────────────────────────────────
  { name: 'Amazon',    emoji: '🛒', country: 'US', flag: '🇺🇸', category: 'Electronics', domain: 'amazon.com',       color: '#FF9900', bg: 'rgba(255,153,0,0.1)' },
  { name: 'eBay',      emoji: '🏷️', country: 'US', flag: '🇺🇸', category: 'Electronics', domain: 'ebay.com',         color: '#E53238', bg: 'rgba(229,50,56,0.1)' },
  { name: 'B&H Photo', emoji: '📷', country: 'US', flag: '🇺🇸', category: 'Electronics', domain: 'bhphotovideo.com', color: '#5b9bd5', bg: 'rgba(91,155,213,0.1)' },
  { name: 'Best Buy',  emoji: '🖥️', country: 'US', flag: '🇺🇸', category: 'Electronics', domain: 'bestbuy.com',      color: '#0046BE', bg: 'rgba(0,70,190,0.1)' },
  { name: 'Newegg',    emoji: '💻', country: 'US', flag: '🇺🇸', category: 'Electronics', domain: 'newegg.com',       color: '#FF6600', bg: 'rgba(255,102,0,0.1)' },
  { name: 'Walmart',   emoji: '🏪', country: 'US', flag: '🇺🇸', category: 'Home',        domain: 'walmart.com',      color: '#0071CE', bg: 'rgba(0,113,206,0.1)' },
  { name: 'Target',    emoji: '🎯', country: 'US', flag: '🇺🇸', category: 'Home',        domain: 'target.com',       color: '#CC0000', bg: 'rgba(204,0,0,0.1)' },
  { name: "Macy's",    emoji: '🛍️', country: 'US', flag: '🇺🇸', category: 'Clothing',    domain: 'macys.com',        color: '#E21A1A', bg: 'rgba(226,26,26,0.1)' },
  { name: 'Nike',      emoji: '👟', country: 'US', flag: '🇺🇸', category: 'Shoes',       domain: 'nike.com',         color: '#c8c8c8', bg: 'rgba(255,255,255,0.05)' },
  { name: 'Adidas',    emoji: '👟', country: 'US', flag: '🇺🇸', category: 'Shoes',       domain: 'adidas.com',       color: '#a0a0a0', bg: 'rgba(255,255,255,0.04)' },
  { name: 'Sephora',   emoji: '💄', country: 'US', flag: '🇺🇸', category: 'Beauty',      domain: 'sephora.com',      color: '#E2003A', bg: 'rgba(226,0,58,0.1)' },
  { name: 'iHerb',     emoji: '🌿', country: 'US', flag: '🇺🇸', category: 'Beauty',      domain: 'iherb.com',        color: '#5ea814', bg: 'rgba(94,168,20,0.1)' },
  // ── UAE ───────────────────────────────────────────────────────────────────
  { name: 'Amazon UAE',      emoji: '🛒', country: 'UAE', flag: '🇦🇪', category: 'Electronics', domain: 'amazon.ae',       color: '#FF9900', bg: 'rgba(255,153,0,0.1)' },
  { name: 'Noon',            emoji: '🌙', country: 'UAE', flag: '🇦🇪', category: 'Electronics', domain: 'noon.com',        color: '#f5c518', bg: 'rgba(245,197,24,0.1)' },
  { name: 'Namshi',          emoji: '👗', country: 'UAE', flag: '🇦🇪', category: 'Clothing',    domain: 'namshi.com',      color: '#9c6fe4', bg: 'rgba(156,111,228,0.1)' },
  { name: 'Sharaf DG',       emoji: '📱', country: 'UAE', flag: '🇦🇪', category: 'Electronics', domain: 'sharafdg.com',    color: '#e31e25', bg: 'rgba(227,30,37,0.1)' },
  { name: 'Brands for Less', emoji: '🏷️', country: 'UAE', flag: '🇦🇪', category: 'Clothing',    domain: 'brandsforless.ae',color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  { name: 'Boutiqaat',      emoji: '💄', country: 'UAE', flag: '🇦🇪', category: 'Beauty',      domain: 'boutiqaat.com',   color: '#c2185b', bg: 'rgba(194,24,91,0.1)'  },
  // ── Turkey ────────────────────────────────────────────────────────────────
  { name: 'Trendyol',    emoji: '🛍️', country: 'Turkey', flag: '🇹🇷', category: 'Clothing',    domain: 'trendyol.com',   color: '#F27A1A', bg: 'rgba(242,122,26,0.1)' },
  { name: 'Hepsiburada', emoji: '🛒', country: 'Turkey', flag: '🇹🇷', category: 'Electronics', domain: 'hepsiburada.com',color: '#FF6000', bg: 'rgba(255,96,0,0.1)' },
  { name: 'N11',         emoji: '🏪', country: 'Turkey', flag: '🇹🇷', category: 'Electronics', domain: 'n11.com',        color: '#7b2d8b', bg: 'rgba(123,45,139,0.1)' },
  { name: 'LC Waikiki',  emoji: '👕', country: 'Turkey', flag: '🇹🇷', category: 'Clothing',    domain: 'lcwaikiki.com',  color: '#cc0000', bg: 'rgba(204,0,0,0.1)' },
  { name: 'Mavi',        emoji: '👖', country: 'Turkey', flag: '🇹🇷', category: 'Clothing',    domain: 'mavi.com',       color: '#1a56db', bg: 'rgba(26,86,219,0.1)' },
  // ── China ─────────────────────────────────────────────────────────────────
  { name: 'AliExpress', emoji: '📦', country: 'China', flag: '🇨🇳', category: 'Electronics', domain: 'aliexpress.com', color: '#FF4747', bg: 'rgba(255,71,71,0.1)' },
  { name: 'Shein',      emoji: '👗', country: 'China', flag: '🇨🇳', category: 'Clothing',    domain: 'shein.com',      color: '#C8473C', bg: 'rgba(200,71,60,0.1)' },
  { name: 'Banggood',   emoji: '🔧', country: 'China', flag: '🇨🇳', category: 'Electronics', domain: 'banggood.com',   color: '#e8491d', bg: 'rgba(232,73,29,0.1)' },
  { name: 'DHgate',     emoji: '🏭', country: 'China', flag: '🇨🇳', category: 'Electronics', domain: 'dhgate.com',     color: '#1a91c6', bg: 'rgba(26,145,198,0.1)' },
  { name: 'Zaful',      emoji: '👙', country: 'China', flag: '🇨🇳', category: 'Clothing',    domain: 'zaful.com',      color: '#f63472', bg: 'rgba(246,52,114,0.1)' },
]
