'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Store, ScrapeResult } from '@/lib/types'
import { STORES, SUPPORTED_SITES } from '@/lib/constants'
import { getPricingConfig } from '@/lib/api'
import {
  calculatePricing, defaultConfig, ORIGIN_COUNTRIES,
  type CountryPricingConfig, type OriginCountry, type PricingCategory,
} from '@/lib/pricing'
import styles from './ShopSection.module.css'
import DealsSection from './DealsSection'
import TrendyolWeightEstimator from './TrendyolWeightEstimator'

// FX for converting a scraped price into the engine's config currency (USD).
const FALLBACK_FX = { iqd: 1540, EUR: 0.92, GBP: 0.79, TRY: 32.5, AED: 3.67 }
type FxRates = typeof FALLBACK_FX

function toUsd(price: number, currency: string, fx: FxRates): number {
  switch ((currency || 'USD').toUpperCase()) {
    case 'USD': return price
    case 'EUR': return price / fx.EUR
    case 'GBP': return price / fx.GBP
    case 'TRY': return price / fx.TRY
    case 'AED': return price / fx.AED
    default:    return price
  }
}

// Store-catalogue category (Electronics/Beauty/Shoes/…) → pricing-engine bucket.
function mapStoreCategory(cat?: string | null): PricingCategory {
  switch ((cat || '').toLowerCase()) {
    case 'electronics':
    case 'gaming':    return 'electronics'
    case 'clothing':
    case 'shoes':     return 'clothing'
    case 'beauty':
    case 'cosmetics': return 'cosmetics'
    case 'watches':   return 'accessories'
    default:          return 'uncategorized'   // Home, Sports, etc.
  }
}

// Prefer the scrape's product-derived category; fall back to the displayed store
// category when the scrape couldn't classify the item — otherwise per-category
// customs/shipping silently fall to the $0 "uncategorized" default.
function resolvePricingCategory(scrapeMapped?: string | null, storeCategory?: string | null): PricingCategory {
  if (scrapeMapped && scrapeMapped !== 'uncategorized') return scrapeMapped as PricingCategory
  return mapStoreCategory(storeCategory)
}

// ── Brand logo: Clearbit → gstatic → emoji ───────────────────────────────────

function StoreLogo({
  domain, emoji, size = 56, emojiClass,
}: {
  domain: string; emoji: string; size?: number; emojiClass?: string
}) {
  const [imgSrc, setImgSrc] = useState(
    `https://logo.clearbit.com/${domain}?size=80`
  )
  const [failed, setFailed] = useState(false)

  if (failed) return <div className={emojiClass ?? styles.storeEmoji}>{emoji}</div>

  return (
    <img
      src={imgSrc}
      alt=""
      width={56}
      height={56}
      loading="lazy"
      decoding="async"
      className={styles.storeLogo}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        padding: 8,
        background: 'white',
        borderRadius: 12,
      }}
      onError={() => {
        if (imgSrc.includes('clearbit.com')) {
          setImgSrc(`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`)
        } else {
          setFailed(true)
        }
      }}
    />
  )
}

// ── Card logo: Supabase storage (explicit filename map → name text) ───────────

const LOGO_BASE = 'https://pzlckjasayitxcblvkjg.supabase.co/storage/v1/object/public/store-logos'

const LOGO_FILES: Record<string, string> = {
  'amazon.com': 'Amazon.svg',
  'amazon.ae': 'Amazon (1).svg',
  'ebay.com': 'eBay.svg',
  'bhphotovideo.com': 'bhphotovideo.svg',
  'bestbuy.com': 'Bestbuy.svg',
  'newegg.com': 'Newegg.svg',
  'walmart.com': 'walmart.svg',
  'target.com': 'target.svg',
  'macys.com': 'Macys.svg',
  'nike.com': 'nike.svg',
  'adidas.com': 'Adidas.svg',
  'sephora.com': 'Sephora.svg',
  'iherb.com': 'iHerb.svg',
  'colehaan.com': 'Colehaan.svg',
  'nordstrom.com': 'Nordstorm.svg',
  'jomashop.com': 'jomashop.svg',
  'skechers.com': 'Skechers.svg',
  'lyst.com': 'Lyst.svg',
  'guess.com': 'Guess.svg',
  'michaelkors.com': 'Michaelkors.svg',
  'noon.com': 'Noon.svg',
  'namshi.com': 'Namshi.svg',
  'sharafdg.com': 'sharafdg.svg',
  'brandsforless.ae': 'Brandsforless.svg',
  'boutiqaat.com': 'boutiqaat.svg',
  'trendyol.com': 'trendyol.svg',
  'hepsiburada.com': 'Hepsiburada.svg',
  'n11.com': 'N11.svg',
  'lcwaikiki.com': 'lcwaikiki.svg',
  'mavi.com': 'mavi.svg',
  'aliexpress.com': 'Aliexpress.svg',
  'shein.com': 'shein.svg',
  'banggood.com': 'banggood.svg',
  'dhgate.com': 'Dhgate.svg',
  'zaful.com': 'zaful.svg',
}

