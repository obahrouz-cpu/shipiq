'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import ShippingCalculator from './dashboard/components/ShippingCalculator'
import styles from './landing.module.css'

// ── Clearbit logo with fallback ───────────────────────────────────────────────

function StoreLogo({ domain, emoji, size = 36 }: { domain: string; emoji: string; size?: number }) {
  const [src, setSrc] = useState(`https://logo.clearbit.com/${domain}?size=80`)
  const [failed, setFailed] = useState(false)

  if (failed) return <span style={{ fontSize: size * 0.65, lineHeight: 1 }}>{emoji}</span>

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 4, flexShrink: 0 }}
      onError={() => {
        if (src.includes('clearbit.com')) {
          setSrc(`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`)
        } else {
          setFailed(true)
        }
      }}
    />
  )
}

// ── Scroll-in animation hook ──────────────────────────────────────────────────

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}

// ── Data ──────────────────────────────────────────────────────────────────────

const COUNTRY_CARDS = [
  {
    flag: '🇺🇸', name: 'USA', nameAr: 'أمريكا', accentColor: '#c9a84c',
    stores: ['Amazon', 'eBay', 'Best Buy', 'Nike'],
    domains: ['amazon.com', 'ebay.com', 'bestbuy.com', 'nike.com'],
    emojis: ['🛒', '🏷️', '🖥️', '👟'],
    delivery: '10–20 days', rate: '12,000–19,000 IQD/kg',
  },
  {
    flag: '🇹🇷', name: 'Turkey', nameAr: 'تركيا', accentColor: '#e07b3a',
    stores: ['Trendyol', 'Hepsiburada', 'LC Waikiki', 'Mavi'],
    domains: ['trendyol.com', 'hepsiburada.com', 'lcwaikiki.com', 'mavi.com'],
    emojis: ['🛍️', '🛒', '👕', '👖'],
    delivery: '7–14 days', rate: '5,000–8,000 IQD/kg',
  },
  {
    flag: '🇦🇪', name: 'UAE', nameAr: 'الإمارات', accentColor: '#5b9bd5',
    stores: ['Amazon AE', 'Noon', 'Boutiqaat', 'Namshi'],
    domains: ['amazon.ae', 'noon.com', 'boutiqaat.com', 'namshi.com'],
    emojis: ['🛒', '🌙', '💄', '👗'],
    delivery: '5–10 days', rate: '6,000–10,000 IQD/kg',
  },
  {
    flag: '🇨🇳', name: 'China', nameAr: 'الصين', accentColor: '#d9534f',
    stores: ['AliExpress', 'Shein', 'Banggood', 'DHgate'],
    domains: ['aliexpress.com', 'shein.com', 'banggood.com', 'dhgate.com'],
    emojis: ['📦', '👗', '🔧', '🏭'],
    delivery: '14–30 days', rate: '8,000–14,000 IQD/kg',
  },
]

