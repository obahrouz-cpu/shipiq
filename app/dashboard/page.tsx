'use client'
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import ThemeToggle from '@/components/ThemeToggle'
import {
  getSession, getProfile, getAdminOrders, getUserOrders,
  getCustomers, getUserTransactions, createOrder,
  updateOrder, topUpBalance, deductBalance, signOut,
  getTierSettings, getWishlist, addToWishlist, removeFromWishlist,
  getUserDeliveryRequests, getAdminDeliveryRequests,
  getOrderUnreadCounts, getAppSettings,
} from '@/lib/api'
import { createClient } from '@/lib/supabase'
import { CATEGORIES, STATUS_CONFIG, SUPPORTED_SITES, SHIPPING_RATES } from '@/lib/constants'
import type { Profile, Order, Transaction, Toast, NavItem, OrderForm, ScrapeResult, WishlistItem, DeliveryRequest, OrderNote } from '@/lib/types'
import { useLanguage } from '@/lib/useLanguage'
import { useIqdRate } from '@/lib/hooks/useIqdRate'
import { displayPhone } from '@/lib/phone'
import styles from './dashboard.module.css'
import ShopSection from './components/ShopSection'
import OrderFilters, { OrderFiltersState, DEFAULT_FILTERS } from './components/OrderFilters'
import AccountSettings from './components/AccountSettings'
import AdminExport from './components/AdminExport'
import TrendyolWeightEstimator from './components/TrendyolWeightEstimator'
import ExchangeRateTicker from './components/ExchangeRateTicker'
import WalletTopUp from './components/WalletTopUp'
import BoutiqaatWeightEstimator from './components/BoutiqaatWeightEstimator'
import TierBadge from './components/TierBadge'
import AdminTierSettings from './components/AdminTierSettings'
const AdminAnalytics = dynamic(() => import('./components/AdminAnalytics'), { ssr: false })
const AdminCustomerProfile = dynamic(() => import('./components/AdminCustomerProfile'), { ssr: false })
import AgentDashboard from './components/AgentDashboard'
import AdminMobileAccount from './components/AdminMobileAccount'
import ShippingCalculator from './components/ShippingCalculator'
import AdminSettings from './components/AdminSettings'
import AdminBroadcast from './components/AdminBroadcast'
import WishlistPage from './components/WishlistPage'
import DeliveryRequestModal from './components/DeliveryRequestModal'
import AdminDeliveries from './components/AdminDeliveries'
import NotificationCenter from './components/NotificationCenter'
import OrderNotes from './components/OrderNotes'
import type { TierSettings } from '@/lib/types'
import { appendAffiliateTag } from '@/lib/affiliateLinks'

// ── Fallback tier data — used when tier_settings table hasn't been seeded yet ──
const FALLBACK_TIERS: TierSettings[] = [
  { tier: 'bronze',   name_en: 'Bronze',   name_ar: 'برونزي',  min_spend: 0,    color: '#CD7F32', icon: '🥉', benefits: 'Welcome to ShipIQ!', is_active: true },
  { tier: 'silver',   name_en: 'Silver',   name_ar: 'فضي',     min_spend: 100,  color: '#C0C0C0', icon: '🥈', benefits: 'Coming soon',         is_active: true },
  { tier: 'gold',     name_en: 'Gold',     name_ar: 'ذهبي',    min_spend: 500,  color: '#FFD700', icon: '🥇', benefits: 'Coming soon',         is_active: true },
  { tier: 'platinum', name_en: 'Platinum', name_ar: 'بلاتيني', min_spend: 1500, color: '#E5E4E2', icon: '💎', benefits: 'Coming soon',         is_active: true },
  { tier: 'vip',      name_en: 'VIP',      name_ar: 'كبار',    min_spend: 5000, color: '#c9a84c', icon: '👑', benefits: 'Coming soon',         is_active: true },
]

const IQD_PER_USD = 1540

// ── URL → country-of-origin detection (used by admin filter) ──────────────────

const COUNTRY_DOMAINS: Record<string, string[]> = {
  'USA':    ['amazon.', 'ebay.', 'walmart.', 'target.', 'bestbuy.', 'newegg.', 'etsy.', 'macys.', 'nordstrom.', 'samsclub.'],
  'Turkey': ['trendyol.', 'lcwaikiki.', 'hepsiburada.', 'n11.', 'ciceksepeti.'],
  'China':  ['alibaba.', 'aliexpress.', 'taobao.', '1688.', 'jd.', 'shein.'],
  'UAE':    ['noon.', 'namshi.', 'ounass.', 'sharafdg.', 'sivvi.'],
}

function detectOrderCountry(url: string): string {
  const u = url.toLowerCase()
  for (const [country, domains] of Object.entries(COUNTRY_DOMAINS)) {
    if (domains.some(d => u.includes(d))) return country
  }
  return ''
}

// ── Small shared components ───────────────────────────────────────────────────

const Badge = React.memo(function Badge({ status }: { status: string }) {
  const { language } = useLanguage()
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return <span className={`${styles.badge} ${styles[s.cls]}`}>{s.icon} {language === 'ar' ? s.labelAr : s.label}</span>
})

function Spinner() {
  return <span className={styles.spinner} />
}

