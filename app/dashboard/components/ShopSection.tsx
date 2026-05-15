'use client'
import { useState, useEffect } from 'react'
import styles from './ShopSection.module.css'

// ── Types ────────────────────────────────────────────────────────────────────

type Store = {
  name: string
  emoji: string
  country: 'US' | 'UAE' | 'Turkey' | 'China'
  flag: string
  category: string
  domain: string
  color: string
  bg: string
}

// ── Data ─────────────────────────────────────────────────────────────────────

const COUNTRY_FILTERS = [
  { id: 'All',    label: 'All' },
  { id: 'US',     label: '🇺🇸 US' },
  { id: 'UAE',    label: '🇦🇪 UAE' },
  { id: 'Turkey', label: '🇹🇷 Turkey' },
  { id: 'China',  label: '🇨🇳 China' },
]

const CATEGORY_FILTERS = [
  'All', 'Electronics', 'Clothing', 'Cosmetics', 'Home',
  'Gaming', 'Shoes', 'Sports', 'Watches', 'Beauty',
]

const STORES: Store[] = [
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
  { name: 'Amazon UAE',       emoji: '🛒', country: 'UAE', flag: '🇦🇪', category: 'Electronics', domain: 'amazon.ae',          color: '#FF9900', bg: 'rgba(255,153,0,0.1)' },
  { name: 'Noon',             emoji: '🌙', country: 'UAE', flag: '🇦🇪', category: 'Electronics', domain: 'noon.com',            color: '#f5c518', bg: 'rgba(245,197,24,0.1)' },
  { name: 'Namshi',           emoji: '👗', country: 'UAE', flag: '🇦🇪', category: 'Clothing',    domain: 'namshi.com',          color: '#9c6fe4', bg: 'rgba(156,111,228,0.1)' },
  { name: 'Sharaf DG',        emoji: '📱', country: 'UAE', flag: '🇦🇪', category: 'Electronics', domain: 'sharafdg.com',        color: '#e31e25', bg: 'rgba(227,30,37,0.1)' },
  { name: 'Brands for Less',  emoji: '🏷️', country: 'UAE', flag: '🇦🇪', category: 'Clothing',    domain: 'brandsforless.ae',    color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  // ── Turkey ────────────────────────────────────────────────────────────────
  { name: 'Trendyol',   emoji: '🛍️', country: 'Turkey', flag: '🇹🇷', category: 'Clothing',    domain: 'trendyol.com',   color: '#F27A1A', bg: 'rgba(242,122,26,0.1)' },
  { name: 'Hepsiburada',emoji: '🛒', country: 'Turkey', flag: '🇹🇷', category: 'Electronics', domain: 'hepsiburada.com',color: '#FF6000', bg: 'rgba(255,96,0,0.1)' },
  { name: 'N11',        emoji: '🏪', country: 'Turkey', flag: '🇹🇷', category: 'Electronics', domain: 'n11.com',        color: '#7b2d8b', bg: 'rgba(123,45,139,0.1)' },
  { name: 'LC Waikiki', emoji: '👕', country: 'Turkey', flag: '🇹🇷', category: 'Clothing',    domain: 'lcwaikiki.com',  color: '#cc0000', bg: 'rgba(204,0,0,0.1)' },
  { name: 'Mavi',       emoji: '👖', country: 'Turkey', flag: '🇹🇷', category: 'Clothing',    domain: 'mavi.com',       color: '#1a56db', bg: 'rgba(26,86,219,0.1)' },
  // ── China ─────────────────────────────────────────────────────────────────
  { name: 'AliExpress', emoji: '📦', country: 'China', flag: '🇨🇳', category: 'Electronics', domain: 'aliexpress.com', color: '#FF4747', bg: 'rgba(255,71,71,0.1)' },
  { name: 'Shein',      emoji: '👗', country: 'China', flag: '🇨🇳', category: 'Clothing',    domain: 'shein.com',      color: '#C8473C', bg: 'rgba(200,71,60,0.1)' },
  { name: 'Banggood',   emoji: '🔧', country: 'China', flag: '🇨🇳', category: 'Electronics', domain: 'banggood.com',   color: '#e8491d', bg: 'rgba(232,73,29,0.1)' },
  { name: 'DHgate',     emoji: '🏭', country: 'China', flag: '🇨🇳', category: 'Electronics', domain: 'dhgate.com',     color: '#1a91c6', bg: 'rgba(26,145,198,0.1)' },
  { name: 'Zaful',      emoji: '👙', country: 'China', flag: '🇨🇳', category: 'Clothing',    domain: 'zaful.com',      color: '#f63472', bg: 'rgba(246,52,114,0.1)' },
]

const SUPPORTED_SITES = [
  'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.ae', 'amazon.ca',
  'bhphotovideo.com', 'newegg.com', 'bestbuy.com', 'ebay.com',
  'trendyol.com', 'hepsiburada.com', 'n11.com',
  'aliexpress.com', 'taobao.com', '1688.com', 'jd.com',
]

const RATE_RANGES: Record<string, { min: number; max: number }> = {
  'USA':     { min: 12000, max: 19000 },
  'UK':      { min: 11000, max: 17000 },
  'Germany': { min: 11000, max: 17000 },
  'Canada':  { min: 10000, max: 16000 },
  'UAE':     { min:  6000, max: 10000 },
  'Turkey':  { min:  5000, max:  8000 },
  'China':   { min:  8000, max: 14000 },
}

// Returns a dark-safe button background (guards against near-white brand colours)
function safeBg(hex: string): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#555555' : hex
}

