'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import ShippingCalculator from './dashboard/components/ShippingCalculator'
import FAQChatbot from './dashboard/components/FAQChatbot'
import ThemeToggle from '@/components/ThemeToggle'
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
      loading="lazy"
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
    if (!el) { return }
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  })

  return { ref, inView }
}

// ── Animated cycling hero text ────────────────────────────────────────────────

const HERO_STORES = ['Amazon', 'Trendyol', 'Noon', 'AliExpress', 'eBay']

function CyclingText() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % HERO_STORES.length)
        setVisible(true)
      }, 300)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <span style={{
      display: 'inline-block',
      color: 'var(--gold)',
      fontWeight: 800,
      minWidth: 140,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.3s, transform 0.3s',
    }}>
      {HERO_STORES[idx]}
    </span>
  )
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
    { domain: 'amazon.com', emoji: '🛒', name: 'Amazon' },
    { domain: 'ebay.com', emoji: '🏷️', name: 'eBay' },
    { domain: 'bestbuy.com', emoji: '🖥️', name: 'Best Buy' },
    { domain: 'newegg.com', emoji: '💻', name: 'Newegg' },
    { domain: 'bhphotovideo.com', emoji: '📷', name: 'B&H Photo' },
    { domain: 'walmart.com', emoji: '🏪', name: 'Walmart' },
    { domain: 'target.com', emoji: '🎯', name: 'Target' },
    { domain: 'macys.com', emoji: '🛍️', name: "Macy's" },
    { domain: 'nike.com', emoji: '👟', name: 'Nike' },
    { domain: 'adidas.com', emoji: '👟', name: 'Adidas' },
    { domain: 'sephora.com', emoji: '💄', name: 'Sephora' },
    { domain: 'iherb.com', emoji: '🌿', name: 'iHerb' },
  ],
  '🇹🇷 Turkey': [
    { domain: 'trendyol.com', emoji: '🛍️', name: 'Trendyol' },
    { domain: 'hepsiburada.com', emoji: '🛒', name: 'Hepsiburada' },
    { domain: 'n11.com', emoji: '🏪', name: 'N11' },
    { domain: 'lcwaikiki.com', emoji: '👕', name: 'LC Waikiki' },
    { domain: 'mavi.com', emoji: '👖', name: 'Mavi' },
  ],
  '🇦🇪 UAE': [
    { domain: 'amazon.ae', emoji: '🛒', name: 'Amazon AE' },
    { domain: 'noon.com', emoji: '🌙', name: 'Noon' },
    { domain: 'boutiqaat.com', emoji: '💄', name: 'Boutiqaat' },
    { domain: 'namshi.com', emoji: '👗', name: 'Namshi' },
    { domain: 'sharafdg.com', emoji: '📱', name: 'Sharaf DG' },
    { domain: 'brandsforless.ae', emoji: '🏷️', name: 'Brands for Less' },
  ],
  '🇨🇳 China': [
    { domain: 'aliexpress.com', emoji: '📦', name: 'AliExpress' },
    { domain: 'shein.com', emoji: '👗', name: 'Shein' },
    { domain: 'banggood.com', emoji: '🔧', name: 'Banggood' },
    { domain: 'dhgate.com', emoji: '🏭', name: 'DHgate' },
    { domain: 'zaful.com', emoji: '👙', name: 'Zaful' },
  ],
}

const TESTIMONIALS = [
  {
    stars: '⭐⭐⭐⭐⭐',
    text: 'Ordered a laptop from Amazon US — arrived in Erbil in 14 days, perfectly packaged. The shipping estimate was spot on. Will definitely use again!',
    author: 'Ahmed K.',
    city: 'Erbil, Iraq',
  },
  {
    stars: '⭐⭐⭐⭐⭐',
    text: 'أفضل خدمة شحن استخدمتها. اشتريت ملابس من تريندول ووصلت بحالة ممتازة. الأسعار واضحة ولا رسوم مخفية.',
    author: 'Sara M.',
    city: 'Baghdad, Iraq',
  },
  {
    stars: '⭐⭐⭐⭐⭐',
    text: 'Fast communication, transparent pricing, and the package arrived earlier than expected. ShipIQ made international shopping stress-free.',
    author: 'Omar H.',
    city: 'Erbil, Iraq',
  },
]

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

