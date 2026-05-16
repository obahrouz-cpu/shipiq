'use client'
import { useState, useEffect } from 'react'
import type { RecentStore } from '@/lib/types'
import styles from './DealsSection.module.css'

const DEALS = [
  {
    id: 1,
    emoji: '⚡',
    title: 'Instant Estimates',
    subtitle: 'Get instant shipping estimates on Amazon, eBay & more',
    gradient: 'linear-gradient(135deg, #7a5c10 0%, #c9a84c 65%, #e8cd7a 100%)',
    shopUrl: null as string | null,
  },
  {
    id: 2,
    emoji: '🇺🇸',
    title: 'Shop from the US',
    subtitle: 'Electronics, fashion, beauty delivered to Iraq',
    gradient: 'linear-gradient(135deg, #0f2560 0%, #1a56db 65%, #4a8fe8 100%)',
    shopUrl: null as string | null,
  },
  {
    id: 3,
    emoji: '🇹🇷',
    title: 'Turkey Now Available',
    subtitle: 'Trendyol, LC Waikiki & more Turkish stores',
    gradient: 'linear-gradient(135deg, #821e06 0%, #e8491d 65%, #f5813a 100%)',
    shopUrl: null as string | null,
  },
  {
    id: 4,
    emoji: '🇦🇪',
    title: 'UAE Stores Added',
    subtitle: 'Shop Noon, Namshi and more from UAE',
    gradient: 'linear-gradient(135deg, #341080 0%, #7c3aed 65%, #a87af5 100%)',
    shopUrl: null as string | null,
  },
]

function RecentLogo({ domain, emoji }: { domain: string; emoji: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className={styles.recentEmoji}>{emoji}</span>
  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt=""
      className={styles.recentLogo}
      onError={() => setFailed(true)}
    />
  )
}

export default function DealsSection() {
  const [index, setIndex]               = useState(0)
  const [paused, setPaused]             = useState(false)
  const [recentStores, setRecentStores] = useState<RecentStore[]>([])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setIndex(i => (i + 1) % DEALS.length), 4000)
    return () => clearInterval(id)
  }, [paused])

  function loadRecent() {
    try {
      const raw = localStorage.getItem('shipiq_recent_stores')
      setRecentStores(raw ? JSON.parse(raw) : [])
    } catch { setRecentStores([]) }
  }

  function clearRecent() {
    try { localStorage.removeItem('shipiq_recent_stores') } catch {}
    setRecentStores([])
    window.dispatchEvent(new Event('shipiq:recent_update'))
  }

  useEffect(() => {
    loadRecent()
    window.addEventListener('shipiq:recent_update', loadRecent)
    return () => window.removeEventListener('shipiq:recent_update', loadRecent)
  }, [])

  const visible = recentStores.slice(0, 3)

  return (
    <div className={styles.wrap}>

      {/* ── Deals carousel ── */}
      <div
        className={styles.carouselWrap}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className={styles.carouselOuter}>
          <div className={styles.track} style={{ transform: `translateX(-${index * 100}%)` }}>
            {DEALS.map(deal => (
              <div key={deal.id} className={styles.card} style={{ background: deal.gradient }}>
                <div className={styles.cardEmoji}>{deal.emoji}</div>
                <div className={styles.cardTitle}>{deal.title}</div>
                <div className={styles.cardSub}>{deal.subtitle}</div>
                {deal.shopUrl && (
                  <a
                    className={styles.cardCta}
                    href={deal.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Shop Now →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.dotsRow}>
          {DEALS.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ── Recently Visited ── */}
      {visible.length > 0 && (
        <div className={styles.recentSection}>
          <div className={styles.recentHeader}>
            <span className={styles.recentLabel}>Recently Visited · زرت مؤخراً</span>
            <button className={styles.clearBtn} onClick={clearRecent} aria-label="Clear history">✕</button>
          </div>
          <div className={styles.recentRow}>
            {visible.map(s => (
              <a
                key={`${s.country}-${s.name}`}
                className={styles.recentCard}
                href={`https://www.${s.domain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <RecentLogo domain={s.domain} emoji={s.emoji} />
                <span className={styles.recentName}>{s.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