const STORES_BY_COUNTRY: Record<string, { domain: string; emoji: string; name: string }[]> = {
  '🇺🇸 USA': [
    { domain: 'amazon.com',       emoji: '🛒', name: 'Amazon' },
    { domain: 'ebay.com',         emoji: '🏷️', name: 'eBay' },
    { domain: 'bestbuy.com',      emoji: '🖥️', name: 'Best Buy' },
    { domain: 'newegg.com',       emoji: '💻', name: 'Newegg' },
    { domain: 'bhphotovideo.com', emoji: '📷', name: 'B&H Photo' },
    { domain: 'walmart.com',      emoji: '🏪', name: 'Walmart' },
    { domain: 'target.com',       emoji: '🎯', name: 'Target' },
    { domain: 'macys.com',        emoji: '🛍️', name: "Macy's" },
    { domain: 'nike.com',         emoji: '👟', name: 'Nike' },
    { domain: 'adidas.com',       emoji: '👟', name: 'Adidas' },
    { domain: 'sephora.com',      emoji: '💄', name: 'Sephora' },
    { domain: 'iherb.com',        emoji: '🌿', name: 'iHerb' },
  ],
  '🇹🇷 Turkey': [
    { domain: 'trendyol.com',    emoji: '🛍️', name: 'Trendyol' },
    { domain: 'hepsiburada.com', emoji: '🛒', name: 'Hepsiburada' },
    { domain: 'n11.com',         emoji: '🏪', name: 'N11' },
    { domain: 'lcwaikiki.com',   emoji: '👕', name: 'LC Waikiki' },
    { domain: 'mavi.com',        emoji: '👖', name: 'Mavi' },
  ],
  '🇦🇪 UAE': [
    { domain: 'amazon.ae',        emoji: '🛒', name: 'Amazon AE' },
    { domain: 'noon.com',         emoji: '🌙', name: 'Noon' },
    { domain: 'boutiqaat.com',    emoji: '💄', name: 'Boutiqaat' },
    { domain: 'namshi.com',       emoji: '👗', name: 'Namshi' },
    { domain: 'sharafdg.com',     emoji: '📱', name: 'Sharaf DG' },
    { domain: 'brandsforless.ae', emoji: '🏷️', name: 'Brands for Less' },
  ],
  '🇨🇳 China': [
    { domain: 'aliexpress.com', emoji: '📦', name: 'AliExpress' },
    { domain: 'shein.com',      emoji: '👗', name: 'Shein' },
    { domain: 'banggood.com',   emoji: '🔧', name: 'Banggood' },
    { domain: 'dhgate.com',     emoji: '🏭', name: 'DHgate' },
    { domain: 'zaful.com',      emoji: '👙', name: 'Zaful' },
  ],
}