function getLogoUrl(domain: string): string | null {
  const filename = LOGO_FILES[domain.toLowerCase()]
  if (!filename) return null
  return `${LOGO_BASE}/${encodeURIComponent(filename)}`
}

function CardLogo({ domain, name }: { domain: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const url = getLogoUrl(domain)

  if (!url || failed) return <div className={styles.storeLogoText}>{name}</div>

  return (
    <img
      src={url}
      alt={name}
      width={130}
      height={44}
      loading="lazy"
      decoding="async"
      className={styles.storeLogoImg}
      onError={() => setFailed(true)}
    />
  )
}

// Flag-only country filter (matches Store.country ids)
const COUNTRY_FLAGS = [
  { id: 'All',    label: 'All' },
  { id: 'US',     label: '🇺🇸' },
  { id: 'UAE',    label: '🇦🇪' },
  { id: 'Turkey', label: '🇹🇷' },
  { id: 'China',  label: '🇨🇳' },
]

// Returns a dark-safe button background (guards against near-white brand colours)
function safeBg(hex: string): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#555555' : hex
}

// ── EngineEstimate ─ full breakdown from the shared pricing engine ─────────────
// Uses the SAME engine (lib/pricing.ts) as the website calculator and
// /api/calculate, so the Shop popups can't diverge from the rest of the app.

function EstRow({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,0.10)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: gold ? 'var(--gold)' : 'var(--text)' }}>{value}</span>
    </div>
  )
}

function EstNote({ label, note }: { label: string; note: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,0.10)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'right', maxWidth: '62%' }}>{note}</span>
    </div>
  )
}