function Toast({ toasts }: { toasts: Toast[] }) {
  return (
    <div className={styles.toastContainer}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles['toast_' + t.type]}`}>
          <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── AutoCalculate ─────────────────────────────────────────────────────────────

function AutoCalculate({ url, onResult }: { url: string; onResult: (weight: string, dims: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [error, setError] = useState('')

  const isSupported = SUPPORTED_SITES.some(site => url.toLowerCase().includes(site))
  const detectedSite = SUPPORTED_SITES.find(site => url.toLowerCase().includes(site))
  const isTrendyol          = url.toLowerCase().includes('trendyol.com')
  const isBoutiqaatOrNoon   = url.toLowerCase().includes('boutiqaat.com') || url.toLowerCase().includes('noon.com')
  const isAliExpress        = url.toLowerCase().includes('aliexpress.com')

  const calculate = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data: ScrapeResult = await response.json()
      if (!data.found) { setError(data.reason || data.error || 'Could not find info. Enter manually.'); setLoading(false); return }
      setResult(data)
      onResult(
        `${data.billable_weight_kg} kg`,
        `${data.length_cm} x ${data.width_cm} x ${data.height_cm} cm`,
      )
    } catch { setError('Could not fetch. Enter manually.') }
    setLoading(false)
  }

  return (
    <div>
      {isSupported ? (
        <>
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(76,175,122,0.08)', border: '1px solid rgba(76,175,122,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--green)' }}>
            ✅ Supported site detected: <strong>{detectedSite}</strong>
          </div>
          <button className={styles.btnPrimary} style={{ width: '100%', marginBottom: 16 }} onClick={calculate} disabled={loading}>
            {loading ? <><span className={styles.spinner} /> Fetching product info...</> : '🤖 Auto Calculate from URL'}
          </button>
          {error && !isTrendyol && !isAliExpress && <div className={styles.errorBox}>{error}</div>}
          {result?.found && (
            <div className={styles.infoBox} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>✅ {result.product_name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div>⚖️ Actual Weight: <strong>{result.actual_weight_kg ? `${result.actual_weight_kg} kg` : '—'}</strong></div>
                <div>📐 Length: <strong>{result.length_cm ? `${result.length_cm} cm` : '—'}</strong></div>
                <div>📐 Width: <strong>{result.width_cm ? `${result.width_cm} cm` : '—'}</strong></div>
                <div>📐 Height: <strong>{result.height_cm ? `${result.height_cm} cm` : '—'}</strong></div>
                {result.dimensional_weight_kg
                  ? <div>📦 Dim. Weight: <strong>{result.dimensional_weight_kg} kg</strong></div>
                  : <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>📦 Dimensions not listed</div>
                }
                <div style={{ color: 'var(--gold)', fontWeight: 700 }}>💰 Billable: <strong>{result.billable_weight_kg} kg</strong></div>
              </div>
              {!result.dimensional_weight_kg && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>
                  ⚠️ Dimensions not available. Billable weight based on actual weight only.
                </div>
              )}
            </div>
          )}
          {/* Trendyol estimator — shown always for Trendyol, used as starting point */}
          {isTrendyol && !result?.found && (
            <TrendyolWeightEstimator
              onWeightSelect={kg => onResult(`${kg} kg (estimated)`, '')}
            />
          )}
          {isBoutiqaatOrNoon && !result?.found && (
            <BoutiqaatWeightEstimator
              onWeightSelect={kg => onResult(`${kg} kg (estimated)`, '')}
            />
          )}
          {isAliExpress && !result?.found && (
            <BoutiqaatWeightEstimator
              onWeightSelect={kg => onResult(`${kg} kg (estimated)`, '')}
            />
          )}
        </>
      ) : (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,123,58,0.08)', border: '1px solid rgba(224,123,58,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--orange)' }}>
          ⚠️ Auto calculate only available for supported sites. Enter manually below.
        </div>
      )}
      <div className={styles.infoBox}>📋 Review the product link, then enter shipping details below.</div>
    </div>
  )
}

// ── Shipping progress constants ───────────────────────────────────────────────

const PROGRESS_STEPS = ['pending', 'calculated', 'confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'out_for_delivery', 'delivered']

const NEXT_STATUS: Record<string, string> = {
  confirmed:        'ordered',
  ordered:          'warehouse',
  warehouse:        'transit',
  transit:          'arrived',
  arrived:          'out_for_delivery',
  out_for_delivery: 'delivered',
}

// Maps an order status to its WhatsApp notification event.
const STATUS_EVENT: Record<string, string> = {
  ordered:          'item_ordered',
  warehouse:        'at_warehouse',
  transit:          'in_transit',
  arrived:          'arrived_city',
  out_for_delivery: 'out_for_delivery',
  delivered:        'delivered',
  rejected:         'rejected',
}

// Fire-and-forget WhatsApp notification — silent-fail, never blocks the UI.
function notifyWhatsapp(orderId: string, event: string, extra?: Record<string, unknown>): void {
  fetch('/api/whatsapp/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, event, ...extra }),
  }).catch(() => {})
}

const NEXT_LABEL: Record<string, string> = {
  confirmed:        'Mark as Ordered 🛒',
  ordered:          'Mark as At Warehouse 🏭',
  warehouse:        'Mark as In Transit ✈️',
  transit:          'Mark as Arrived in City 🏙️',
  arrived:          'Mark as Out for Delivery 🛵',
  out_for_delivery: 'Mark as Delivered 📬',
}

const DELIVERY_OPTIONS_MODAL = [
  { id: 'pickup',       label: 'Pickup at office',        fee: 0    },
  { id: 'home_erbil',   label: 'Home delivery — Erbil',   fee: 3000 },
  { id: 'home_baghdad', label: 'Home delivery — Baghdad', fee: 5000 },
  { id: 'other',        label: 'Other city — contact us', fee: null },
] as const

// ── SubmitOrderModal ──────────────────────────────────────────────────────────

function SubmitOrderModal({ userId, onClose, onDone, prefill, onWishlistSave }: {
  userId: string
  onClose: () => void
  onDone: () => void
  prefill?: { url?: string; description?: string; note?: string; photo_url?: string }
  onWishlistSave?: (data: { url: string; description?: string; notes?: string; photo_url?: string }) => Promise<void>
}) {
  const [form, setForm] = useState<OrderForm>({
    url: prefill?.url || '', description: prefill?.description || '', category: 'Electronics', qty: 1,
    itemPrice: '', itemPriceCurrency: 'USD', note: prefill?.note || '', urgency: false,
    deliveryPreference: 'pickup', deliveryCity: '',
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [wishSaving, setWishSaving] = useState(false)
  const [wishSaved, setWishSaved] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [estimateError, setEstimateError] = useState('')
  const [trendyolKg, setTrendyolKg]     = useState<number | null>(null)
  const [boutiqaatKg, setBoutiqaatKg]   = useState<number | null>(null)
  const [aliexpressKg, setAliexpressKg] = useState<number | null>(null)
  const [thumbUrl, setThumbUrl] = useState<string | null>(prefill?.photo_url ?? null)
  const [thumbLoading, setThumbLoading] = useState(false)

  const handle = <K extends keyof OrderForm>(k: K, v: OrderForm[K]) => setForm(p => ({ ...p, [k]: v }))

  const isTrendyolUrl     = form.url.toLowerCase().includes('trendyol.com')
  const isBoutiqaatUrl    = form.url.toLowerCase().includes('boutiqaat.com')
  const isNoonUrl         = form.url.toLowerCase().includes('noon.com')
  const isUaeEstimatorUrl = isBoutiqaatUrl || isNoonUrl
  const isAliExpressUrl   = form.url.toLowerCase().includes('aliexpress.com')

  useEffect(() => {
    setTrendyolKg(null)
    setBoutiqaatKg(null)
    setAliexpressKg(null)
    const supported = SUPPORTED_SITES.some(s => form.url.toLowerCase().includes(s))
    if (!supported || !form.url) { setScrapeResult(null); setEstimateLoading(false); setEstimateError(''); return }
    setEstimateLoading(true)
    setEstimateError('')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: form.url }) })
        const data: ScrapeResult = await res.json()
        if (data.found && data.billable_weight_kg) {
          setScrapeResult(data)
        } else {
          setScrapeResult(null)
          setEstimateError(data.reason || data.error || 'Could not calculate estimate for this product.')
        }
      } catch (e) {
        setScrapeResult(null)
        setEstimateError(e instanceof Error ? e.message : 'Failed to reach the scrape API.')
      }
      setEstimateLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [form.url])

  useEffect(() => {
    setThumbUrl(null)
    setThumbLoading(false)
    if (!form.url || !form.url.startsWith('http')) return
    setThumbLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/product-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: form.url }) })
        const data = await res.json()
        setThumbUrl(data.image_url || null)
      } catch { setThumbUrl(null) }
      setThumbLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [form.url])

  const submit = async () => {
    if (!form.url || !form.description) { setError('URL and description are required'); return }
    if (!form.url.startsWith('http')) { setError('URL must start with http:// or https://'); return }
    setLoading(true); setError('')
    const { error: err, orderId } = await createOrder(userId, form, photo, thumbUrl)
    setLoading(false)
    if (err) { setError(err); return }
    if (orderId) notifyWhatsapp(orderId, 'order_received')
    onDone(); onClose()
  }

  const saveToWishlist = async () => {
    if (!form.url) { setError('Enter a URL first'); return }
    setWishSaving(true)
    await onWishlistSave?.({ url: form.url, description: form.description, notes: form.note, photo_url: thumbUrl ?? undefined })
    setWishSaving(false)
    setWishSaved(true)
    setTimeout(() => setWishSaved(false), 3000)
  }

  const isUrlSupported = SUPPORTED_SITES.some(s => form.url.toLowerCase().includes(s))
  const uaeCategoryKey = scrapeResult?.category ? `UAE_${scrapeResult.category}` : null
  const rates = (uaeCategoryKey ? SHIPPING_RATES[uaeCategoryKey] : null) ?? SHIPPING_RATES[scrapeResult?.site?.country ?? ''] ?? { min: 10000, max: 18000 }
  const totalKg = scrapeResult?.billable_weight_kg ? scrapeResult.billable_weight_kg * form.qty : 0
  const shippingEstimate = totalKg > 0 ? { min: Math.round(rates.min * totalKg), max: Math.round(rates.max * totalKg), kg: totalKg } : null

  // Estimate from Trendyol estimator when scraper finds no weight
  const turkeyRates = SHIPPING_RATES['Turkey'] ?? { min: 5000, max: 8000 }
  const trendyolTotalKg = trendyolKg ? trendyolKg * form.qty : 0
  const trendyolEstimate = !shippingEstimate && trendyolTotalKg > 0
    ? { min: Math.round(turkeyRates.min * trendyolTotalKg), max: Math.round(turkeyRates.max * trendyolTotalKg), kg: trendyolTotalKg }
    : null
  const uaeEstimatorRates = SHIPPING_RATES['UAE_Cosmetics'] ?? { min: 10513, max: 10513 }
  const boutiqaatTotalKg  = boutiqaatKg ? boutiqaatKg * form.qty : 0
  const boutiqaatEstimate = !shippingEstimate && !trendyolEstimate && boutiqaatTotalKg > 0
    ? { min: Math.round(uaeEstimatorRates.min * boutiqaatTotalKg), max: Math.round(uaeEstimatorRates.max * boutiqaatTotalKg), kg: boutiqaatTotalKg }
    : null
  const chinaRates = SHIPPING_RATES['China'] ?? { min: 8000, max: 14000 }
  const aliexpressTotalKg = aliexpressKg ? aliexpressKg * form.qty : 0
  const aliexpressEstimate = !shippingEstimate && !trendyolEstimate && !boutiqaatEstimate && aliexpressTotalKg > 0
    ? { min: Math.round(chinaRates.min * aliexpressTotalKg), max: Math.round(chinaRates.max * aliexpressTotalKg), kg: aliexpressTotalKg }
    : null
  const activeEstimate = shippingEstimate || trendyolEstimate || boutiqaatEstimate || aliexpressEstimate

  const deliveryOptModal = DELIVERY_OPTIONS_MODAL.find(d => d.id === form.deliveryPreference)
  const estimateDeliveryFeeIqd = deliveryOptModal?.fee ?? 0

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>New Order · طلب جديد</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        {error && <div className={styles.errorBox}>{error}</div>}
        <div className={styles.formGroup}>
          <label className={styles.label}>Product URL · رابط المنتج *</label>
          <input className={styles.input} placeholder="https://amazon.com/dp/..." value={form.url} onChange={e => handle('url', e.target.value)} />
          {(thumbLoading || thumbUrl) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ width: 80, height: 80, borderRadius: 8, background: 'var(--surface3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {thumbLoading
                  ? <span className={styles.spinner} style={{ width: 18, height: 18, borderTopColor: 'var(--gold)' }} />
                  : <img src={thumbUrl!} alt="" loading="lazy" style={{ width: 80, height: 80, objectFit: 'contain' }} onError={() => setThumbUrl(null)} />
                }
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: thumbLoading ? 'var(--text-dim)' : 'var(--green)', marginBottom: 3 }}>
                  {thumbLoading ? 'Fetching product image...' : '✓ Product image found'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {thumbLoading ? 'This may take a moment' : 'Image will be saved with your order'}
                </div>
              </div>
            </div>
          )}
        </div>
        {estimateLoading && isUrlSupported && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 8, fontSize: 12, color: 'var(--text-dim)', marginTop: -12, marginBottom: 16 }}>
            <span className={styles.spinner} style={{ width: 14, height: 14, borderColor: 'rgba(201,168,76,0.25)', borderTopColor: 'var(--gold)' }} /> Calculating shipping estimate...
          </div>
        )}
        {/* Error only for non-Trendyol/Boutiqaat/AliExpress URLs */}
        {estimateError && !estimateLoading && isUrlSupported && !isTrendyolUrl && !isUaeEstimatorUrl && !isAliExpressUrl && (
          <div style={{ padding: '9px 13px', background: 'rgba(224,123,58,0.08)', border: '1px solid rgba(224,123,58,0.25)', borderRadius: 8, fontSize: 12, color: 'var(--orange)', marginTop: -12, marginBottom: 16 }}>
            ⚠️ {estimateError}
          </div>
        )}
        {/* Trendyol weight estimator */}
        {isTrendyolUrl && !estimateLoading && !scrapeResult && form.url && (
          <div style={{ marginTop: -12, marginBottom: 16 }}>
            <TrendyolWeightEstimator onWeightSelect={kg => setTrendyolKg(kg)} />
          </div>
        )}
        {/* Noon / Boutiqaat weight estimator */}
        {isUaeEstimatorUrl && !estimateLoading && !scrapeResult && form.url && (
          <div style={{ marginTop: -12, marginBottom: 16 }}>
            <BoutiqaatWeightEstimator onWeightSelect={kg => setBoutiqaatKg(kg)} />
          </div>
        )}
        {/* AliExpress weight estimator */}
        {isAliExpressUrl && !estimateLoading && !scrapeResult && form.url && (
          <div style={{ marginTop: -12, marginBottom: 16 }}>
            <BoutiqaatWeightEstimator onWeightSelect={kg => setAliexpressKg(kg)} />
          </div>
        )}
        {activeEstimate && !estimateLoading && (
          <div style={{ padding: '14px 16px', background: 'rgba(201,168,76,0.06)', border: '1px dashed rgba(201,168,76,0.35)', borderRadius: 10, marginTop: -12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>≈ Cost Estimate · تقدير التكلفة</span>
              <span style={{ fontSize: 10, color: 'var(--gold-dim)', background: 'rgba(201,168,76,0.12)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(201,168,76,0.2)', fontWeight: 600, letterSpacing: '0.5px' }}>APPROXIMATE</span>
            </div>
            {form.itemPrice && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Item Price · سعر المنتج</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{form.itemPrice} {form.itemPriceCurrency}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Shipping · الشحن</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>
                ~${(activeEstimate.min / IQD_PER_USD).toFixed(2)} – ${(activeEstimate.max / IQD_PER_USD).toFixed(2)} USD
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Iraq Delivery · التوصيل</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {deliveryOptModal?.fee === null ? 'Contact us' : deliveryOptModal?.fee === 0 ? 'Free' : `~$${(estimateDeliveryFeeIqd / IQD_PER_USD).toFixed(2)}`}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, marginBottom: 8, borderTop: '1px solid rgba(201,168,76,0.12)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Service Fee · رسوم الخدمة</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>TBD</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {activeEstimate.kg} kg {trendyolEstimate ? 'estimated' : 'billable'} weight{form.qty > 1 ? ` × ${form.qty} items` : ''} · Final price confirmed by ShipIQ
            </div>
          </div>
        )}
        <div className={styles.formGroup}>
          <label className={styles.label}>Description · الوصف *</label>
          <input className={styles.input} placeholder="e.g. Nike Air Max 270 - Size 42 - Black" value={form.description} onChange={e => handle('description', e.target.value)} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5 }}>Include size, color, model number, and any variant details</div>
        </div>
        <div className={styles.grid2}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Category · الفئة</label>
            <select className={styles.input} value={form.category} onChange={e => handle('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Quantity · الكمية</label>
            <input className={styles.input} type="number" min="1" value={form.qty} onChange={e => handle('qty', parseInt(e.target.value) || 1)} />
          </div>
        </div>
        <div className={styles.grid2}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Item Price · سعر المنتج</label>
            <input className={styles.input} type="number" placeholder="0.00" value={form.itemPrice} onChange={e => handle('itemPrice', e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Currency · العملة</label>
            <select className={styles.input} value={form.itemPriceCurrency} onChange={e => handle('itemPriceCurrency', e.target.value)}>
              <option value="USD">USD — دولار</option>
              <option value="IQD">IQD — دينار</option>
              <option value="EUR">EUR — يورو</option>
              <option value="GBP">GBP — جنيه</option>
            </select>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Notes · ملاحظات</label>
          <textarea className={styles.textarea} placeholder="Color, size, special instructions..." value={form.note} onChange={e => handle('note', e.target.value)} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Photo (optional) · صورة اختيارية</label>
          <div className={`${styles.uploadArea} ${photo ? styles.hasFile : ''}`} onClick={() => fileRef.current?.click()}>
            <div className={styles.uploadIcon}>{photo ? '🖼️' : '📎'}</div>
            <div className={styles.uploadLabel}>{photo ? photo.name : 'Click to upload a screenshot or photo'}</div>
            <div className={styles.uploadSub}>PNG, JPG up to 5MB</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setPhoto(e.target.files?.[0] || null)} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Delivery in Iraq · التوصيل في العراق</label>
          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {DELIVERY_OPTIONS_MODAL.map((opt, i) => (
              <label
                key={opt.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', cursor: 'pointer',
                  borderBottom: i < DELIVERY_OPTIONS_MODAL.length - 1 ? '1px solid var(--border)' : 'none',
                  background: form.deliveryPreference === opt.id ? 'rgba(201,168,76,0.06)' : 'transparent',
                }}
              >
                <input
                  type="radio" name="deliveryPref" value={opt.id}
                  checked={form.deliveryPreference === opt.id}
                  onChange={() => handle('deliveryPreference', opt.id)}
                  style={{ accentColor: 'var(--gold)', width: 15, height: 15, flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{opt.label}</span>
                <span style={{ fontSize: 11, color: opt.fee === 0 ? 'var(--green)' : 'var(--text-dim)', marginLeft: 'auto' }}>
                  {opt.fee === null ? 'Contact us' : opt.fee === 0 ? 'Free' : `~$${(opt.fee / IQD_PER_USD).toFixed(2)}`}
                </span>
              </label>
            ))}
          </div>
          {form.deliveryPreference === 'other' && (
            <input
              className={styles.input}
              style={{ marginTop: 8 }}
              placeholder="Enter your city · اكتب مدينتك"
              value={form.deliveryCity}
              onChange={e => handle('deliveryCity', e.target.value)}
            />
          )}
        </div>
        <div className={styles.urgencyRow} onClick={() => handle('urgency', !form.urgency)}>
          <div className={`${styles.checkbox} ${form.urgency ? styles.checked : ''}`}>{form.urgency && <span>✓</span>}</div>
          <div>
            <div className={styles.urgencyLabel}>⚡ Urgent Order · طلب عاجل</div>
            <div className={styles.urgencySub}>May affect pricing · قد يؤثر على السعر</div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          {onWishlistSave && (
            <button
              onClick={saveToWishlist}
              disabled={wishSaving || !form.url}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                background: wishSaved ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                color: wishSaved ? '#16a34a' : '#ef4444',
                border: `1px solid ${wishSaved ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                opacity: wishSaving ? 0.7 : 1,
              }}
            >
              {wishSaved ? '✓ Saved!' : wishSaving ? '...' : '❤️ Wishlist'}
            </button>
          )}
          <button className={styles.btnPrimary} onClick={submit} disabled={loading || !form.url || !form.description}>
            {loading ? <Spinner /> : 'Submit Order · إرسال'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── OrderDetailModal ──────────────────────────────────────────────────────────

function OrderDetailModal({ order, isAdmin, adminName, currentUserId, onClose, onRefresh, onNotesRead }: { order: Order; isAdmin: boolean; adminName?: string; currentUserId: string; onClose: () => void; onRefresh: () => void; onNotesRead?: () => void }) {
  const [view, setView] = useState<'detail' | 'calculate' | 'reject' | 'billing' | 'notes'>('detail')
  const [notesUnread, setNotesUnread] = useState(0)
  const autoDeliveryFee =
    order.delivery_preference === 'home_erbil'   ? '3000' :
    order.delivery_preference === 'home_baghdad' ? '5000' : '0'
  const [shipping, setShipping] = useState({ price: '', currency: 'IQD', weight: '', serviceFee: '', customsFee: '', deliveryFee: autoDeliveryFee })
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [orderCustomerProfile, setOrderCustomerProfile] = useState<Profile | null>(null)
  const [showInlineTopUp, setShowInlineTopUp] = useState(false)

  // Billing tab state
  const [billServiceFee, setBillServiceFee] = useState(String(order.service_fee ?? 0))
  const [billCustomsFee, setBillCustomsFee] = useState(String(order.customs_fee ?? 0))
  const [billDeliveryFee, setBillDeliveryFee] = useState(autoDeliveryFee)
  const [chargeLoading, setChargeLoading] = useState(false)
  const [chargeError, setChargeError] = useState('')
  const [charged, setCharged] = useState(order.is_charged ?? false)
  const [chargedAt, setChargedAt] = useState(order.charged_at ?? '')
  const [waveSyncStatus, setWaveSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>(
    order.wave_sync_status === 'synced' ? 'synced' : order.wave_sync_status === 'failed' ? 'failed' : 'idle'
  )
  const [copied, setCopied] = useState(false)

  // Affiliate URL (admin only)
  const [affSettings, setAffSettings] = useState<Record<string, string>>({})
  useEffect(() => {
    if (isAdmin) getAppSettings().then(({ settings }) => setAffSettings(settings))
  }, [isAdmin])

  // Agent photo state (local mirror so remove/replace reflects without refetch)
  const [lightboxUrl, setLightboxUrl]       = useState<string | null>(null)
  const [localReceiptUrl, setLocalReceiptUrl]     = useState<string | null>(order.agent_receipt_url ?? null)
  const [localWarehouseUrl, setLocalWarehouseUrl] = useState<string | null>(order.agent_warehouse_photo_url ?? null)
  const [confirmRemove, setConfirmRemove]   = useState<'receipt' | 'warehouse' | null>(null)
  const [replaceType, setReplaceType]       = useState<'receipt' | 'warehouse' | null>(null)
  const [replaceLoading, setReplaceLoading] = useState(false)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const handleRemovePhoto = async (type: 'receipt' | 'warehouse') => {
    setConfirmRemove(null)
    const update = type === 'receipt' ? { agent_receipt_url: null } : { agent_warehouse_photo_url: null }
    await updateOrder(order.id, update as Record<string, unknown>)
    if (type === 'receipt') setLocalReceiptUrl(null)
    else setLocalWarehouseUrl(null)
  }

  const handleReplacePhoto = async (file: File) => {
    if (!replaceType) return
    setReplaceLoading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const folder = replaceType === 'receipt' ? 'receipts' : 'warehouse'
    const fileName = `${folder}/admin/${order.id}-replace-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('agent-uploads').upload(fileName, file)
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('agent-uploads').getPublicUrl(fileName)
      const update = replaceType === 'receipt'
        ? { agent_receipt_url: urlData.publicUrl }
        : { agent_warehouse_photo_url: urlData.publicUrl }
      await updateOrder(order.id, update as Record<string, unknown>)
      if (replaceType === 'receipt') setLocalReceiptUrl(urlData.publicUrl)
      else setLocalWarehouseUrl(urlData.publicUrl)
    }
    setReplaceType(null)
    setReplaceLoading(false)
  }

  // Estimated delivery date based on country + ordered_at
  const etaDays: Record<string, number> = { USA: 15, Turkey: 10, UAE: 7, China: 20 }
  const orderCountry = order.country_origin || ''
  const eta = order.ordered_at && etaDays[orderCountry]
    ? (() => {
        const d = new Date(order.ordered_at)
        d.setDate(d.getDate() + etaDays[orderCountry])
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      })()
    : null

  const copyOrderDetails = () => {
    const lines = [
      `ShipIQ Order — ${order.id}`,
      `Product: ${order.description}`,
      order.url ? `URL: ${order.url}` : '',
      order.item_price ? `Item Price: ${order.item_price} ${order.item_price_currency}` : '',
      order.shipping_price ? `Shipping: $${(order.shipping_price / IQD_PER_USD).toFixed(2)} USD` : '',
      order.total_cost ? `Total: $${(order.total_cost / IQD_PER_USD).toFixed(2)} USD` : '',
      `Status: ${STATUS_CONFIG[order.status]?.label ?? order.status}`,
      `Date: ${order.created_at?.split('T')[0]}`,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const s = STATUS_CONFIG[order.status]

  useEffect(() => {
    if (isAdmin) {
      getProfile(order.user_id).then(setOrderCustomerProfile)
    }
  }, [isAdmin, order.user_id])

  useEffect(() => {
    getOrderUnreadCounts([order.id], isAdmin).then(counts => {
      setNotesUnread(counts[order.id] || 0)
    })
  }, [order.id, isAdmin])

  const applyUpdate = async (updates: Record<string, unknown>, event?: string, extra?: Record<string, unknown>) => {
    setLoading(true)
    await updateOrder(order.id, updates)
    if (event) notifyWhatsapp(order.id, event, extra)
    setLoading(false); onRefresh(); onClose()
  }

  const handleCalculate = () => {
    const shippingPrice = parseInt(shipping.price) || 0
    const serviceFee    = parseInt(shipping.serviceFee) || 0
    const customsFee    = parseInt(shipping.customsFee) || 0
    const deliveryFee   = parseInt(shipping.deliveryFee) || 0
    const totalCost     = shippingPrice + serviceFee + customsFee + deliveryFee
    applyUpdate({
      status: 'calculated',
      shipping_price: shippingPrice,
      shipping_currency: 'IQD',
      weight: shipping.weight,
      service_fee: serviceFee,
      customs_fee: customsFee,
      delivery_fee: deliveryFee,
      total_cost: totalCost,
    }, 'price_calculated')
  }

  const handleConfirm = async () => {
    if (loading) return                        // prevent double-tap
    if (order.status !== 'calculated') return  // client-side guard
    setLoading(true)
    const session = await getSession()
    if (!session) { setLoading(false); return }
    const res = await fetch('/api/orders/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id, access_token: session.access_token }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) {
      console.error('confirmOrder error:', data.error)
      return
    }
    notifyWhatsapp(order.id, 'order_confirmed')
    onRefresh(); onClose()
  }

  const billShipping = order.shipping_price ?? 0
  const billItemPrice = order.item_price ?? 0
  const billTotal = billShipping + (parseInt(billServiceFee) || 0) + (parseInt(billCustomsFee) || 0) + (parseInt(billDeliveryFee) || 0)

  const handleCharge = async () => {
    if (!orderCustomerProfile) return
    if (charged) return
    const total = billTotal
    if (total <= 0) { setChargeError('Total must be greater than 0'); return }
    const totalUsd = Math.round((total / IQD_PER_USD) * 100) / 100
    const balanceUsd = orderCustomerProfile.balance_usd ?? 0
    if (balanceUsd + 0.001 < totalUsd) {
      setChargeError(`Insufficient balance — customer needs $${(totalUsd - balanceUsd).toFixed(2)} more`)
      return
    }
    setChargeLoading(true); setChargeError('')
    const note = `Order ${order.id}: Shipping ${billShipping.toLocaleString()} IQD + Service ${(parseInt(billServiceFee)||0).toLocaleString()} IQD + Customs ${(parseInt(billCustomsFee)||0).toLocaleString()} IQD + Delivery ${(parseInt(billDeliveryFee)||0).toLocaleString()} IQD — by ${adminName || 'Admin'}`
    const { error: deductErr } = await deductBalance(orderCustomerProfile.id, balanceUsd, totalUsd, IQD_PER_USD, note, order.id)
    if (deductErr) { setChargeError(deductErr); setChargeLoading(false); return }
    const now = new Date().toISOString()
    await updateOrder(order.id, {
      is_charged: true,
      charged_at: now,
      total_charged: total,
      service_fee: parseInt(billServiceFee) || 0,
      customs_fee: parseInt(billCustomsFee) || 0,
      delivery_fee: parseInt(billDeliveryFee) || 0,
      total_cost: billTotal,
    })
    setCharged(true); setChargedAt(now)
    setChargeLoading(false)
    getProfile(order.user_id).then(setOrderCustomerProfile)
    onRefresh()

    // Fire-and-forget Wave sync
    if (orderCustomerProfile) {
      setWaveSyncStatus('syncing')
      fetch('/api/accounting/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          customer_name: orderCustomerProfile.full_name,
          customer_email: orderCustomerProfile.email,
          description: `ShipIQ Order ${order.id}: ${order.description}`,
          shipping_iqd: billShipping,
          service_fee_iqd: parseInt(billServiceFee) || 0,
          customs_fee_iqd: parseInt(billCustomsFee) || 0,
          delivery_fee_iqd: parseInt(billDeliveryFee) || 0,
          total_iqd: total,
        }),
      })
        .then(r => r.json())
        .then(data => setWaveSyncStatus(data.ok ? 'synced' : 'failed'))
        .catch(() => setWaveSyncStatus('failed'))
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* ── Lightbox ── */}
        {lightboxUrl && (
          <div
            onClick={() => setLightboxUrl(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          >
            <button onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2001 }}>✕</button>
            <img
              src={lightboxUrl}
              alt="Full size"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain', boxShadow: '0 8px 60px rgba(0,0,0,0.8)' }}
            />
          </div>
        )}

        {/* ── Confirm Remove ── */}
        {confirmRemove && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 24px 20px', width: 340, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>🗑️ Remove Photo?</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
                Remove this photo? The agent will need to re-upload.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmRemove(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
                <button onClick={() => handleRemovePhoto(confirmRemove)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Remove</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Hidden replace file input ── */}
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleReplacePhoto(f); e.target.value = '' }}
        />

        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={styles.modalTitle}>{order.id}</span>
            <Badge status={order.status} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={copyOrderDetails}
              aria-label="Copy order details"
              title="Copy order summary for WhatsApp"
              style={{ fontSize: 13, padding: '5px 10px', background: copied ? 'rgba(22,163,74,0.1)' : 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: copied ? '#16a34a' : 'var(--text-muted)', fontWeight: 600 }}
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
            <button className={styles.modalClose} onClick={onClose} aria-label="Close modal">✕</button>
          </div>
        </div>
        {eta && (
          <div style={{ padding: '8px 20px', background: 'rgba(76,175,122,0.07)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
            📅 Estimated delivery: {eta} ({orderCountry})
          </div>
        )}
        {!isAdmin && (
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${view !== 'notes' ? styles.activeTab : ''}`} onClick={() => setView('detail')}>Details</button>
            <button className={`${styles.tab} ${view === 'notes' ? styles.activeTab : ''}`} onClick={() => { setView('notes'); setNotesUnread(0) }}>
              💬 Notes{notesUnread > 0 ? ` (${notesUnread})` : ''}
            </button>
          </div>
        )}
        {isAdmin && (
          <>
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${view === 'detail' ? styles.activeTab : ''}`} onClick={() => setView('detail')}>Details</button>
              {order.status === 'pending' && <button className={`${styles.tab} ${view === 'calculate' ? styles.activeTab : ''}`} onClick={() => setView('calculate')}>Calculate</button>}
              {order.shipping_price && <button className={`${styles.tab} ${view === 'billing' ? styles.activeTab : ''}`} onClick={() => setView('billing')}>💳 Billing</button>}
              {['pending', 'calculated'].includes(order.status) && <button className={`${styles.tab} ${view === 'reject' ? styles.activeTab : ''}`} onClick={() => setView('reject')}>Reject</button>}
              <button className={`${styles.tab} ${view === 'notes' ? styles.activeTab : ''}`} onClick={() => { setView('notes'); setNotesUnread(0) }}>
                💬 Notes{notesUnread > 0 ? ` (${notesUnread})` : ''}
              </button>
            </div>
            {NEXT_STATUS[order.status] && (
              <div style={{ padding: '0 0 16px' }}>
                <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={() => applyUpdate({ status: NEXT_STATUS[order.status] }, STATUS_EVENT[NEXT_STATUS[order.status]])} disabled={loading}>
                  {loading ? <Spinner /> : NEXT_LABEL[order.status]}
                </button>
              </div>
            )}
            {order.status === 'delivered' && (
              <div style={{ textAlign: 'center', padding: '8px 0 16px', fontSize: 15, color: 'var(--green)', fontWeight: 700 }}>Order Complete ✅</div>
            )}
            {orderCustomerProfile && (
              <div style={{ display: 'flex', gap: 8, paddingBottom: 16 }}>
                <button className={styles.btnGhost} style={{ flex: 1, fontSize: 13 }} onClick={() => setShowInlineTopUp(true)}>
                  + Add Balance
                </button>
              </div>
            )}
          </>
        )}
        {showInlineTopUp && orderCustomerProfile && (
          <TopUpModal
            user={orderCustomerProfile}
            onClose={() => setShowInlineTopUp(false)}
            onDone={() => { getProfile(order.user_id).then(setOrderCustomerProfile); onRefresh() }}
          />
        )}
        {view === 'detail' && (
          <div>
            {order.photo_url && (
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <img
                  src={order.photo_url} alt={order.description}
                  style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }}
                  onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none' }}
                />
                <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingTop: 4, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{order.description}</div>
                  <a href={order.photo_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>View full image ↗</a>
                </div>
              </div>
            )}
            {!isAdmin && order.status !== 'rejected' && (
              <div className={styles.progressTimeline}>
                {PROGRESS_STEPS.map((step, i) => {
                  const cfg = STATUS_CONFIG[step]
                  const currentIdx = PROGRESS_STEPS.indexOf(order.status)
                  const isDone = i < currentIdx
                  const isCurrent = i === currentIdx
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'flex-start', flex: i < PROGRESS_STEPS.length - 1 ? '1' : undefined }}>
                      <div className={`${styles.progressStep} ${isDone ? styles.progressDone : ''} ${isCurrent ? styles.progressCurrent : ''}`}>
                        <div className={styles.progressDot}>{isDone ? '✓' : cfg.icon}</div>
                        <div className={styles.progressLabel}>{cfg.label}</div>
                      </div>
                      {i < PROGRESS_STEPS.length - 1 && (
                        <div className={`${styles.progressConnector} ${isDone ? styles.progressConnectorDone : ''}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {/* ── Agent photos (customer view) ── */}
            {!isAdmin && (localReceiptUrl || localWarehouseUrl) && (
              <div style={{ marginBottom: 18, padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  📸 Order Photos · صور الطلب
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {localReceiptUrl && (
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src={localReceiptUrl}
                        alt="Purchase Receipt"
                        loading="lazy"
                        onClick={() => setLightboxUrl(localReceiptUrl)}
                        style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', display: 'block', cursor: 'pointer', transition: 'transform 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                        onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none' }}
                      />
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>🧾 Purchase Receipt</div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', direction: 'rtl' }}>إيصال الشراء</div>
                    </div>
                  )}
                  {localWarehouseUrl && (
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src={localWarehouseUrl}
                        alt="Warehouse Photo"
                        loading="lazy"
                        onClick={() => setLightboxUrl(localWarehouseUrl)}
                        style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', display: 'block', cursor: 'pointer', transition: 'transform 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                        onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none' }}
                      />
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>🏭 Warehouse Photo</div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', direction: 'rtl' }}>صورة المستودع</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isAdmin && order.url && (() => {
              const affUrl = appendAffiliateTag(order.url, affSettings)
              if (affUrl !== order.url) return (
                <div className={styles.detailRow} style={{ background: 'rgba(201,168,76,0.06)', borderRadius: 8, padding: '6px 10px', marginBottom: 6 }}>
                  <span className={styles.detailKey}>🔗 Affiliate URL</span>
                  <a href={affUrl} target="_blank" rel="noopener noreferrer" className={styles.detailLink} style={{ fontSize: 11, color: 'var(--gold)', wordBreak: 'break-all' }}>{affUrl}</a>
                </div>
              )
              return null
            })()}
            {([
              ['Product URL', order.url, true],
              ['Description', order.description],
              ['Category', order.category],
              ['Quantity', order.qty],
              ['Item Price', order.item_price ? `${order.item_price} ${order.item_price_currency}` : '—'],
              order.urgency ? ['Urgency', '⚡ Urgent'] : null,
              order.note ? ['Notes', order.note] : null,
              order.weight ? ['Weight', order.weight] : null,
              ['Submitted', order.created_at?.split('T')[0]],
              order.reject_reason ? ['Rejection Reason', order.reject_reason] : null,
            ] as ([string, string | number, boolean?] | null)[])
              .filter((r): r is [string, string | number, boolean?] => r !== null)
              .map(([k, v, isLink], i) => (
                <div key={i} className={styles.detailRow}>
                  <span className={styles.detailKey}>{k}</span>
                  {isLink
                    ? <a href={String(v)} target="_blank" className={styles.detailLink}>{v}</a>
                    : <span className={styles.detailVal} style={k === 'Rejection Reason' ? { color: 'var(--red)' } : k === 'Urgency' ? { color: 'var(--orange)' } : {}}>{v}</span>
                  }
                </div>
              ))}
            {order.shipping_price && (
              <div className={styles.priceBox}>
                <div className={styles.priceLabel}>{order.total_cost ? '💰 Total Cost Breakdown' : 'Estimated Shipping Cost'}</div>
                {order.total_cost ? (
                  <div>
                    {(([
                      ['Shipping',    order.shipping_price,  order.shipping_currency || 'IQD'],
                      order.service_fee  ? ['Service Fee', order.service_fee,  'IQD'] : null,
                      order.customs_fee  ? ['Customs/Tax', order.customs_fee,  'IQD'] : null,
                      order.delivery_fee !== undefined ? ['Iraq Delivery', order.delivery_fee, 'IQD'] : null,
                    ] as ([string, number, string] | null)[]).filter((r): r is [string, number, string] => r !== null).map(([k, v, c], i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
                        <span>{k}</span>
                        <span style={{ fontWeight: 600 }}>
                          {v === 0 ? 'Free' : c === 'IQD' ? `$${(v / IQD_PER_USD).toFixed(2)} USD` : `${v.toLocaleString()} ${c}`}
                        </span>
                      </div>
                    )))}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                      <span className={styles.priceBig}>${(order.total_cost / IQD_PER_USD).toFixed(2)}</span>
                      <span className={styles.priceCurrency}> USD</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className={styles.priceBig}>{order.shipping_currency === 'IQD' ? `$${(order.shipping_price / IQD_PER_USD).toFixed(2)}` : order.shipping_price.toLocaleString()}</span>
                    <span className={styles.priceCurrency}>{order.shipping_currency === 'IQD' ? ' USD' : order.shipping_currency}</span>
                  </div>
                )}
              </div>
            )}
            {isAdmin && (localReceiptUrl || localWarehouseUrl || order.ordered_at || order.warehoused_at) && (
              <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  🤝 Agent Activity
                </div>
                {order.ordered_at && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    🛒 Ordered: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{order.ordered_at.split('T')[0]}</span>
                  </div>
                )}
                {order.warehoused_at && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    🏭 Warehoused: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{order.warehoused_at.split('T')[0]}</span>
                  </div>
                )}
                {(localReceiptUrl || localWarehouseUrl) && (
                  <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                    {(['receipt', 'warehouse'] as const).map(type => {
                      const url = type === 'receipt' ? localReceiptUrl : localWarehouseUrl
                      if (!url) return null
                      return (
                        <div key={type}>
                          <img
                            src={url}
                            alt={type}
                            loading="lazy"
                            onClick={() => setLightboxUrl(url)}
                            style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', display: 'block', cursor: 'zoom-in' }}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          />
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, textAlign: 'center' }}>
                            {type === 'receipt' ? '🧾 Receipt' : '🏭 Warehouse'}
                          </div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                            <button
                              onClick={() => { setReplaceType(type); replaceInputRef.current?.click() }}
                              disabled={replaceLoading}
                              style={{ flex: 1, padding: '3px 6px', fontSize: 10, fontWeight: 600, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >🔄 Replace</button>
                            <button
                              onClick={() => setConfirmRemove(type)}
                              style={{ flex: 1, padding: '3px 6px', fontSize: 10, fontWeight: 600, borderRadius: 5, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer' }}
                            >🗑️ Remove</button>
                          </div>
                        </div>
                      )
                    })}
                    {replaceLoading && (
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>Uploading…</div>
                    )}
                  </div>
                )}
              </div>
            )}
            {isAdmin && orderCustomerProfile && order.delivery_preference && order.delivery_preference !== 'pickup' && orderCustomerProfile.delivery_lat && (
              <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  📍 Customer Delivery Address
                </div>
                {orderCustomerProfile.delivery_address && (
                  <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 6, lineHeight: 1.5 }}>{orderCustomerProfile.delivery_address}</div>
                )}
                {orderCustomerProfile.delivery_city && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>City: <strong style={{ color: 'var(--text)' }}>{orderCustomerProfile.delivery_city}</strong></div>
                )}
                {orderCustomerProfile.delivery_notes && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 8 }}>{orderCustomerProfile.delivery_notes}</div>
                )}
                <a
                  href={`https://www.google.com/maps?q=${orderCustomerProfile.delivery_lat},${orderCustomerProfile.delivery_lng}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}
                >
                  Open in Google Maps ↗
                </a>
              </div>
            )}
            {order.status === 'calculated' && !isAdmin && (
              <button
                className={styles.btnPrimary}
                style={{ width: '100%', marginTop: 20 }}
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? <Spinner /> : 'Confirm & Proceed · تأكيد المضي قدماً'}
              </button>
            )}
          </div>
        )}
        {view === 'calculate' && (
          <div>
            <AutoCalculate url={order.url} onResult={(weight: string) => {
              setShipping(p => ({ ...p, weight }))
            }} />
            {order.delivery_preference && order.delivery_preference !== 'pickup' && (
              <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(91,155,213,0.08)', border: '1px solid rgba(91,155,213,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--blue)' }}>
                🚚 Delivery preference: <strong>{order.delivery_preference.replace('_', ' ')}</strong>
                {order.delivery_city ? ` — ${order.delivery_city}` : ''}
              </div>
            )}
            <div className={styles.grid2}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Shipping Price (IQD)</label>
                <input className={styles.input} type="number" placeholder="e.g. 35000" value={shipping.price} onChange={e => setShipping(p => ({ ...p, price: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Service Fee (IQD)</label>
                <input className={styles.input} type="number" placeholder="e.g. 5000" value={shipping.serviceFee} onChange={e => setShipping(p => ({ ...p, serviceFee: e.target.value }))} />
              </div>
            </div>
            <div className={styles.grid2}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Customs / Tax (IQD)</label>
                <input className={styles.input} type="number" placeholder="e.g. 0" value={shipping.customsFee} onChange={e => setShipping(p => ({ ...p, customsFee: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Iraq Delivery Fee (IQD)</label>
                <input className={styles.input} type="number" placeholder="0" value={shipping.deliveryFee} onChange={e => setShipping(p => ({ ...p, deliveryFee: e.target.value }))} />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Estimated Weight</label>
              <input className={styles.input} placeholder="e.g. 0.5 kg" value={shipping.weight} onChange={e => setShipping(p => ({ ...p, weight: e.target.value }))} />
            </div>
            {shipping.price && (
              <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Total Summary</div>
                {[
                  ['Shipping',     parseInt(shipping.price) || 0],
                  ['Service Fee',  parseInt(shipping.serviceFee) || 0],
                  ['Customs/Tax',  parseInt(shipping.customsFee) || 0],
                  ['Iraq Delivery',parseInt(shipping.deliveryFee) || 0],
                ].map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>{k}</span><span>${((v as number) / IQD_PER_USD).toFixed(2)} USD</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontWeight: 800, color: 'var(--gold)' }}>
                  <span>TOTAL</span>
                  <div style={{ textAlign: 'right' }}>
                    <div>${(((parseInt(shipping.price)||0)+(parseInt(shipping.serviceFee)||0)+(parseInt(shipping.customsFee)||0)+(parseInt(shipping.deliveryFee)||0)) / IQD_PER_USD).toFixed(2)} USD</div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-dim)', marginTop: 1 }}>{((parseInt(shipping.price)||0)+(parseInt(shipping.serviceFee)||0)+(parseInt(shipping.customsFee)||0)+(parseInt(shipping.deliveryFee)||0)).toLocaleString()} IQD</div>
                  </div>
                </div>
              </div>
            )}
            <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={handleCalculate} disabled={loading || !shipping.price}>
              {loading ? <Spinner /> : 'Save & Notify Customer'}
            </button>
          </div>
        )}
        {view === 'reject' && (
          <div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Rejection Reason</label>
              <textarea className={styles.textarea} placeholder="e.g. Item not available..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            </div>
            <button className={styles.btnDanger} style={{ width: '100%' }} onClick={() => applyUpdate({ status: 'rejected', reject_reason: rejectReason }, 'rejected', { reason: rejectReason })}>
              Reject Order
            </button>
          </div>
        )}
        {view === 'billing' && (
          <div>
            {/* Cost breakdown */}
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                Cost Breakdown
              </div>
              {/* Item price — read only */}
              {order.item_price ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  <span>Item Price</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{order.item_price} {order.item_price_currency}</span>
                </div>
              ) : null}
              {/* Shipping — read only */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                <span>Shipping Fee</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>${((order.shipping_price ?? 0) / IQD_PER_USD).toFixed(2)} USD</span>
              </div>
              {/* Editable fees */}
              {[
                { label: 'Service Fee', val: billServiceFee, set: setBillServiceFee },
                { label: 'Customs / Tax', val: billCustomsFee, set: setBillCustomsFee },
                { label: 'Iraq Delivery Fee', val: billDeliveryFee, set: setBillDeliveryFee },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{f.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      value={f.val}
                      onChange={e => f.set(e.target.value)}
                      disabled={charged}
                      style={{
                        width: 90, padding: '5px 8px', fontSize: 13,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 6, color: 'var(--text)', outline: 'none',
                        textAlign: 'right', opacity: charged ? 0.6 : 1,
                      }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>IQD</span>
                  </div>
                </div>
              ))}
              {/* Total */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontWeight: 800, fontSize: 15, color: 'var(--gold)' }}>
                <span>Total</span>
                <div style={{ textAlign: 'right' }}>
                  <div>${(billTotal / IQD_PER_USD).toFixed(2)} USD</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)', marginTop: 2 }}>= {billTotal.toLocaleString()} IQD (at {IQD_PER_USD.toLocaleString()} IQD/USD)</div>
                </div>
              </div>
            </div>

            {/* Customer balance */}
            {orderCustomerProfile && (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{orderCustomerProfile.full_name}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: (orderCustomerProfile.balance_usd ?? 0) >= billTotal / IQD_PER_USD ? 'var(--gold)' : '#ef4444', marginTop: 2 }}>
                      ${(orderCustomerProfile.balance_usd ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>After charge</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: (orderCustomerProfile.balance_usd ?? 0) >= billTotal / IQD_PER_USD ? 'var(--text)' : '#ef4444', marginTop: 2 }}>
                      ${((orderCustomerProfile.balance_usd ?? 0) - billTotal / IQD_PER_USD).toFixed(2)}
                    </div>
                  </div>
                </div>
                {(orderCustomerProfile.balance_usd ?? 0) < billTotal / IQD_PER_USD && (
                  <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, fontSize: 12, color: '#ef4444' }}>
                    ⚠️ Customer needs ${(billTotal / IQD_PER_USD - (orderCustomerProfile.balance_usd ?? 0)).toFixed(2)} more to proceed
                  </div>
                )}
              </div>
            )}

            {/* Charged state or charge button */}
            {charged ? (
              <div style={{ padding: '12px 16px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>
                  ✅ Charged ${((order.total_charged ?? billTotal) / IQD_PER_USD).toFixed(2)} USD
                </div>
                <div style={{ fontSize: 11, color: '#16a34a', opacity: 0.8, marginTop: 2 }}>
                  {(order.total_charged?.toLocaleString() ?? billTotal.toLocaleString())} IQD deducted from balance
                </div>
                {chargedAt && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                    on {new Date(chargedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            ) : (
              <>
                {chargeError && (
                  <div className={styles.errorBox} style={{ marginBottom: 10 }}>{chargeError}</div>
                )}
                <button
                  className={styles.btnDanger}
                  style={{ width: '100%', fontSize: 14, fontWeight: 700 }}
                  onClick={handleCharge}
                  disabled={chargeLoading || !orderCustomerProfile || billTotal <= 0}
                >
                  {chargeLoading ? <Spinner /> : `💳 Charge $${(billTotal / IQD_PER_USD).toFixed(2)} USD (${billTotal.toLocaleString()} IQD)`}
                </button>
              </>
            )}

            {/* Wave sync status */}
            {waveSyncStatus !== 'idle' && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: waveSyncStatus === 'synced' ? 'rgba(22,163,74,0.08)' : waveSyncStatus === 'failed' ? 'rgba(239,68,68,0.08)' : 'rgba(201,168,76,0.06)',
                border: `1px solid ${waveSyncStatus === 'synced' ? 'rgba(22,163,74,0.25)' : waveSyncStatus === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(201,168,76,0.2)'}`,
                color: waveSyncStatus === 'synced' ? '#16a34a' : waveSyncStatus === 'failed' ? '#ef4444' : 'var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>
                  {waveSyncStatus === 'syncing' && '⏳ Syncing to Wave...'}
                  {waveSyncStatus === 'synced'  && '✅ Synced to Wave'}
                  {waveSyncStatus === 'failed'  && '⚠️ Wave sync failed (check Settings → Wave)'}
                </span>
                {waveSyncStatus === 'failed' && charged && (
                  <button
                    onClick={() => {
                      if (!orderCustomerProfile) return
                      setWaveSyncStatus('syncing')
                      fetch('/api/accounting/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          order_id: order.id,
                          customer_name: orderCustomerProfile.full_name,
                          customer_email: orderCustomerProfile.email,
                          description: `ShipIQ Order ${order.id}: ${order.description}`,
                          shipping_iqd: billShipping,
                          service_fee_iqd: parseInt(billServiceFee) || 0,
                          customs_fee_iqd: parseInt(billCustomsFee) || 0,
                          delivery_fee_iqd: parseInt(billDeliveryFee) || 0,
                          total_iqd: billTotal,
                        }),
                      })
                        .then(r => r.json())
                        .then(data => setWaveSyncStatus(data.ok ? 'synced' : 'failed'))
                        .catch(() => setWaveSyncStatus('failed'))
                    }}
                    style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                      background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.25)', fontWeight: 700,
                    }}
                  >
                    Retry Sync
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {view === 'notes' && (
          <OrderNotes
            orderId={order.id}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            currentUserName={isAdmin ? (adminName || 'ShipIQ') : 'You'}
            orderUserId={order.user_id}
            orderUserName={isAdmin ? (orderCustomerProfile?.full_name || 'Customer') : 'ShipIQ'}
            onMarkRead={() => {
              setNotesUnread(0)
              onNotesRead?.()
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── TopUpModal ────────────────────────────────────────────────────────────────

const TOP_UP_REASONS = [
  'FIB Payment (manual verify)',
  'Qi Card Payment (manual verify)',
  'Cash Payment',
  'Adjustment/Correction',
  'Promotional Credit',
]

function TopUpModal({ user, onClose, onDone }: { user: Profile; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState(TOP_UP_REASONS[0])
  const [loading, setLoading] = useState(false)
  const { rate: iqdRate } = useIqdRate()

  const addUsd = parseFloat(amount) || 0

  const submit = async () => {
    setLoading(true)
    await topUpBalance(user.id, user.balance_usd ?? 0, addUsd, iqdRate, reason)
    notifyWhatsapp('', 'balance_added', { userId: user.id, amount: Math.round(addUsd * iqdRate), balance: Math.round(((user.balance_usd ?? 0) + addUsd) * iqdRate) })
    setLoading(false); onDone(); onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 380 }}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Add Balance · إضافة رصيد</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{user.full_name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Current Balance: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>${(user.balance_usd ?? 0).toFixed(2)}</span>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Amount (USD)</label>
          <input className={styles.input} type="number" step="1" placeholder="e.g. 50" value={amount} onChange={e => setAmount(e.target.value)} />
          {addUsd > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              ≈ {Math.round(addUsd * iqdRate).toLocaleString()} IQD (at {iqdRate.toLocaleString()} IQD/USD)
            </div>
          )}
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Reason · السبب</label>
          <select className={styles.input} value={reason} onChange={e => setReason(e.target.value)}>
            {TOP_UP_REASONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={submit} disabled={loading || !amount}>
          {loading ? <Spinner /> : 'Add Balance · إضافة الرصيد'}
        </button>
      </div>
    </div>
  )
}



// ── CreateAgentModal ──────────────────────────────────────────────────────────

const AGENT_COUNTRIES = ['USA', 'Turkey', 'UAE', 'China']
const COUNTRY_FLAGS_MAP: Record<string, string> = { USA: '🇺🇸', Turkey: '🇹🇷', UAE: '🇦🇪', China: '🇨🇳' }

function CreateAgentModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', country: 'USA' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = <K extends keyof typeof form>(k: K, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.name || !form.email || !form.password) { setError('Name, email and password are required'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    const session = await getSession()
    if (!session) { setError('Session expired — please sign in again'); setLoading(false); return }
    const res = await fetch('/api/create-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, access_token: session.access_token }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) { setError(data.error); return }
    onDone(); onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Create Agent · إنشاء وكيل</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        {error && <div className={styles.errorBox}>{error}</div>}
        <div className={styles.formGroup}>
          <label className={styles.label}>Full Name · الاسم الكامل</label>
          <input className={styles.input} value={form.name} onChange={e => handle('name', e.target.value)} placeholder="Agent full name" />
        </div>
        <div className={styles.grid2}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Email · البريد الإلكتروني</label>
            <input className={styles.input} type="email" value={form.email} onChange={e => handle('email', e.target.value)} placeholder="agent@example.com" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Phone · الهاتف</label>
            <input className={`${styles.input} phone-number`} dir="ltr" value={form.phone} onChange={e => handle('phone', e.target.value)} placeholder="+1..." />
          </div>
        </div>
        <div className={styles.grid2}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Password · كلمة المرور</label>
            <input className={styles.input} type="password" value={form.password} onChange={e => handle('password', e.target.value)} placeholder="Min 8 characters" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Assign Country · الدولة</label>
            <select className={styles.input} value={form.country} onChange={e => handle('country', e.target.value)}>
              {AGENT_COUNTRIES.map(c => (
                <option key={c} value={c}>{COUNTRY_FLAGS_MAP[c]} {c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={loading || !form.name || !form.email || !form.password}>
            {loading ? <Spinner /> : '+ Create Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const { language, t, setLanguage } = useLanguage()
  const [profile, setProfile]           = useState<Profile | null>(null)
  const [orders, setOrders]             = useState<Order[]>([])
  const [users, setUsers]               = useState<Profile[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [page, setPage]                 = useState('dashboard')
  const handlePageChange = useCallback((newPage: string) => { setPage(newPage); setSettingsOpen(false) }, [])
  const [loading, setLoading]           = useState(true)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [topUpUser, setTopUpUser]       = useState<Profile | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Profile | null>(null)
  const [filters, setFilters]           = useState<OrderFiltersState>(DEFAULT_FILTERS)
  const [toasts, setToasts]             = useState<Toast[]>([])
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [settingsOpen, setSettingsOpen]   = useState(false)
  const [showExport, setShowExport]       = useState(false)
  const [txnFilter, setTxnFilter]         = useState<'all' | 'topup' | 'deduction'>('all')
  const [showTopUp, setShowTopUp]         = useState(false)
  const [tierSettings, setTierSettings]   = useState<TierSettings[]>([])
  const [showTierSettings, setShowTierSettings] = useState(false)
  const [showCreateAgent, setShowCreateAgent] = useState(false)
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [wishlistOrderPrefill, setWishlistOrderPrefill] = useState<WishlistItem | null>(null)
  const fetchingPhotosRef = useRef<Set<string>>(new Set())
  // Search & bulk select (admin)
  const [adminSearch, setAdminSearch] = useState('')
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  // Delivery
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>([])
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  // Order notes unread counts
  const [noteUnreadCounts, setNoteUnreadCounts] = useState<Record<string, number>>({})
  // Live IQD/USD rate for balance ⇄ IQD conversion display
  const { rate: iqdRate } = useIqdRate()

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now()
    setToasts(p => [...p, { id, message, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }, [])

  const fetchData = useCallback(async () => {
    const session = await getSession()
    if (!session) { window.location.href = '/auth'; return }
    const prof = await getProfile(session.user.id)
    if (!prof) { setLoading(false); return }
    setProfile(prof)
    if (prof.language) setLanguage(prof.language)
    if (prof.role === 'admin') {
      const [allOrders, allUsers, delivReqs] = await Promise.all([getAdminOrders(), getCustomers(), getAdminDeliveryRequests()])
      setOrders(allOrders); setUsers(allUsers); setDeliveryRequests(delivReqs)
      getOrderUnreadCounts(allOrders.map(o => o.id), true).then(setNoteUnreadCounts)
    } else if (prof.role === 'customer') {
      const [myOrders, txns, wl, delivReqs] = await Promise.all([getUserOrders(session.user.id), getUserTransactions(session.user.id), getWishlist(session.user.id), getUserDeliveryRequests(session.user.id)])
      setOrders(myOrders); setTransactions(txns); setWishlist(wl); setDeliveryRequests(delivReqs)
      getOrderUnreadCounts(myOrders.map(o => o.id), false).then(setNoteUnreadCounts)
    }
    // agents: AgentDashboard fetches its own data
    if (prof.role !== 'agent') getTierSettings().then(setTierSettings)
    setLoading(false)
  }, [setLanguage])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    orders.forEach(o => {
      if (o.photo_url || fetchingPhotosRef.current.has(o.id) || !o.url) return
      fetchingPhotosRef.current.add(o.id)
      fetch('/api/product-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: o.url }),
      })
        .then(r => r.json())
        .then((data: { image_url: string | null }) => {
          if (data.image_url) {
            setOrders(prev => prev.map(ord => ord.id === o.id ? { ...ord, photo_url: data.image_url! } : ord))
            updateOrder(o.id, { photo_url: data.image_url })
          }
        })
        .catch(() => {})
        .finally(() => fetchingPhotosRef.current.delete(o.id))
    })
  }, [orders])

  const logout = useCallback(async () => {
    await signOut()
    router.push('/')
  }, [router])

  const haptic = useCallback((ms = 10) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') { setSelectedOrder(null); setShowNewOrder(false); setSettingsOpen(false) }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) { setShowNewOrder(true); setPage('orders') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Derived values — must stay above ALL early returns so hook count is stable ──
  const isAdmin = profile?.role === 'admin'
  const isAgent = profile?.role === 'agent'

  const pendingCount    = orders.filter(o => o.status === 'pending').length
  const calculatedCount = orders.filter(o => o.status === 'calculated').length

  const filteredOrders = useMemo(() => {
    let result = [...orders]
    if (filters.status !== 'all') result = result.filter(o => o.status === filters.status)
    if (filters.category !== 'All') result = result.filter(o => o.category === filters.category)
    if (filters.dateRange !== 'all') {
      const days = ({ '7d': 7, '30d': 30, '3m': 90 } as Record<string, number>)[filters.dateRange] ?? 0
      const cutoff = Date.now() - days * 86400000
      result = result.filter(o => new Date(o.created_at).getTime() >= cutoff)
    }
    if (isAdmin) {
      if (filters.dateFrom) result = result.filter(o => new Date(o.created_at).getTime() >= new Date(filters.dateFrom).getTime())
      if (filters.dateTo)   result = result.filter(o => new Date(o.created_at).getTime() <= new Date(filters.dateTo + 'T23:59:59').getTime())
      if (filters.country !== 'All') result = result.filter(o => detectOrderCountry(o.url) === filters.country)
      if (filters.customerSearch.trim()) {
        const q = filters.customerSearch.toLowerCase()
        result = result.filter(o => o.profiles?.full_name?.toLowerCase().includes(q))
      }
      if (filters.urgency === 'urgent') result = result.filter(o => o.urgency)
      if (filters.urgency === 'normal') result = result.filter(o => !o.urgency)
      // Quick search across ID, description, customer name, URL
      if (adminSearch.trim()) {
        const q = adminSearch.toLowerCase()
        result = result.filter(o =>
          o.id.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q) ||
          o.profiles?.full_name?.toLowerCase().includes(q) ||
          o.url?.toLowerCase().includes(q)
        )
      }
    }
    if (filters.sort === 'oldest')     result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (filters.sort === 'price-high') result.sort((a, b) => (b.shipping_price ?? 0) - (a.shipping_price ?? 0))
    else if (filters.sort === 'price-low')  result.sort((a, b) => (a.shipping_price ?? 0) - (b.shipping_price ?? 0))
    else result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return result
  }, [orders, filters, isAdmin, adminSearch])

  // ── Early returns (all hooks are above this line) ────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 0 260px', display: 'flex', flexDirection: 'column' }}>
      {/* Skeleton sidebar strip */}
      <div style={{ position: 'fixed', left: 0, top: 0, width: 260, height: '100vh', background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '28px 16px' }}>
        <div className="skeleton skeleton-title" style={{ width: 80, marginBottom: 32 }} />
        {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 12, width: `${60 + i * 8}%` }} />)}
      </div>
      {/* Skeleton main content */}
      <div style={{ padding: '32px', flex: 1 }}>
        <div style={{ marginBottom: 24 }}>
          <div className="skeleton skeleton-title" style={{ width: 140, marginBottom: 8 }} />
          <div className="skeleton skeleton-text" style={{ width: 200 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 24 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton-card" style={{ height: 90 }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, marginBottom: 12 }} />
              <div className="skeleton skeleton-text" style={{ width: '60%', marginBottom: 8 }} />
              <div className="skeleton skeleton-title" style={{ width: '40%' }} />
            </div>
          ))}
        </div>
        <div className="skeleton-card" style={{ height: 200 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 14, width: `${70 + i * 5}%` }} />)}
        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', fontSize: 13, color: 'var(--text-dim)' }}>
        Loading ShipIQ...
      </div>
    </div>
  )

  if (isAgent && profile) return <AgentDashboard profile={profile} onSignOut={logout} />

  const pendingDeliveryCount = deliveryRequests.filter(d => d.status === 'pending').length
  const activeDeliveryCount  = deliveryRequests.filter(d => d.status === 'out_for_delivery').length

  const navItems: NavItem[] = isAdmin
    ? [
        { id: 'admin-orders',     icon: '📋', label: t('nav', 'adminOrders'), badge: pendingCount },
        { id: 'admin-deliveries', icon: '🚚', label: 'Deliveries', badge: pendingDeliveryCount || undefined },
        { id: 'admin-analytics',  icon: '📊', label: 'Analytics' },
        { id: 'admin-customers',  icon: '👥', label: t('nav', 'customers') },
        { id: 'admin-broadcast',  icon: '📢', label: 'Broadcast' },
        { id: 'admin-settings',   icon: '⚙️', label: 'Settings' },
      ]
    : [
        { id: 'dashboard',  icon: '⊞',  label: t('nav', 'dashboard') },
        { id: 'shop',       icon: '🛍️', label: t('nav', 'shop') },
        { id: 'calculator', icon: '🧮', label: 'Calculator' },
        { id: 'wishlist',   icon: '❤️', label: 'Wishlist', badge: wishlist.length || undefined },
        { id: 'orders',     icon: '📦', label: t('nav', 'orders'), badge: calculatedCount },
        { id: 'balance',    icon: '💳', label: t('nav', 'balance') },
        { id: 'deliveries', icon: '🚚', label: 'Deliveries', badge: activeDeliveryCount || undefined },
      ]

  const pageTitle: Record<string, string> = {
    dashboard:          t('nav', 'dashboard'),
    shop:               t('nav', 'shop'),
    calculator:         '🧮 Calculator',
    wishlist:           '❤️ Wishlist',
    orders:             t('nav', 'orders'),
    balance:            t('nav', 'balance'),
    deliveries:         '🚚 My Deliveries',
    account:            isAdmin ? '🔧 Admin Account' : '👤 Account',
    'admin-orders':     t('nav', 'adminOrders'),
    'admin-deliveries': '🚚 Deliveries',
    'admin-analytics':  '📊 Analytics',
    'admin-customers':  t('nav', 'customers'),
    'admin-broadcast':  '📢 Broadcast',
    'admin-settings':   '⚙️ Settings',
  }

  return (
    <div className={styles.layout}>
      {sidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}
      <div className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <div className={styles.logoMark}>ShipIQ</div>
          <div className={`${styles.logoSub} ar`}>خدمة الشحن الذكي</div>
        </div>
        <div className={styles.sidebarNav}>
          <div className={styles.navSection}>{isAdmin ? t('nav', 'adminPanel') : t('nav', 'menu')}</div>
          {navItems.map(n => (
            <div key={n.id} className={`${styles.navItem} ${page === n.id ? styles.navActive : ''}`} onClick={() => { handlePageChange(n.id); setSidebarOpen(false) }}>
              <span>{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badge !== undefined && n.badge > 0 && <span className={styles.navBadge}>{n.badge}</span>}
            </div>
          ))}
        </div>
        <div className={styles.sidebarFooter}>
          <div className={styles.userCard} onClick={() => setSettingsOpen(true)}>
            <div className={styles.userAvatar}>{profile?.full_name?.[0] || '?'}</div>
            <div>
              <div className={styles.userName}>{profile?.full_name}</div>
              <div className={styles.userRole}>{isAdmin ? '🔧 Admin' : '👤 Customer'} · {t('nav', 'settings')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={styles.pageTitle}>{pageTitle[page]}</div>
          </div>
          <div className={styles.topbarActions}>
            <ThemeToggle />
            {profile && <NotificationCenter userId={profile.id} />}
            {!isAdmin && (
              <div
                className={styles.balanceChip}
                onClick={() => { setShowTopUp(true); haptic() }}
                title="Top up wallet"
                style={{ cursor: 'pointer' }}
                aria-label="Open wallet top-up"
              >
                <span>💳</span>
                <span>${(profile?.balance_usd ?? 0).toFixed(2)}</span>
                <span style={{ fontSize: 10, color: 'var(--gold-dim)', marginLeft: 2 }}>＋</span>
              </div>
            )}
          </div>
        </div>

        <ExchangeRateTicker />
        <div className={styles.body}>

          {page === 'dashboard' && (
            <div className="fade-up">
              <div className={styles.statsGrid}>
                {[
                  { label: t('dashboard', 'balance'),   value: `$${(profile?.balance_usd ?? 0).toFixed(2)}`, icon: '💳', color: '#c9a84c', bg: 'rgba(201,168,76,0.1)', sub: `≈ ${Math.round((profile?.balance_usd ?? 0) * iqdRate).toLocaleString()} IQD` },
                  { label: t('dashboard', 'pending'),   value: orders.filter(o => o.status === 'pending').length, icon: '⏳', color: '#e07b3a', bg: 'rgba(224,123,58,0.1)' },
                  { label: t('dashboard', 'calculated'),value: orders.filter(o => o.status === 'calculated').length, icon: '💰', color: '#5b9bd5', bg: 'rgba(91,155,213,0.1)' },
                  { label: t('dashboard', 'delivered'), value: orders.filter(o => o.status === 'delivered').length, icon: '📬', color: '#16a34a', bg: 'rgba(34,197,94,0.1)' },
                ].map((s, i) => (
                  <div key={i} className={styles.statCard} style={{ animationDelay: `${i * 80}ms` }}>
                    <div className={styles.statIcon} style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                    <div className={styles.statLabel}>{s.label}</div>
                    <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
                    {'sub' in s && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>{(s as { sub: string }).sub}</div>}
                  </div>
                ))}
              </div>
              {!isAdmin && (
                <TierBadge
                  tier={profile?.tier || 'bronze'}
                  totalSpent={profile?.total_spent || 0}
                  tiers={tierSettings.length > 0 ? tierSettings : FALLBACK_TIERS}
                  language={language as 'en' | 'ar'}
                />
              )}
              {!isAdmin && profile && !profile.delivery_lat && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  background: 'rgba(201,168,76,0.06)', border: '1px dashed rgba(201,168,76,0.3)',
                  borderRadius: 10, marginBottom: 14, cursor: 'pointer',
                }} onClick={() => handlePageChange('account')}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>📍</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>Set your delivery address</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Required for home delivery orders · اضغط لإضافة عنوانك</div>
                  </div>
                  <span style={{ color: 'var(--gold)', fontSize: 18 }}>›</span>
                </div>
              )}
              {!isAdmin && (() => {
                const pendingDelivReqs = deliveryRequests.filter(d => !['completed','cancelled'].includes(d.status))
                const unscheduled = orders.filter(o =>
                  o.status === 'arrived' &&
                  !pendingDelivReqs.some(d => d.order_ids.includes(o.id))
                )
                if (unscheduled.length === 0) return null
                return (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                      background: 'rgba(34,197,94,0.07)', border: '1.5px dashed rgba(34,197,94,0.35)',
                      borderRadius: 12, marginBottom: 14, cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onClick={() => setShowDeliveryModal(true)}
                  >
                    <span style={{ fontSize: 26, flexShrink: 0 }}>📦</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
                        {unscheduled.length} order{unscheduled.length > 1 ? 's' : ''} arrived in Iraq!
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                        Tap to schedule pickup or home delivery · اضغط لجدولة التوصيل
                      </div>
                    </div>
                    <span style={{ color: 'var(--green)', fontSize: 20, flexShrink: 0 }}>›</span>
                  </div>
                )
              })()}
              {calculatedCount > 0 && (
                <div className={styles.alertBox}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>💰 {calculatedCount} {calculatedCount > 1 ? t('dashboard', 'ordersReadyMany') : t('dashboard', 'ordersReady')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('dashboard', 'reviewConfirm')}</div>
                  </div>
                  <button className={styles.btnGhost} style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setPage('orders')}>{t('dashboard', 'view')}</button>
                </div>
              )}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{t('dashboard', 'recentOrders')}</span>
                  <button className={styles.btnGhost} style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setPage('orders')}>{t('dashboard', 'viewAll')}</button>
                </div>
                {orders.length === 0 ? (
                  <div className={styles.empty}>
                    <div className={styles.emptyIcon}>🚀</div>
                    <div className={styles.emptyTitle}>{t('dashboard', 'startTitle')}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{t('dashboard', 'startSub')}</div>
                    <button className={styles.btnPrimary} style={{ marginTop: 16 }} onClick={() => { setPage('orders'); setShowNewOrder(true) }}>{t('dashboard', 'newOrder')}</button>
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead><tr><th style={{ width: 56 }}></th><th className={styles.mobileHide}>ID</th><th>Description</th><th className={styles.mobileHide}>Date</th><th>Status</th></tr></thead>
                    <tbody>
                      {orders.slice(0, 5).map(o => (
                        <tr key={o.id} onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 18, position: 'relative', color: '#888' }}>
                              <span style={{ position: 'absolute' }}>🛍️</span>
                              {o.photo_url && (
                                <img src={o.photo_url} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                              )}
                            </div>
                          </td>
                          <td className={`${styles.tdMain} ${styles.mobileHide}`}>{o.id}</td>
                          <td>{o.description}</td>
                          <td className={styles.mobileHide}>{o.created_at?.split('T')[0]}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                              <Badge status={o.status} />
                              {(noteUnreadCounts[o.id] || 0) > 0 && (
                                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700, background: 'rgba(91,155,213,0.12)', color: 'var(--blue)', border: '1px solid rgba(91,155,213,0.28)' }}>
                                  💬 {noteUnreadCounts[o.id]}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === 'shop' && (
            <div className="fade-up">
              <div className={styles.pageHeader}>
                <div>
                  <div className={styles.pageHeading}>{t('shop', 'title')}</div>
                  <div className={styles.pageSub}>{t('shop', 'sub')}</div>
                </div>
              </div>
              <ShopSection
                userId={profile?.id}
                onWishlistSave={profile ? async (url: string) => {
                  await addToWishlist(profile.id, { url })
                  const wl = await getWishlist(profile.id)
                  setWishlist(wl)
                  toast('Saved to wishlist! · تم الحفظ', 'success')
                } : undefined}
              />
            </div>
          )}

          {page === 'calculator' && !isAdmin && (
            <div className="fade-up">
              <ShippingCalculator />
            </div>
          )}

          {page === 'wishlist' && !isAdmin && profile && (
            <div className="fade-up">
              <WishlistPage
                items={wishlist}
                onOrderNow={item => { setWishlistOrderPrefill(item); setShowNewOrder(true) }}
                onRemove={id => setWishlist(prev => prev.filter(w => w.id !== id))}
                onRefresh={() => getWishlist(profile.id).then(setWishlist)}
              />
            </div>
          )}

          {(page === 'orders' || page === 'admin-orders') && (
            <div className="fade-up">
              {page === 'orders' && (
                <div className={styles.pageHeader}>
                  <div>
                    <div className={styles.pageHeading}>{t('orders', 'title')}</div>
                  </div>
                </div>
              )}
              {page === 'admin-orders' && (
                <div className={styles.pageHeader}>
                  <div>
                    <div className={styles.pageHeading}>{t('adminOrders', 'title')}</div>
                    <div className={styles.pageSub}>{t('adminOrders', 'sub')}</div>
                  </div>
                  <button className={styles.btnGhost} onClick={() => setShowExport(true)} aria-label="Export orders">{t('adminOrders', 'export')}</button>
                </div>
              )}
              {isAdmin && (
                <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-dim)', pointerEvents: 'none' }}>🔍</span>
                    <input
                      placeholder="Search by order ID, customer, description, URL..."
                      value={adminSearch}
                      onChange={e => setAdminSearch(e.target.value)}
                      aria-label="Search orders"
                      style={{
                        width: '100%', padding: '9px 12px 9px 36px', fontSize: 13,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 8, color: 'var(--text)', outline: 'none',
                      }}
                    />
                    {adminSearch && (
                      <button onClick={() => setAdminSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 14 }}>✕</button>
                    )}
                  </div>
                  {selectedOrderIds.size > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{selectedOrderIds.size} selected</span>
                      <select
                        value={bulkStatus}
                        onChange={e => setBulkStatus(e.target.value)}
                        aria-label="Bulk status update"
                        style={{ fontSize: 12, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', outline: 'none' }}
                      >
                        <option value="">Change status to...</option>
                        {(['pending','calculated','confirmed','ordered','warehouse','transit','arrived','delivered','rejected'] as const).map(s => (
                          <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
                        ))}
                      </select>
                      <button
                        disabled={!bulkStatus || bulkLoading}
                        onClick={async () => {
                          if (!bulkStatus) return
                          setBulkLoading(true)
                          const ids = Array.from(selectedOrderIds)
                          await Promise.all(ids.map(id => updateOrder(id, { status: bulkStatus })))
                          const bulkEvent = STATUS_EVENT[bulkStatus]
                          if (bulkEvent) ids.forEach(id => notifyWhatsapp(id, bulkEvent))
                          setSelectedOrderIds(new Set()); setBulkStatus('')
                          setBulkLoading(false); fetchData()
                        }}
                        style={{
                          fontSize: 12, padding: '6px 14px', borderRadius: 7, cursor: bulkLoading ? 'not-allowed' : 'pointer',
                          background: bulkStatus ? 'var(--gold)' : 'var(--surface)', color: bulkStatus ? 'var(--bg)' : 'var(--text-dim)',
                          border: '1px solid var(--border)', fontWeight: 700, opacity: bulkLoading ? 0.6 : 1,
                        }}
                      >
                        {bulkLoading ? '...' : 'Apply'}
                      </button>
                      <button onClick={() => setSelectedOrderIds(new Set())} aria-label="Clear selection" style={{ fontSize: 11, padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-dim)' }}>✕</button>
                    </div>
                  )}
                </div>
              )}
              <OrderFilters isAdmin={isAdmin} value={filters} onChange={setFilters} />
              <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                {filteredOrders.length === 0 ? (
                  <div className={styles.empty}>
                    <div className={styles.emptyIcon}>📬</div>
                    <div className={styles.emptyTitle}>{t('orders', 'noOrders')}</div>
                    {page === 'orders' && orders.length === 0 && (
                      <button className={styles.btnPrimary} style={{ marginTop: 16 }} onClick={() => setShowNewOrder(true)}>{t('orders', 'submitFirst')}</button>
                    )}
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead><tr>
                        {isAdmin && (
                          <th style={{ width: 36, padding: '0 8px' }}>
                            <input
                              type="checkbox"
                              aria-label="Select all orders"
                              checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
                              onChange={e => setSelectedOrderIds(e.target.checked ? new Set(filteredOrders.map(o => o.id)) : new Set())}
                              style={{ cursor: 'pointer', accentColor: 'var(--gold)' }}
                            />
                          </th>
                        )}
                        <th style={{ width: 56 }}></th>
                        <th className={styles.mobileHide}>{t('orders', 'id')}</th>
                        {isAdmin && <th>{t('orders', 'customer')}</th>}
                        <th>{t('orders', 'description')}</th><th className={styles.mobileHide}>{t('orders', 'itemPrice')}</th><th className={styles.mobileHide}>{t('orders', 'shipping')}</th><th className={styles.mobileHide}>{t('orders', 'date')}</th><th>{t('orders', 'status')}</th>
                      </tr></thead>
                      <tbody>
                        {filteredOrders.map(o => (
                          <tr key={o.id} onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer', background: selectedOrderIds.has(o.id) ? 'rgba(201,168,76,0.04)' : undefined }}>
                            {isAdmin && (
                              <td style={{ padding: '0 8px' }} onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  aria-label={`Select order ${o.id}`}
                                  checked={selectedOrderIds.has(o.id)}
                                  onChange={e => {
                                    const next = new Set(selectedOrderIds)
                                    if (e.target.checked) next.add(o.id); else next.delete(o.id)
                                    setSelectedOrderIds(next)
                                  }}
                                  style={{ cursor: 'pointer', accentColor: 'var(--gold)' }}
                                />
                              </td>
                            )}
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 18, position: 'relative', color: '#888' }}>
                                <span style={{ position: 'absolute' }}>🛍️</span>
                                {o.photo_url && (
                                  <img src={o.photo_url} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                                )}
                              </div>
                            </td>
                            <td className={`${styles.tdMain} ${styles.mobileHide}`}>{o.id}</td>
                            {isAdmin && (
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div className={styles.userAvatar} style={{ width: 26, height: 26, fontSize: 11, flexShrink: 0 }}>
                                    {(o.profiles?.full_name?.[0] || '?').toUpperCase()}
                                  </div>
                                  <span>{o.profiles?.full_name || '—'}</span>
                                </div>
                              </td>
                            )}
                            <td>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13, marginBottom: 3 }}>{o.description}</div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>{o.category}</span>
                                  {o.urgency && <span style={{ fontSize: 10, color: 'var(--orange)' }}>⚡ Urgent</span>}
                                </div>
                              </div>
                            </td>
                            <td className={styles.mobileHide}>{o.item_price ? `${o.item_price} ${o.item_price_currency}` : '—'}</td>
                            <td className={styles.mobileHide} style={{ color: o.shipping_price ? 'var(--gold)' : 'var(--text-dim)', fontWeight: o.shipping_price ? 700 : 400 }}>
                              {o.shipping_price ? (o.shipping_currency === 'IQD' ? `$${(o.shipping_price / IQD_PER_USD).toFixed(2)}` : `${o.shipping_price.toLocaleString()} ${o.shipping_currency}`) : '—'}
                            </td>
                            <td className={styles.mobileHide}>{o.created_at?.split('T')[0]}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Badge status={o.status} />
                                {(noteUnreadCounts[o.id] || 0) > 0 && (
                                  <span
                                    title={`${noteUnreadCounts[o.id]} unread message${noteUnreadCounts[o.id] > 1 ? 's' : ''}`}
                                    style={{
                                      fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700,
                                      background: 'rgba(91,155,213,0.12)', color: 'var(--blue)',
                                      border: '1px solid rgba(91,155,213,0.28)',
                                      display: 'inline-flex', alignItems: 'center', gap: 2,
                                    }}
                                  >
                                    💬 {noteUnreadCounts[o.id]}
                                  </span>
                                )}
                                {isAdmin && ['confirmed','ordered','warehouse','transit','arrived','delivered'].includes(o.status) && (
                                  <span
                                    style={{
                                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                      background: o.status === 'confirmed' ? '#555'
                                        : o.status === 'ordered' ? 'var(--orange)'
                                        : 'var(--green)',
                                    }}
                                    title={o.status === 'confirmed' ? 'Agent: not ordered yet'
                                      : o.status === 'ordered' ? 'Agent: order placed'
                                      : 'Agent: at warehouse or beyond'}
                                  />
                                )}
                                {o.status === 'pending' && (
                                  <button className={styles.processBadge} onClick={e => { e.stopPropagation(); setSelectedOrder(o) }}>{t('orders', 'process')}</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === 'balance' && (
            <div className="fade-up">
              <div className={styles.pageHeader}>
                <div><div className={styles.pageHeading}>{t('balance', 'title')}</div></div>
                <button
                  className={styles.btnPrimary}
                  style={{ fontSize: 15, padding: '11px 24px', gap: 10 }}
                  onClick={() => setShowTopUp(true)}
                >
                  💳 Top Up · شحن الرصيد
                </button>
              </div>
              <div className={styles.infoBox} style={{ marginBottom: 20 }}>
                ℹ️ Your balance is managed by ShipIQ admin. Shipping fees are deducted manually after your order is confirmed.
              </div>
              <div className={styles.grid2} style={{ marginBottom: 24 }}>
                <div className={styles.card} style={{ textAlign: 'center', padding: '36px 24px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('balance', 'available')}</div>
                  <span className={styles.priceBig}>${(profile?.balance_usd ?? 0).toFixed(2)}</span>
                  <span className={styles.priceCurrency}>USD</span>
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-dim)' }}>≈ {Math.round((profile?.balance_usd ?? 0) * iqdRate).toLocaleString()} IQD (at current rate)</div>
                  <button
                    className={styles.btnPrimary}
                    style={{ width: '100%', marginTop: 20, fontSize: 14 }}
                    onClick={() => setShowTopUp(true)}
                  >
                    ⚡ Top Up Wallet · شحن المحفظة
                  </button>
                </div>
                <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(37,211,102,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💬</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('balance', 'topUp')}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('balance', 'topUpSub')}</div>
                    </div>
                  </div>
                  <a className={styles.btnWhatsApp} href="https://wa.me/964XXXXXXXXXX" target="_blank" rel="noopener noreferrer">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.1 21.9l4.837-1.316A9.956 9.956 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.956 7.956 0 0 1-4.099-1.132l-.293-.174-3.044.828.852-3.004-.192-.31A7.953 7.953 0 0 1 4 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/>
                    </svg>
                    {t('balance', 'whatsapp')}
                  </a>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
                    <span className="phone-number" dir="ltr">+964 XXX XXX XXXX</span> · {t('balance', 'hours')}
                  </div>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{t('balance', 'history')}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['all', 'topup', 'deduction'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setTxnFilter(f)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                          background: txnFilter === f ? 'rgba(201,168,76,0.15)' : 'transparent',
                          color: txnFilter === f ? 'var(--gold)' : 'var(--text-dim)',
                          border: txnFilter === f ? '1px solid rgba(201,168,76,0.35)' : '1px solid transparent',
                        }}
                      >
                        {f === 'all' ? 'All' : f === 'topup' ? '↑ Top-ups' : '↓ Deductions'}
                      </button>
                    ))}
                  </div>
                </div>
                {transactions.length === 0 ? (
                  <div className={styles.empty}>
                    <div className={styles.emptyIcon}>💸</div>
                    <div className={styles.emptyTitle}>{t('balance', 'noTxns')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, maxWidth: 280 }}>{t('balance', 'noTxnsSub')}</div>
                  </div>
                ) : (() => {
                  // USD amount per txn (fallback for legacy IQD-only rows)
                  const txnUsd = (txn: Transaction) => txn.amount_usd ?? (txn.amount / iqdRate)
                  // Compute running balance (transactions newest-first, so walk forward = subtract going back)
                  let runBal = profile?.balance_usd ?? 0
                  const withBal = transactions.map(txn => {
                    const after = runBal
                    runBal = Math.round((runBal - txnUsd(txn)) * 100) / 100
                    return { ...txn, afterBalance: after, usd: txnUsd(txn) }
                  })
                  const filtered = withBal.filter(txn => {
                    if (txnFilter === 'topup') return txn.usd > 0
                    if (txnFilter === 'deduction') return txn.usd < 0
                    return true
                  })
                  const getIcon = (note: string) => {
                    if (/fib/i.test(note)) return '🏦'
                    if (/qi\s*card/i.test(note)) return '💳'
                    if (/cash/i.test(note)) return '💵'
                    if (/promo/i.test(note)) return '🎁'
                    if (/adjust|correct/i.test(note)) return '⚙️'
                    if (/shipping|confirmed/i.test(note)) return '📦'
                    return '💰'
                  }
                  if (filtered.length === 0) return (
                    <div className={styles.empty} style={{ padding: '32px 20px' }}>
                      <div className={styles.emptyTitle} style={{ fontSize: 13 }}>No {txnFilter === 'topup' ? 'top-up' : 'deduction'} transactions yet</div>
                    </div>
                  )
                  return (
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ width: 36 }}></th>
                            <th className={styles.mobileHide}>Date · التاريخ</th>
                            <th>Description · الوصف</th>
                            <th>Amount · المبلغ</th>
                            <th className={styles.mobileHide}>Balance · الرصيد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(txn => (
                            <tr key={txn.id}>
                              <td style={{ textAlign: 'center', fontSize: 16 }}>
                                {getIcon(txn.note || '')}
                              </td>
                              <td className={styles.mobileHide} style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)', fontSize: 12 }}>
                                {txn.created_at?.split('T')[0]}
                              </td>
                              <td style={{ maxWidth: 200 }}>
                                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {txn.note || '—'}
                                </div>
                                {txn.order_id && (
                                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                                    {txn.order_id}
                                  </div>
                                )}
                              </td>
                              <td style={{ whiteSpace: 'nowrap', fontWeight: 700, color: txn.usd > 0 ? 'var(--green)' : 'var(--red)' }}>
                                {txn.usd > 0 ? '+' : '−'}${Math.abs(txn.usd).toFixed(2)}
                              </td>
                              <td className={styles.mobileHide} style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 13 }}>
                                ${txn.afterBalance.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {page === 'deliveries' && !isAdmin && profile && (
            <div className="fade-up">
              <div className={styles.pageHeader}>
                <div>
                  <div className={styles.pageHeading}>🚚 My Deliveries · توصيلاتي</div>
                  <div className={styles.pageSub}>Track your delivery requests from warehouse to door</div>
                </div>
                {(() => {
                  const pendingDelivReqs = deliveryRequests.filter(d => !['completed','cancelled'].includes(d.status))
                  const hasUnscheduled = orders.some(o => o.status === 'arrived' && !pendingDelivReqs.some(d => d.order_ids.includes(o.id)))
                  return hasUnscheduled ? (
                    <button className={styles.btnPrimary} onClick={() => setShowDeliveryModal(true)}>📦 New Request</button>
                  ) : null
                })()}
              </div>
              {deliveryRequests.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>🚚</div>
                  <div className={styles.emptyTitle}>No delivery requests yet</div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>When your orders arrive, come here to schedule delivery</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {deliveryRequests.map(req => {
                    const statusCfg = ({
                      pending:          { label: 'Pending',          color: 'var(--orange)', icon: '⏳' },
                      scheduled:        { label: 'Scheduled',        color: 'var(--blue)',   icon: '📅' },
                      out_for_delivery: { label: 'Out for Delivery', color: 'var(--gold)',   icon: '🚗' },
                      completed:        { label: 'Delivered',        color: 'var(--green)',  icon: '✅' },
                      cancelled:        { label: 'Cancelled',        color: '#ef4444',       icon: '✕'  },
                    } as Record<string, { label: string; color: string; icon: string }>)[req.status] ?? { label: req.status, color: 'var(--text-dim)', icon: '?' }
                    const typeLabel = ({ pickup: '🏢 Pickup from office', home_erbil: '🚗 Home delivery — Erbil', home_baghdad: '🚗 Home delivery — Baghdad' } as Record<string, string>)[req.delivery_preference] ?? req.delivery_preference
                    return (
                      <div key={req.id} className={styles.card} style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{req.id}</div>
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                            background: `color-mix(in srgb, ${statusCfg.color} 12%, transparent)`,
                            color: statusCfg.color, border: `1px solid color-mix(in srgb, ${statusCfg.color} 35%, transparent)`,
                          }}>
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>Orders</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                              {req.order_ids.map((id, i) => <div key={i} style={{ fontFamily: 'monospace' }}>{id}</div>)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>Type</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{typeLabel}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>Fee</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: req.delivery_fee > 0 ? 'var(--gold)' : 'var(--green)' }}>
                              {req.delivery_fee > 0 ? `$${(req.delivery_fee / IQD_PER_USD).toFixed(2)}` : 'Free'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>Requested</div>
                            <div style={{ fontSize: 13, color: 'var(--text)' }}>{req.created_at?.split('T')[0]}</div>
                          </div>
                        </div>
                        {req.delivery_address && (
                          <div style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                            📍 {req.delivery_address}
                          </div>
                        )}
                        {req.delivery_notes && (
                          <div style={{ marginTop: 8, padding: '7px 12px', background: 'rgba(91,155,213,0.06)', border: '1px solid rgba(91,155,213,0.2)', borderRadius: 7, fontSize: 12, color: 'var(--text-muted)' }}>
                            📝 {req.delivery_notes}
                          </div>
                        )}
                        {req.scheduled_at && (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                            📅 Scheduled: {new Date(req.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                        {req.completed_at && (
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                            ✅ Delivered on {new Date(req.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {page === 'account' && profile && (
            <div className="fade-up">
              {isAdmin ? (
                <AdminMobileAccount
                  profile={profile}
                  orders={orders}
                  users={users}
                  pendingCount={pendingCount}
                  onNavigate={handlePageChange}
                  onShowSettings={() => setShowTierSettings(true)}
                  onSignOut={logout}
                />
              ) : (
                <AccountSettings
                  profile={profile}
                  orders={orders}
                  mode="page"
                  onClose={() => handlePageChange('dashboard')}
                  onProfileUpdate={updated => setProfile(p => p ? { ...p, ...updated } : p)}
                  onSignOut={logout}
                />
              )}
            </div>
          )}

          {page === 'admin-analytics' && (
            <div className="fade-up">
              <AdminAnalytics />
            </div>
          )}

          {page === 'admin-deliveries' && isAdmin && (
            <div className="fade-up">
              <AdminDeliveries onToast={toast} />
            </div>
          )}

          {page === 'admin-settings' && isAdmin && (
            <div className="fade-up">
              <AdminSettings />
            </div>
          )}

          {page === 'admin-broadcast' && isAdmin && (
            <div className="fade-up">
              <AdminBroadcast />
            </div>
          )}

          {page === 'admin-customers' && (
            <div className="fade-up">
              <div className={styles.pageHeader}>
                <div><div className={styles.pageHeading}>{t('customers', 'title')}</div><div className={styles.pageSub}>{t('customers', 'sub')}</div></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={styles.btnGhost} style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setShowTierSettings(true)}>⚙️ Tiers</button>
                  <button className={styles.btnPrimary} style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setShowCreateAgent(true)}>+ Create Agent</button>
                </div>
              </div>
              <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                {users.length === 0 ? (
                  <div className={styles.empty}><div className={styles.emptyIcon}>👥</div><div className={styles.emptyTitle}>{t('customers', 'noCustomers')}</div></div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead><tr>
                        <th>{t('customers', 'name')}</th>
                        <th>Tier</th>
                        <th>{t('customers', 'email')}</th>
                        <th>{t('customers', 'phone')}</th>
                        <th>Total Spent</th>
                        <th>{t('customers', 'balance')}</th>
                        <th>{t('customers', 'joined')}</th>
                        <th>{t('customers', 'actions')}</th>
                      </tr></thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} onClick={() => setSelectedCustomer(u)} style={{ cursor: 'pointer' }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className={styles.userAvatar} style={{ width: 30, height: 30, fontSize: 12, border: u.is_suspended ? '2px solid var(--red)' : undefined }}>{u.full_name?.[0]}</div>
                                <div>
                                  <span className={styles.tdMain}>{u.full_name}</span>
                                  {u.is_suspended && <span style={{ fontSize: 10, color: 'var(--red)', marginLeft: 6 }}>Suspended</span>}
                                </div>
                              </div>
                            </td>
                            <td>
                              {tierSettings.length > 0 && (
                                <TierBadge
                                  tier={u.tier || 'bronze'}
                                  totalSpent={u.total_spent || 0}
                                  tiers={tierSettings}
                                  compact
                                />
                              )}
                            </td>
                            <td><span className="phone-number">{u.email}</span></td>
                            <td><span className="phone-number">{displayPhone(u.phone, '—')}</span></td>
                            <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                              ${(u.total_spent || 0).toFixed(2)}
                            </td>
                            <td style={{ color: 'var(--gold)', fontWeight: 700 }}>${(u.balance_usd ?? 0).toFixed(2)}</td>
                            <td>{u.created_at?.split('T')[0]}</td>
                            <td onClick={e => e.stopPropagation()}>
                              <button className={styles.btnGhost} style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setTopUpUser(u)}>{t('customers', 'addBalance')}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Mobile bottom navigation — admin */}
      {isAdmin && (
        <nav className={styles.bottomNav}>
          {[
            { id: 'admin-orders',     icon: '📋', label: 'Orders',     badge: pendingCount },
            { id: 'admin-deliveries', icon: '🚚', label: 'Deliveries', badge: pendingDeliveryCount || undefined },
            { id: 'admin-customers',  icon: '👥', label: 'Customers' },
            { id: 'admin-analytics',  icon: '📊', label: 'Analytics' },
            { id: 'admin-broadcast',  icon: '📢', label: 'Broadcast' },
          ].map(n => (
            <button
              key={n.id}
              className={`${styles.bottomNavItem} ${page === n.id ? styles.bottomNavActive : ''}`}
              onClick={() => handlePageChange(n.id)}
              style={{ position: 'relative' }}
            >
              {n.badge !== undefined && n.badge > 0 && (
                <span className={styles.bottomNavBadge}>{n.badge}</span>
              )}
              <span className={styles.bottomNavIcon}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
          <button
            className={`${styles.bottomNavItem} ${page === 'account' ? styles.bottomNavActive : ''}`}
            onClick={() => handlePageChange('account')}
          >
            <span className={styles.bottomNavIcon}>👤</span>
            <span>Account</span>
          </button>
        </nav>
      )}

      {/* Mobile bottom navigation — customers only */}
      {!isAdmin && !isAgent && (
        <nav className={styles.bottomNav}>
          {[
            { id: 'dashboard',  icon: '⊞',  label: 'Home' },
            { id: 'shop',       icon: '🛍️', label: 'Shop' },
            { id: 'wishlist',   icon: '❤️', label: 'Saved', badge: wishlist.length || undefined },
            { id: 'orders',     icon: '📦', label: 'Orders', badge: calculatedCount },
            { id: 'balance',    icon: '💳', label: 'Balance' },
          ].map(n => (
            <button
              key={n.id}
              className={`${styles.bottomNavItem} ${page === n.id ? styles.bottomNavActive : ''}`}
              onClick={() => handlePageChange(n.id)}
              style={{ position: 'relative' }}
            >
              {n.badge !== undefined && n.badge > 0 && (
                <span className={styles.bottomNavBadge}>{n.badge}</span>
              )}
              <span className={styles.bottomNavIcon}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
          <button
            className={`${styles.bottomNavItem} ${page === 'account' ? styles.bottomNavActive : ''}`}
            onClick={() => handlePageChange('account')}
          >
            <span className={styles.bottomNavIcon}>👤</span>
            <span>Account</span>
          </button>
        </nav>
      )}

      {showDeliveryModal && profile && !isAdmin && (
        <DeliveryRequestModal
          profile={profile}
          arrivedOrders={orders.filter(o => {
            if (o.status !== 'arrived') return false
            const active = deliveryRequests.filter(d => !['completed','cancelled'].includes(d.status))
            return !active.some(d => d.order_ids.includes(o.id))
          })}
          onClose={() => setShowDeliveryModal(false)}
          onDone={() => { fetchData(); toast('Delivery request submitted! · تم إرسال طلب التوصيل') }}
        />
      )}
      {showNewOrder && profile && (
        <SubmitOrderModal
          userId={profile.id}
          onClose={() => { setShowNewOrder(false); setWishlistOrderPrefill(null) }}
          onDone={() => { fetchData(); toast('Order submitted! · تم إرسال الطلب') }}
          prefill={wishlistOrderPrefill ? { url: wishlistOrderPrefill.url, description: wishlistOrderPrefill.description, note: wishlistOrderPrefill.notes, photo_url: wishlistOrderPrefill.photo_url } : undefined}
          onWishlistSave={async (data) => {
            const { error } = await addToWishlist(profile.id, data)
            if (!error) { const wl = await getWishlist(profile.id); setWishlist(wl); toast('Saved to wishlist!') }
          }}
        />
      )}
      {showTopUp && profile && <WalletTopUp userId={profile.id} open={true} onClose={() => setShowTopUp(false)} onSuccess={() => { fetchData(); toast('Top-up request sent! · تم إرسال طلب الشحن') }} />}
      {selectedOrder && <OrderDetailModal order={selectedOrder} isAdmin={isAdmin} adminName={isAdmin ? (profile?.full_name || 'Admin') : undefined} currentUserId={profile?.id || ''} onClose={() => setSelectedOrder(null)} onRefresh={() => { fetchData(); toast('Order updated!') }} onNotesRead={() => setNoteUnreadCounts(prev => ({ ...prev, [selectedOrder.id]: 0 }))} />}
      {topUpUser && <TopUpModal user={topUpUser} onClose={() => setTopUpUser(null)} onDone={() => { fetchData(); toast('Balance added! · تمت إضافة الرصيد') }} />}
      {selectedCustomer && isAdmin && profile && (
        <AdminCustomerProfile
          customer={selectedCustomer}
          tierSettings={tierSettings.length > 0 ? tierSettings : FALLBACK_TIERS}
          onClose={() => setSelectedCustomer(null)}
          onToast={toast}
          onRefresh={fetchData}
          currentAdminId={profile.id}
        />
      )}
      {showExport && isAdmin && <AdminExport orders={orders} onClose={() => setShowExport(false)} />}
      {showTierSettings && isAdmin && <AdminTierSettings onClose={() => { setShowTierSettings(false); getTierSettings().then(setTierSettings) }} />}
      {showCreateAgent && isAdmin && <CreateAgentModal onClose={() => setShowCreateAgent(false)} onDone={() => { toast('Agent created!') }} />}
      <Toast toasts={toasts} />
      {settingsOpen && profile && (
        <AccountSettings
          profile={profile}
          orders={orders}
          onClose={() => setSettingsOpen(false)}
          onProfileUpdate={updated => setProfile(p => p ? { ...p, ...updated } : p)}
          onSignOut={logout}
        />
      )}
    </div>
  )
}