const FAQS = [
  {
    q: 'How does ShipIQ work? · كيف يعمل شيب آي كيو؟',
    a: 'ShipIQ is a personal shopping service. Share a product link, we buy it on your behalf, and ship it directly to your door in Iraq. · شيب آي كيو خدمة تسوق شخصي. أرسل رابط المنتج ونحن نشتريه ونشحنه مباشرة إلى بيتك في العراق.',
  },
  {
    q: 'Which countries do you ship from? · من أي دول تشحنون؟',
    a: 'We currently ship from the USA 🇺🇸, Turkey 🇹🇷, UAE 🇦🇪, and China 🇨🇳. More countries are coming soon!',
  },
  {
    q: 'How is shipping cost calculated? · كيف تحسبون تكلفة الشحن؟',
    a: 'Shipping is based on the billable weight (actual or dimensional weight, whichever is higher) multiplied by the per-kg rate for your country. Use our calculator for an instant estimate.',
  },
  {
    q: 'How long does delivery take? · كم يستغرق التوصيل؟',
    a: 'USA: 10–20 days · Turkey: 7–14 days · UAE: 5–10 days · China: 14–30 days. Times may vary depending on customs and local delivery conditions.',
  },
  {
    q: 'How do I pay? · كيف أدفع؟',
    a: 'We accept FIB (First Iraqi Bank), QiCard, and cash on delivery for Erbil and Baghdad. Payment details will be confirmed after your order is reviewed.',
  },
  {
    q: 'Is there a minimum order? · هل هناك حد أدنى للطلب؟',
    a: 'No minimum order! Very small/light items may have a minimum shipping fee. Contact us on WhatsApp for details. · لا يوجد حد أدنى! تواصل معنا على واتساب للتفاصيل.',
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq]   = useState<number | null>(null)

  // Scroll animation refs
  const statsRef     = useInView()
  const howRef       = useInView()
  const countriesRef = useInView()
  const calcRef      = useInView()
  const storesRef    = useInView()
  const whyRef       = useInView()
  const faqRef       = useInView()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard')
      } else {
        setLoggedIn(false)
      }
    })
  }, [])

  // Don't render landing content until we know the user isn't logged in
  if (loggedIn === null) return null

  return (
    <div>
      {/* ── NAVBAR ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <a href="#top" className={styles.navLogo}>ShipIQ</a>

          <div className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}>
            <a href="#how-it-works" className={styles.navLink} onClick={() => setMenuOpen(false)}>How it Works</a>
            <Link href="/calculator"  className={styles.navLink} onClick={() => setMenuOpen(false)}>Calculator</Link>
            <a href="#stores"         className={styles.navLink} onClick={() => setMenuOpen(false)}>Stores</a>
            <a href="#faq"            className={styles.navLink} onClick={() => setMenuOpen(false)}>FAQ</a>
          </div>

          <div className={styles.navActions}>
            {loggedIn ? (
              <Link href="/dashboard" className={styles.btnGold}>Go to Dashboard</Link>
            ) : (
              <>
                <Link href="/auth" className={styles.btnGhost}>Sign In</Link>
                <Link href="/auth" className={styles.btnGold}>Sign Up Free</Link>
              </>
            )}
          </div>

          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section id="top" className={styles.hero}>
        <div className={styles.floatingFlags} aria-hidden>
          <span className={`${styles.flag} ${styles.flag1}`}>🇺🇸</span>
          <span className={`${styles.flag} ${styles.flag2}`}>🇹🇷</span>
          <span className={`${styles.flag} ${styles.flag3}`}>🇦🇪</span>
          <span className={`${styles.flag} ${styles.flag4}`}>🇨🇳</span>
          <span className={`${styles.flag} ${styles.flag5}`}>🇮🇶</span>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>🇮🇶 Delivering to Erbil &amp; Baghdad</div>

          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleEn}>Shop Global</span>
            <span className={styles.heroTitleDot}>·</span>
            <span className={styles.heroTitleAr}>تسوق عالمياً</span>
          </h1>

          <p className={styles.heroSub}>
            Delivered to Your Door in Iraq&nbsp;
            <span className="ar">· توصيل إلى بابك في العراق</span>
          </p>

          <div className={styles.heroCtas}>
            <Link href="/auth" className={styles.ctaPrimary}>
              Get Started Free · <span className="ar">ابدأ مجاناً</span>
            </Link>
            <a href="#calculator" className={styles.ctaSecondary}>
              Calculate Shipping ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div ref={statsRef.ref} className={`${styles.statsBar} ${statsRef.inView ? styles.visible : ''}`}>
        {[
          { icon: '🇮🇶', label: 'Serving Erbil & Baghdad' },
          { icon: '🌍', label: '4 Countries' },
          { icon: '⚡', label: 'Instant Estimates' },
          { icon: '📦', label: 'Full Tracking' },
        ].map((s, i) => (
          <div key={i} className={styles.statItem}>
            <span className={styles.statIcon}>{s.icon}</span>
            <span className={styles.statText}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className={styles.section}>
        <div ref={howRef.ref} className={`${styles.sectionInner} ${howRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              How It Works · <span className="ar">كيف يعمل</span>
            </h2>
            <p className={styles.sectionSub}>Three simple steps to get anything delivered to Iraq</p>
          </div>

          <div className={styles.stepsGrid}>
            {[
              { num: '1', icon: '🔗', en: 'Submit a Link',  ar: 'أرسل الرابط',   desc: 'Find any product you want and paste the link — we take it from there.' },
              { num: '2', icon: '💰', en: 'Get a Price',    ar: 'احصل على السعر', desc: 'We calculate your shipping cost instantly. No hidden fees, ever.' },
              { num: '3', icon: '📦', en: 'We Deliver',     ar: 'نوصل لك',        desc: 'Sit back and relax. Your package arrives at your door in Iraq.' },
            ].map((step, i) => (
              <div key={i} className={styles.stepCard}>
                <div className={styles.stepNum}>{step.num}</div>
                <div className={styles.stepIcon}>{step.icon}</div>
                <h3 className={styles.stepTitle}>
                  {step.en} · <span className="ar">{step.ar}</span>
                </h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SUPPORTED COUNTRIES ── */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div ref={countriesRef.ref} className={`${styles.sectionInner} ${countriesRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              We Ship From · <span className="ar">نشحن من</span>
            </h2>
            <p className={styles.sectionSub}>4 countries, 27+ stores — all delivered to Iraq</p>
          </div>

          <div className={styles.countriesGrid}>
            {COUNTRY_CARDS.map((c, i) => (
              <div
                key={i}
                className={styles.countryCard}
                style={{ '--accent': c.accentColor } as React.CSSProperties}
              >
                <div className={styles.countryFlag}>{c.flag}</div>
                <div className={styles.countryName}>
                  {c.name} <span className="ar">· {c.nameAr}</span>
                </div>
                <div className={styles.countryStoreLogos}>
                  {c.domains.slice(0, 3).map((domain, j) => (
                    <StoreLogo key={j} domain={domain} emoji={c.emojis[j]} size={30} />
                  ))}
                </div>
                <div className={styles.countryStoreName}>{c.stores.join(' · ')}</div>
                <div className={styles.countryMeta}>
                  <div className={styles.countryDelivery}>⏱ {c.delivery}</div>
                  <div className={styles.countryRate}>{c.rate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CALCULATOR ── */}
      <section id="calculator" className={styles.section}>
        <div ref={calcRef.ref} className={`${styles.sectionInner} ${calcRef.inView ? styles.visible : ''}`}>
          <ShippingCalculator />
        </div>
      </section>

      {/* ── SUPPORTED STORES ── */}
      <section id="stores" className={`${styles.section} ${styles.sectionAlt}`}>
        <div ref={storesRef.ref} className={`${styles.sectionInner} ${storesRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              27+ Supported Stores · <span className="ar">متاجر مدعومة</span>
            </h2>
            <p className={styles.sectionSub}>
              Shop from your favourite stores worldwide — we handle everything
            </p>
          </div>

          {Object.entries(STORES_BY_COUNTRY).map(([countryLabel, stores]) => (
            <div key={countryLabel} className={styles.storesGroup}>
              <div className={styles.storesGroupTitle}>{countryLabel}</div>
              <div className={styles.storesLogoGrid}>
                {stores.map((store, i) => (
                  <div key={i} className={styles.storeLogoCard}>
                    <StoreLogo domain={store.domain} emoji={store.emoji} size={36} />
                    <span className={styles.storeLogoName}>{store.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY SHIPIQ ── */}
      <section className={styles.section}>
        <div ref={whyRef.ref} className={`${styles.sectionInner} ${whyRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              Why ShipIQ · <span className="ar">لماذا شيب آي كيو</span>
            </h2>
          </div>

          <div className={styles.whyGrid}>
            {[
              { icon: '⚡', en: 'Instant Estimates',  ar: 'تقديرات فورية',      desc: 'Know the exact price before you commit — no surprises or hidden fees.' },
              { icon: '🔍', en: 'Full Transparency',  ar: 'شفافية كاملة',       desc: 'Every fee is shown upfront. What you see is exactly what you pay.' },
              { icon: '📱', en: 'Easy Tracking',      ar: 'تتبع سهل',           desc: 'Track your shipment every step of the way, from purchase to your door.' },
              { icon: '🇮🇶', en: 'Iraq Specialists',  ar: 'متخصصون في العراق',  desc: 'We know Iraqi customs and local delivery — Erbil & Baghdad covered.' },
            ].map((f, i) => (
              <div key={i} className={styles.whyCard}>
                <div className={styles.whyIcon}>{f.icon}</div>
                <h3 className={styles.whyTitle}>
                  {f.en} · <span className="ar">{f.ar}</span>
                </h3>
                <p className={styles.whyDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className={`${styles.section} ${styles.sectionAlt}`}>
        <div ref={faqRef.ref} className={`${styles.sectionInner} ${faqRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              FAQ · <span className="ar">أسئلة شائعة</span>
            </h2>
            <p className={styles.sectionSub}>Everything you need to know before you ship</p>
          </div>

          <div className={styles.faqList}>
            {FAQS.map((faq, i) => (
              <div key={i} className={`${styles.faqItem} ${openFaq === i ? styles.faqOpen : ''}`}>
                <button className={styles.faqQ} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{faq.q}</span>
                  <span className={styles.faqChevron}>▼</span>
                </button>
                <div className={styles.faqA}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>ShipIQ</div>
              <div className={styles.footerTagline}>شيب آي كيو — خدمة الشحن الذكي</div>
              <div className={styles.footerLocation}>Erbil &amp; Baghdad, Iraq 🇮🇶</div>
              <a href="https://wa.me/9647XXXXXXXXX" className={styles.footerWhatsapp}>
                💬 WhatsApp: +964 7XX XXX XXXX
              </a>
            </div>

            <div className={styles.footerLinks}>
              <Link href="/auth">Sign Up</Link>
              <a href="#how-it-works">How it Works</a>
              <Link href="/calculator">Calculator</Link>
              <a href="#stores">Stores</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>

          <div className={styles.footerBottom}>
            © 2025 ShipIQ · <span className="ar">جميع الحقوق محفوظة</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