function EngineEstimate({ country, billableWeightKg, category, price, priceCurrency, productName, weightNote = 'billable weight' }: {
  country?: string | null
  billableWeightKg: number
  category?: PricingCategory | null
  price?: number | null
  priceCurrency?: string | null
  productName?: string | null
  weightNote?: string
}) {
  const [configs, setConfigs] = useState<Record<OriginCountry, CountryPricingConfig> | null>(null)
  const [fx, setFx] = useState<FxRates>(FALLBACK_FX)
  const [insuranceOptIn, setInsuranceOptIn] = useState(false)

  useEffect(() => {
    getPricingConfig().then(({ configs }) => {
      const map = {} as Record<OriginCountry, CountryPricingConfig>
      for (const c of configs) map[c.country] = c
      setConfigs(map)
    })
    ;(async () => {
      try {
        const [iqdRes, fxRes] = await Promise.all([
          fetch('/api/exchange-rate'),
          fetch('https://open.er-api.com/v6/latest/USD'),
        ])
        const iqdData = await iqdRes.json()
        const fxData = await fxRes.json()
        const r = fxData?.rates ?? {}
        setFx({
          iqd: iqdData.rate || FALLBACK_FX.iqd,
          EUR: r.EUR || FALLBACK_FX.EUR,
          GBP: r.GBP || FALLBACK_FX.GBP,
          TRY: r.TRY || FALLBACK_FX.TRY,
          AED: r.AED || FALLBACK_FX.AED,
        })
      } catch { /* keep fallback */ }
    })()
  }, [])

  const origin = country && (ORIGIN_COUNTRIES as readonly string[]).includes(country) ? country as OriginCountry : null

  // Engine only covers USA/UAE/Turkey/China — other origins (UK/Germany/Canada) quote manually.
  if (!origin) {
    return (
      <div className={styles.estimateInfo}>
        ℹ️ Paste this URL when submitting your order — our team will confirm the exact shipping cost.
      </div>
    )
  }
  if (!configs) {
    return <div className={styles.estimateLoading}><span className={styles.spinner} /> Calculating estimate...</div>
  }

  const config = configs[origin] ?? defaultConfig(origin)
  const priceUsd = price != null && !isNaN(price) && price > 0 ? toUsd(price, priceCurrency || 'USD', fx) : null
  const b = calculatePricing(config, {
    billableWeightKg: billableWeightKg || 0,
    qty: 1,
    category: category || 'uncategorized',
    itemPrice: priceUsd,
    insuranceOptIn,
  })

  const money = (n: number) => `$${n.toFixed(2)}`
  const showInsurance = config.insurance_percent > 0

  return (
    <div className={styles.estimateBox}>
      <div className={styles.estimateHeader}>
        <span className={styles.estimateLabel}>≈ Full Estimate · تقدير التكلفة</span>
        <span className={styles.estimateBadge}>APPROXIMATE</span>
      </div>

      {productName && <div className={styles.estimateProduct} style={{ marginBottom: 10 }}>📦 {productName}</div>}

      {/* Insurance opt-in — only shown when the country has an insurance rate set */}
      {showInsurance && (
        <label
          onClick={() => setInsuranceOptIn(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', marginBottom: 10, cursor: 'pointer',
            background: insuranceOptIn ? 'rgba(201,168,76,0.10)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${insuranceOptIn ? 'rgba(201,168,76,0.35)' : 'var(--border)'}`, borderRadius: 8,
          }}
        >
          <span style={{
            width: 18, height: 18, flexShrink: 0, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: insuranceOptIn ? 'var(--gold)' : 'transparent',
            border: `2px solid ${insuranceOptIn ? 'var(--gold)' : 'var(--border)'}`, color: '#0f0e0c', fontSize: 12, fontWeight: 800,
          }}>{insuranceOptIn ? '✓' : ''}</span>
          <span style={{ fontSize: 12, color: 'var(--text)' }}>🛡️ Add insurance ({config.insurance_percent}% of item price)</span>
        </label>
      )}

      {/* Breakdown */}
      <div style={{ marginBottom: 10 }}>
        {b.itemPrice != null && <EstRow label="Item Price · المنتج" value={money(b.itemPrice)} />}
        {b.shipping != null
          ? <EstRow label="Shipping · الشحن" value={money(b.shipping)} gold />
          : <EstNote label="Shipping · الشحن" note="Rates not set — contact us" />}
        {b.serviceFee != null
          ? <EstRow label="Service Fee · الخدمة" value={money(b.serviceFee)} />
          : <EstNote label="Service Fee · الخدمة" note={b.serviceFeeMessage ?? 'Enter item price'} />}
        <EstRow label="Customs · الجمارك" value={money(b.customs)} />
        {b.insuranceOptIn && (b.insurance != null
          ? <EstRow label="Insurance · التأمين" value={money(b.insurance)} />
          : <EstNote label="Insurance · التأمين" note={b.insuranceMessage ?? 'Enter item price'} />)}
      </div>

      {/* Total */}
      {b.ratesUnavailable ? (
        <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>Contact us for a quote</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>تواصل معنا للحصول على عرض سعر</div>
        </div>
      ) : (
        <>
          <div className={styles.estimateRange}>
            {b.partialTotal ? '~' : ''}{money(b.total)}<span className={styles.estimateCurrency}> USD</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            ≈ {Math.round(b.total * fx.iqd).toLocaleString()} IQD
          </div>
          {b.partialTotal && b.totalMessage && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 6 }}>{b.totalMessage}</div>
          )}
        </>
      )}

      <div className={styles.estimateSub} style={{ marginTop: 8 }}>
        Billed weight: {b.effectiveWeight} {b.weightUnit}{b.effectiveWeight > b.billableWeight ? ' (min applied)' : ''} · {billableWeightKg} kg {weightNote} · Final price confirmed by ShipIQ
      </div>
    </div>
  )
}

// ── AutoCalcModal ─────────────────────────────────────────────────────────────

