'use client'
import { useState, useEffect } from 'react'
import type { Store, ScrapeResult } from '@/lib/types'
import { STORES, COUNTRY_FILTERS, CATEGORY_FILTERS, SUPPORTED_SITES, SHIPPING_RATES } from '@/lib/constants'
import styles from './ShopSection.module.css'
import DealsSection from './DealsSection'

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

function StorePanel({ store, onClose }: { store: Store; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null)
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeError, setScrapeError] = useState('')

  const detectedStore = url ? STORES.find(s => url.toLowerCase().includes(s.domain)) ?? null : null
  const displayStore = detectedStore ?? store
  const isSupported = SUPPORTED_SITES.some(s => url.toLowerCase().includes(s))

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

          {scrapeError && !scrapeLoading && url && (
            <div className={styles.estimateError}>⚠️ {scrapeError}</div>
          )}

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

// ── ShopSection ───────────────────────────────────────────────────────────────

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
      {/* Deals + Recently Visited */}
      <DealsSection />

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
                <StoreLogo domain={store.domain} emoji={store.emoji} size={32} />
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