// ── StorePanel ───────────────────────────────────────────────────────────────

function StorePanel({ store, onClose }: { store: Store; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [scrapeResult, setScrapeResult] = useState<any>(null)
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeError, setScrapeError] = useState('')

  const detectedStore = url ? STORES.find(s => url.toLowerCase().includes(s.domain)) ?? null : null
  const displayStore = detectedStore ?? store
  const isSupported = SUPPORTED_SITES.some(s => url.toLowerCase().includes(s))

  // Auto-scrape for supported sites with 800 ms debounce
  useEffect(() => {
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
        const data = await res.json()
        if (data.found && data.billable_weight_kg) {
          setScrapeResult(data)
        } else {
          setScrapeResult(null)
          setScrapeError(data.reason || 'Could not calculate estimate for this product.')
        }
      } catch (e: any) {
        setScrapeResult(null)
        setScrapeError(e?.message || 'Failed to reach the estimate service.')
      }
      setScrapeLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  const rates = RATE_RANGES[scrapeResult?.site?.country ?? ''] ?? { min: 10000, max: 18000 }
  const totalKg = scrapeResult?.billable_weight_kg ?? 0
  const estimate = totalKg > 0
    ? { min: Math.round(rates.min * totalKg), max: Math.round(rates.max * totalKg), kg: totalKg }
    : null

  return (
    <>
      <div className={styles.panelOverlay} onClick={onClose} />
      <div className={styles.panel}>

        {/* ── Header ── */}
        <div className={styles.panelHeader}>
          <div className={styles.panelStoreInfo}>
            <div className={styles.panelEmoji}>{displayStore.emoji}</div>
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

          {/* Detected-store badge when URL points to a different store */}
          {detectedStore && detectedStore.domain !== store.domain && (
            <div className={styles.detectedBadge}>
              {detectedStore.emoji} Detected: <strong>{detectedStore.name}</strong>
            </div>
          )}

          {/* Loading */}
          {scrapeLoading && isSupported && (
            <div className={styles.estimateLoading}>
              <span className={styles.spinner} /> Calculating shipping estimate...
            </div>
          )}

          {/* Error */}
          {scrapeError && !scrapeLoading && url && (
            <div className={styles.estimateError}>⚠️ {scrapeError}</div>
          )}

          {/* Estimate box */}
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

          {/* Unsupported-site hint */}
          {url && !isSupported && !scrapeLoading && (
            <div className={styles.estimateInfo}>
              ℹ️ Paste this URL when submitting your order — our team will confirm the exact shipping cost.
            </div>
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

// ── ShopSection ──────────────────────────────────────────────────────────────

export default function ShopSection() {
  const [countryFilter, setCountryFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)

  const filtered = STORES.filter(s => {
    const okCountry  = countryFilter  === 'All' || s.country  === countryFilter
    const okCategory = categoryFilter === 'All' || s.category === categoryFilter
    return okCountry && okCategory
  })

  const metaParts: string[] = []
  if (countryFilter  !== 'All') metaParts.push(countryFilter)
  if (categoryFilter !== 'All') metaParts.push(categoryFilter)

  return (
    <div>
      {/* Country pills */}
      <div className={styles.pills}>
        {COUNTRY_FILTERS.map(c => (
          <button
            key={c.id}
            className={`${styles.pill} ${countryFilter === c.id ? styles.pillActive : ''}`}
            onClick={() => setCountryFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Category bubbles */}
      <div className={styles.bubbles}>
        {CATEGORY_FILTERS.map(cat => (
          <button
            key={cat}
            className={`${styles.bubble} ${categoryFilter === cat ? styles.bubbleActive : ''}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className={styles.noResults}>
          <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.25 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>No stores match this filter</div>
          <button
            className={styles.resetBtn}
            onClick={() => { setCountryFilter('All'); setCategoryFilter('All') }}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <>
          <div className={styles.resultsMeta}>
            {filtered.length} store{filtered.length !== 1 ? 's' : ''}
            {metaParts.length > 0 && ` · ${metaParts.join(' · ')}`}
          </div>
          <div className={styles.grid}>
            {filtered.map(store => (
              <button
                key={`${store.country}-${store.name}`}
                className={styles.storeCard}
                onClick={() => setSelectedStore(store)}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.borderColor = store.color
                  el.style.background  = store.bg
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.borderColor = 'var(--border)'
                  el.style.background  = 'var(--surface)'
                }}
              >
                <div className={styles.storeEmoji}>{store.emoji}</div>
                <div className={styles.storeName}>{store.name}</div>
                <div className={styles.storeTags}>
                  <span
                    className={styles.storeTag}
                    style={{ background: store.bg, color: store.color }}
                  >
                    {store.category}
                  </span>
                  <span className={styles.storeTagFlag}>{store.flag}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Bottom tip */}
      <div className={styles.tip}>
        💡 Click a store to browse it and get a shipping estimate before you order
      </div>

      {/* Slide-in panel */}
      {selectedStore && (
        <StorePanel store={selectedStore} onClose={() => setSelectedStore(null)} />
      )}
    </div>
  )
}