function AutoCalcModal({ onClose, userId, onStartOrder }: { onClose: () => void; userId?: string; onStartOrder?: (url: string) => void }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [error, setError] = useState('')
  const [trendyolKg, setTrendyolKg] = useState<number | null>(null)

  const isTrendyolUrl = url.toLowerCase().includes('trendyol.com')

  async function calculate() {
    if (!url.trim() || loading) return
    setLoading(true)
    setResult(null)
    setError('')
    setTrendyolKg(null)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data: ScrapeResult = await res.json()
      if (data.found && data.billable_weight_kg) {
        setResult(data)
      } else {
        setError(data.reason || 'Could not calculate estimate for this product.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reach the estimate service.')
    }
    setLoading(false)
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div className={styles.panelOverlay} onClick={onClose} />
      <div className={styles.panel}>

        {/* ── Drag handle (mobile only) ── */}
        <div className={styles.dragHandle}>
          <div className={styles.dragHandleBar} />
        </div>

        {/* ── Header ── */}
        <div className={styles.panelHeader}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.autoCalcTitle}>⚡ Auto Calculate</div>
            <div className={styles.autoCalcSub}>
              Paste any product URL and get an instant shipping estimate before submitting your order
            </div>
          </div>
          <button className={styles.panelClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Input + Calculate ── */}
        <div className={styles.panelSection}>
          <div className={styles.panelInputWrap}>
            <input
              className={styles.panelInput}
              placeholder="Paste product link here..."
              value={url}
              onChange={e => { setUrl(e.target.value); setResult(null); setError('') }}
              onKeyDown={e => e.key === 'Enter' && calculate()}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            {url && (
              <button
                className={styles.panelInputClear}
                onClick={() => { setUrl(''); setResult(null); setError('') }}
                aria-label="Clear"
              >✕</button>
            )}
          </div>

          <button
            className={styles.calcBtn}
            onClick={calculate}
            disabled={loading || !url.trim()}
          >
            {loading ? <><span className={styles.spinner} /> Calculating…</> : 'Calculate →'}
          </button>

          {/* Trendyol weight estimator */}
          {isTrendyolUrl && !loading && !result && url && (
            <TrendyolWeightEstimator onWeightSelect={kg => setTrendyolKg(kg)} />
          )}

          {/* Error */}
          {error && !loading && (
            <div className={styles.estimateError}>⚠️ {error}</div>
          )}

          {/* Full engine estimate — scraped product */}
          {result && !loading && (
            <EngineEstimate
              country={result.site?.country}
              billableWeightKg={result.billable_weight_kg ?? 0}
              category={resolvePricingCategory(result.mappedCategory, STORES.find(s => url.toLowerCase().includes(s.domain))?.category)}
              price={result.price ?? null}
              priceCurrency={result.currency ?? null}
              productName={result.product_name ?? null}
            />
          )}

          {/* Full engine estimate — Trendyol manual weight selection */}
          {!result && trendyolKg && trendyolKg > 0 && !loading && (
            <EngineEstimate country="Turkey" billableWeightKg={trendyolKg} weightNote="estimated weight" />
          )}

          {/* Submit Order — routes to the New Order form prefilled with this URL */}
          {userId && onStartOrder && url.startsWith('http') && (
            <button
              onClick={() => { onStartOrder(url); onClose() }}
              style={{
                marginTop: 12, width: '100%', padding: '11px', fontSize: 14, fontWeight: 700,
                background: 'var(--gold)', color: '#0f0e0c', border: 'none', borderRadius: 8, cursor: 'pointer',
              }}
            >
              ✓ Submit Order · إرسال الطلب
            </button>
          )}

          {/* Supported sites */}
          <div className={styles.autoCalcNote}>
            Works best with Amazon, eBay, Trendyol, Noon and more
          </div>
          <div className={styles.supportedSites}>
            {SUPPORTED_SITES.map((site: string) => (
              <span key={site} className={styles.siteBadge}>{site}</span>
            ))}
          </div>
        </div>

      </div>
    </>,
    document.body
  )
}

// ── StorePanel ────────────────────────────────────────────────────────────────

