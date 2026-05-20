'use client'
import { useState, useEffect } from 'react'
import type { Store, ScrapeResult } from '@/lib/types'
import { STORES, SUPPORTED_SITES, SHIPPING_RATES } from '@/lib/constants'
import styles from './ShopSection.module.css'
import DealsSection from './DealsSection'
import TrendyolWeightEstimator from './TrendyolWeightEstimator'

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

// ── StorePanel ────────────────────────────────────────────────────────────────

function StorePanel({ store, onClose, userId, onWishlistSave }: { store: Store; onClose: () => void; userId?: string; onWishlistSave?: (url: string) => void }) {
  const [url, setUrl] = useState('')
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null)
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [trendyolKg, setTrendyolKg] = useState<number | null>(null)
  const [wishSaved, setWishSaved] = useState(false)

  const detectedStore = url ? STORES.find(s => url.toLowerCase().includes(s.domain)) ?? null : null
  const displayStore = detectedStore ?? store
  const isSupported = SUPPORTED_SITES.some(s => url.toLowerCase().includes(s))
  const isTrendyolUrl = url.toLowerCase().includes('trendyol.com')

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

  const rates = SHIPPING_RATES[scrapeResult?.site?.country ?? ''] ?? { min: 10000, max: 18000 }
  const totalKg = scrapeResult?.billable_weight_kg ?? 0
  const estimate = totalKg > 0
    ? { min: Math.round(rates.min * totalKg), max: Math.round(rates.max * totalKg), kg: totalKg }
    : null

  // Estimate computed from the Trendyol estimator selection
  const turkeyRates = SHIPPING_RATES['Turkey'] ?? { min: 5000, max: 8000 }
  const trendyolEstimate = !estimate && trendyolKg && trendyolKg > 0
    ? { min: Math.round(turkeyRates.min * trendyolKg), max: Math.round(turkeyRates.max * trendyolKg), kg: trendyolKg }
    : null

  return (
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

          {/* Estimate from scraper */}
          {estimate && !scrapeLoading && (
            <div className={styles.estimateBox}>
              <div className={styles.estimateHeader}>
                <span className={styles.estimateLabel}>≈ Shipping Estimate · تقدير الشحن</span>
                <span className={styles.estimateBadge}>APPROXIMATE</span>
              </div>
              <div className={styles.estimateRange}>
                {estimate.min.toLocaleString()} – {estimate.max.toLocaleString()}
                <span className={styles.estimateCurrency}> IQD</span>
              </div>
              <div className={styles.estimateSub}>
                {estimate.kg} kg billable weight · Final price confirmed by ShipIQ
              </div>
              {scrapeResult?.product_name && (
                <div className={styles.estimateProduct}>📦 {scrapeResult.product_name}</div>
              )}
            </div>
          )}

          {/* Estimate from Trendyol estimator selection */}
          {trendyolEstimate && !scrapeLoading && (
            <div className={styles.estimateBox}>
              <div className={styles.estimateHeader}>
                <span className={styles.estimateLabel}>≈ Shipping Estimate · تقدير الشحن</span>
                <span className={styles.estimateBadge}>APPROXIMATE</span>
              </div>
              <div className={styles.estimateRange}>
                {trendyolEstimate.min.toLocaleString()} – {trendyolEstimate.max.toLocaleString()}
                <span className={styles.estimateCurrency}> IQD</span>
              </div>
              <div className={styles.estimateSub}>
                {trendyolEstimate.kg} kg estimated weight · Final price confirmed by ShipIQ
              </div>
            </div>
          )}

          {url && !isSupported && !scrapeLoading && (
            <div className={styles.estimateInfo}>
              ℹ️ Paste this URL when submitting your order — our team will confirm the exact shipping cost.
            </div>
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
    </>
  )
}

// ── ShopSection ───────────────────────────────────────────────────────────────

export default function ShopSection({ userId, onWishlistSave }: { userId?: string; onWishlistSave?: (url: string) => void }) {
  const [countryFilter, setCountryFilter] = useState('All')
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)

  const filtered = countryFilter === 'All'
    ? STORES
    : STORES.filter(s => s.country === countryFilter)

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
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
          onClick={() => setSelectedStore(STORES[0])}
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

      {/* Slide-in panel */}
      {selectedStore && (
        <StorePanel store={selectedStore} onClose={() => setSelectedStore(null)} userId={userId} onWishlistSave={onWishlistSave} />
      )}
    </div>
  )
}