// ── JSON-LD structured data ───────────────────────────────────────────────────

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'ShipIQ',
  description: "Iraq's smartest personal shopping and shipping service. Shop from 27+ global stores, delivered to Erbil & Baghdad.",
  url: 'https://shipiq1.vercel.app',
  areaServed: ['Erbil', 'Baghdad', 'Iraq'],
  serviceType: 'Personal Shopping & International Shipping',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq]   = useState<number | null>(null)
  const [pastHero, setPastHero] = useState(false)

  // Scroll animation refs
  const statsRef        = useInView()
  const howRef          = useInView()
  const countriesRef    = useInView()
  const calcRef         = useInView()
  const storesRef       = useInView()
  const whyRef          = useInView()
  const testimonialRef  = useInView()
  const compareRef      = useInView()
  const faqRef          = useInView()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { router.replace('/dashboard') } else { setLoggedIn(false) }
    })
  }, [router])

  // Sticky CTA: show after scrolling past hero (approx 100vh)
  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.7)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (loggedIn === null) return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />

  return (
    <div>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── NAVBAR ── */}
      <nav className={styles.nav} role="navigation" aria-label="Main navigation">
        <div className={styles.navInner}>
          <a href="#top" className={styles.navLogo} aria-label="ShipIQ home">ShipIQ</a>

          <div className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}>
            <a href="#how-it-works" className={styles.navLink} onClick={() => setMenuOpen(false)}>How it Works</a>
            <Link href="/calculator"  className={styles.navLink} onClick={() => setMenuOpen(false)}>Calculator</Link>
            <a href="#stores"         className={styles.navLink} onClick={() => setMenuOpen(false)}>Stores</a>
            <a href="#faq"            className={styles.navLink} onClick={() => setMenuOpen(false)}>FAQ</a>
          </div>

          <div className={styles.navActions}>
            <ThemeToggle />
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
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section id="top" className={styles.hero} aria-label="Hero">
        <div className={styles.floatingFlags} aria-hidden="true">
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
            Shop from <CyclingText /> and get it delivered to Iraq&nbsp;
            <span className="ar">· توصيل إلى بابك</span>
          </p>

          <div className={styles.heroCtas}>
            <Link href="/auth" className={styles.ctaPrimary} aria-label="Get started with ShipIQ for free">
              Get Started Free · <span className="ar">ابدأ مجاناً</span>
            </Link>
            <a href="#calculator" className={styles.ctaSecondary} aria-label="Calculate shipping cost">
              Calculate Shipping ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── STICKY CTA ── */}
      {pastHero && !loggedIn && (
        <Link href="/auth" className={styles.stickyCta} aria-label="Get started with ShipIQ">
          🚀 Get Started Free
        </Link>
      )}

      {/* ── SOCIAL PROOF NUMBERS ── */}
      <div className={`${styles.socialProofBar} ${statsRef.inView ? styles.visible : ''}`} ref={statsRef.ref}>
        {[
          { num: '500+', label: 'Happy Customers' },
          { num: '4',    label: 'Countries' },
          { num: '10K+', label: 'Orders Delivered' },
          { num: '27+',  label: 'Stores Supported' },
        ].map((p, i) => (
          <div key={i} className={styles.proofItem}>
            <div className={styles.proofNum}>{p.num}</div>
            <div className={styles.proofLabel}>{p.label}</div>
          </div>
        ))}
      </div>

      {/* ── STATS BAR ── */}
      <div className={`${styles.statsBar} ${statsRef.inView ? styles.visible : ''}`}>
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
      <section id="how-it-works" className={styles.section} aria-labelledby="how-title">
        <div ref={howRef.ref} className={`${styles.sectionInner} ${howRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 id="how-title" className={styles.sectionTitle}>
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
      <section className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="countries-title">
        <div ref={countriesRef.ref} className={`${styles.sectionInner} ${countriesRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 id="countries-title" className={styles.sectionTitle}>
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
      <section id="calculator" className={styles.section} aria-label="Shipping calculator">
        <div ref={calcRef.ref} className={`${styles.sectionInner} ${calcRef.inView ? styles.visible : ''}`}>
          <ShippingCalculator />
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="reviews-title">
        <div ref={testimonialRef.ref} className={`${styles.sectionInner} ${testimonialRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 id="reviews-title" className={styles.sectionTitle}>
              What Customers Say · <span className="ar">آراء العملاء</span>
            </h2>
            <p className={styles.sectionSub}>Real reviews from real customers across Iraq</p>
          </div>
          <div className={styles.testimonialsGrid}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className={styles.testimonialCard}>
                <div className={styles.testimonialStars}>{t.stars}</div>
                <p className={styles.testimonialText}>&ldquo;{t.text}&rdquo;</p>
                <div className={styles.testimonialAuthor}>{t.author}</div>
                <div className={styles.testimonialCity}>{t.city}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW WE COMPARE ── */}
      <section className={styles.section} aria-labelledby="compare-title">
        <div ref={compareRef.ref} className={`${styles.sectionInner} ${compareRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 id="compare-title" className={styles.sectionTitle}>
              How We Compare · <span className="ar">مقارنة مع غيرنا</span>
            </h2>
            <p className={styles.sectionSub}>See why ShipIQ is Iraq&apos;s preferred shipping service</p>
          </div>
          <div className={styles.compareWrap}>
            <table className={styles.compareTable}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className={styles.compareHighlight}>ShipIQ ✨</th>
                  <th>Other Forwarders</th>
                  <th>Buying Agents</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Instant price estimate',       '✓', '✗', '✗'],
                  ['No hidden fees',               '✓', '✗', '?'],
                  ['Real-time tracking',           '✓', '?', '✗'],
                  ['Home delivery (Erbil & BGD)',  '✓', '✗', '✗'],
                  ['Online dashboard',             '✓', '✗', '✗'],
                  ['Wishlist & save items',        '✓', '✗', '✗'],
                  ['FIB / QiCard payment',         '✓', '?', '?'],
                  ['No minimum order',             '✓', '✓', '✗'],
                ].map(([feature, us, forwarder, agent], i) => (
                  <tr key={i}>
                    <td>{feature}</td>
                    <td className={styles.compareHighlight}>
                      <span className={us === '✓' ? styles.checkYes : styles.checkNo}>{us}</span>
                    </td>
                    <td><span className={forwarder === '✓' ? styles.checkYes : styles.checkNo}>{forwarder}</span></td>
                    <td><span className={agent === '✓' ? styles.checkYes : styles.checkNo}>{agent}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── SUPPORTED STORES ── */}
      <section id="stores" className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="stores-title">
        <div ref={storesRef.ref} className={`${styles.sectionInner} ${storesRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 id="stores-title" className={styles.sectionTitle}>
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
      <section className={styles.section} aria-labelledby="why-title">
        <div ref={whyRef.ref} className={`${styles.sectionInner} ${whyRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 id="why-title" className={styles.sectionTitle}>
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
      <section id="faq" className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="faq-title">
        <div ref={faqRef.ref} className={`${styles.sectionInner} ${faqRef.inView ? styles.visible : ''}`}>
          <div className={styles.sectionHeader}>
            <h2 id="faq-title" className={styles.sectionTitle}>
              FAQ · <span className="ar">أسئلة شائعة</span>
            </h2>
            <p className={styles.sectionSub}>Everything you need to know before you ship</p>
          </div>

          <div className={styles.faqList}>
            {FAQS.map((faq, i) => (
              <div key={i} className={`${styles.faqItem} ${openFaq === i ? styles.faqOpen : ''}`}>
                <button
                  className={styles.faqQ}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-answer-${i}`}
                >
                  <span>{faq.q}</span>
                  <span className={styles.faqChevron} aria-hidden="true">▼</span>
                </button>
                <div id={`faq-answer-${i}`} className={styles.faqA} role="region">
                  {faq.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer} role="contentinfo">
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>ShipIQ</div>
              <div className={styles.footerTagline}>شيب آي كيو — خدمة الشحن الذكي</div>
              <div className={styles.footerLocation}>Erbil &amp; Baghdad, Iraq 🇮🇶</div>
              <a href="https://wa.me/9647XXXXXXXXX" className={styles.footerWhatsapp} aria-label="Contact us on WhatsApp">
                💬 WhatsApp: +964 7XX XXX XXXX
              </a>
              <div className={styles.socialLinks}>
                <a href="https://instagram.com/shipiq.iq" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="ShipIQ on Instagram">
                  📸 @shipiq.iq
                </a>
                <a href="https://t.me/shipiq" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="ShipIQ on Telegram">
                  ✈️ Telegram
                </a>
              </div>
            </div>

            <div className={styles.footerLinks}>
              <Link href="/auth">Sign Up</Link>
              <a href="#how-it-works">How it Works</a>
              <Link href="/calculator">Calculator</Link>
              <a href="#stores">Stores</a>
              <a href="#faq">FAQ</a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ThemeToggle />
            </div>
          </div>

          <div className={styles.footerBottom}>
            © 2025 ShipIQ · <span className="ar">جميع الحقوق محفوظة</span>
          </div>
        </div>
      </footer>

      <FAQChatbot />
    </div>
  )
}