function StorePanel({ store, onClose, userId, onWishlistSave, onStartOrder }: { store: Store; onClose: () => void; userId?: string; onWishlistSave?: (url: string) => void; onStartOrder?: (url: string) => void }) {
  const [url, setUrl] = useState('')
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null)
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [trendyolKg, setTrendyolKg] = useState<number | null>(null)
  const [wishSaved, setWishSaved] = useState(false)

  const detectedStore = url ? STORES.find(s => url.toLowerCase().includes(s.domain)) ?? null : null
  const displayStore = detectedStore ?? store
  const isSupported = SUPPORTED_SITES.some((s: string) => url.toLowerCase().includes(s))
  const isTrendyolUrl = url.toLowerCase().includes('trendyol.com')

  // Route to the New Order form prefilled with this URL — the customer reviews the
  // fetched details, adds a photo/note, and submits there (one intake shape).
  const submitOrder = () => {
    if (!userId || !url.startsWith('http')) return
    onStartOrder?.(url)
    onClose()
  }

  useEffect(() => {
    setTrendyolKg(null)
    if (!url || !isSupported) {
      setScrapeResult(null)
      setScrapeError('')
      setScrapeLoading(false)
      return
    }
    setScrapeLoading(true)
    setScrapeError('')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const data: ScrapeResult = await res.json()
        if (data.found && data.billable_weight_kg) {
          setScrapeResult(data)
        } else {
          setScrapeResult(null)
          setScrapeError(data.reason || 'Could not calculate estimate for this product.')
        }
      } catch (e) {
        setScrapeResult(null)
        setScrapeError(e instanceof Error ? e.message : 'Failed to reach the estimate service.')
      }
      setScrapeLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div className={styles.panelOverlay} onClick={onClose} />
      <div className={styles.panel}>

        {/* ── Drag handle (visible on mobile only) ── */}
        <div className={styles.dragHandle}>
          <div className={styles.dragHandleBar} />
        </div>

        {/* ── Header ── */}
        <div className={styles.panelHeader}>
          <div className={styles.panelStoreInfo}>
            <StoreLogo domain={displayStore.domain} emoji={displayStore.emoji} size={32} emojiClass={styles.panelEmoji} />
            <div>
              <div className={styles.panelStoreName}>{displayStore.name}</div>
              <div className={styles.panelStoreCountry}>
                {displayStore.flag} {displayStore.country} · {displayStore.category}
              </div>
            </div>
          </div>
          <button className={styles.panelClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Open Store ── */}
        <div className={styles.panelSection}>
          <a
            className={styles.btnOpenStore}
            href={`https://www.${store.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: safeBg(store.color) }}
          >
            🌐 Open {store.name}
          </a>
        </div>

        <div className={styles.panelDivider} />

        {/* ── URL paste + estimate ── */}
        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Paste a product URL · رابط المنتج</div>
          <div className={styles.panelInputWrap}>
            <input
              className={styles.panelInput}
              placeholder={`https://www.${store.domain}/...`}
              value={url}
              onChange={e => setUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {url && (
              <button className={styles.panelInputClear} onClick={() => setUrl('')} aria-label="Clear">✕</button>
            )}
          </div>

          {detectedStore && detectedStore.domain !== store.domain && (
            <div className={styles.detectedBadge}>
              {detectedStore.emoji} Detected: <strong>{detectedStore.name}</strong>
            </div>
          )}

          {scrapeLoading && isSupported && (
            <div className={styles.estimateLoading}>
              <span className={styles.spinner} /> Calculating shipping estimate...
            </div>
          )}

          {/* Non-Trendyol error */}
          {scrapeError && !scrapeLoading && url && !isTrendyolUrl && (
            <div className={styles.estimateError}>⚠️ {scrapeError}</div>
          )}

          {/* Trendyol weight estimator (shown when no weight data returned) */}
          {isTrendyolUrl && !scrapeLoading && !scrapeResult && url && (
            <TrendyolWeightEstimator onWeightSelect={kg => setTrendyolKg(kg)} />
          )}

          {/* Full engine estimate — scraped product */}
          {scrapeResult && !scrapeLoading && (
            <EngineEstimate
              country={scrapeResult.site?.country}
              billableWeightKg={scrapeResult.billable_weight_kg ?? 0}
              category={resolvePricingCategory(scrapeResult.mappedCategory, displayStore.category)}
              price={scrapeResult.price ?? null}
              priceCurrency={scrapeResult.currency ?? null}
              productName={scrapeResult.product_name ?? null}
            />
          )}

          {/* Full engine estimate — Trendyol manual weight selection */}
          {!scrapeResult && trendyolKg && trendyolKg > 0 && !scrapeLoading && (
            <EngineEstimate country="Turkey" billableWeightKg={trendyolKg} category={mapStoreCategory(displayStore.category)} weightNote="estimated weight" />
          )}

          {url && !isSupported && !scrapeLoading && (
            <div className={styles.estimateInfo}>
              ℹ️ Paste this URL when submitting your order — our team will confirm the exact shipping cost.
            </div>
          )}

          {/* Submit Order — routes to the New Order form prefilled with this URL */}
          {userId && onStartOrder && url.startsWith('http') && (
            <button
              onClick={submitOrder}
              style={{
                marginTop: 12, width: '100%', padding: '11px', fontSize: 14, fontWeight: 700,
                background: 'var(--gold)', color: '#0f0e0c', border: 'none', borderRadius: 8, cursor: 'pointer',
              }}
            >
              ✓ Submit Order · إرسال الطلب
            </button>
          )}

          {url && url.startsWith('http') && onWishlistSave && (
            <button
              onClick={() => { onWishlistSave(url); setWishSaved(true); setTimeout(() => setWishSaved(false), 2500) }}
              style={{
                marginTop: 10, width: '100%', padding: '9px', fontSize: 13, fontWeight: 600,
                background: wishSaved ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                color: wishSaved ? '#16a34a' : '#ef4444',
                border: `1px solid ${wishSaved ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              {wishSaved ? '✓ Saved to Wishlist!' : '❤️ Save to Wishlist'}
            </button>
          )}
        </div>

        <div className={styles.panelDivider} />

        {/* ── How it works ── */}
        <div className={styles.panelSection}>
          <div className={styles.panelHelp}>
            <div className={styles.panelHelpTitle}>How it works · كيف يعمل</div>
            <div className={styles.panelHelpStep}>
              <span className={styles.panelHelpNum}>1</span>
              Browse {store.name} and find the product you want
            </div>
            <div className={styles.panelHelpStep}>
              <span className={styles.panelHelpNum}>2</span>
              Copy the product URL and paste it above to get an estimate
            </div>
            <div className={styles.panelHelpStep}>
              <span className={styles.panelHelpNum}>3</span>
              Submit an order on the Orders page — we buy it and ship it to Iraq 🇮🇶
            </div>
          </div>
        </div>

      </div>
    </>,
    document.body
  )
}

// ── ShopSection ───────────────────────────────────────────────────────────────

export default function ShopSection({ userId, onWishlistSave, onStartOrder }: { userId?: string; onWishlistSave?: (url: string) => void; onStartOrder?: (url: string) => void }) {
  const [countryFilter, setCountryFilter] = useState('All')
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [autoCalcOpen, setAutoCalcOpen] = useState(false)

  const filtered = countryFilter === 'All'
    ? STORES
    : STORES.filter(s => s.country === countryFilter)

  return (
    <div style={{ width: '100%' }}>
      {/* Deals + Recently Visited */}
      <DealsSection />

      {/* Filter bar: flag-only country filter + Auto Calculate */}
      <div className={styles.filterBar}>
        <div className={styles.flagFilter}>
          {COUNTRY_FLAGS.map(c => (
            <button
              key={c.id}
              className={`${styles.flagBtn} ${countryFilter === c.id ? styles.flagBtnActive : ''}`}
              onClick={() => setCountryFilter(c.id)}
              aria-label={c.id}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          className={styles.autoCalcBtn}
          onClick={() => setAutoCalcOpen(true)}
        >
          ⚡ Auto Calculate
        </button>
      </div>

      {/* Logo grid */}
      <div className={styles.grid}>
        {filtered.map(store => (
          <button
            key={`${store.country}-${store.name}`}
            className={styles.storeCard}
            aria-label={store.name}
            onClick={() => {
              try {
                const raw = localStorage.getItem('shipiq_recent_stores')
                const prev: Store[] = raw ? JSON.parse(raw) : []
                const next = [store, ...prev.filter(s => !(s.country === store.country && s.name === store.name))].slice(0, 5)
                localStorage.setItem('shipiq_recent_stores', JSON.stringify(next))
                window.dispatchEvent(new Event('shipiq:recent_update'))
              } catch {}
              setSelectedStore(store)
            }}
          >
            <CardLogo domain={store.domain} name={store.name} />
          </button>
        ))}
      </div>

      {/* Auto Calculate modal */}
      {autoCalcOpen && (
        <AutoCalcModal onClose={() => setAutoCalcOpen(false)} userId={userId} onStartOrder={onStartOrder} />
      )}

      {/* Store panel */}
      {selectedStore && (
        <StorePanel store={selectedStore} onClose={() => setSelectedStore(null)} userId={userId} onWishlistSave={onWishlistSave} onStartOrder={onStartOrder} />
      )}
    </div>
  )
}
