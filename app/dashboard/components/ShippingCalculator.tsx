'use client'
import { useState, useEffect } from 'react'
import styles from './ShippingCalculator.module.css'
import { getPricingConfig } from '@/lib/api'
import {
  calculatePricing, defaultConfig,
  type CountryPricingConfig, type OriginCountry, type PricingCategory, type PricingBreakdown,
} from '@/lib/pricing'

const DELIVERY_OPTIONS = [
  { id: 'pickup',       label: 'Pickup at office',          sub: 'Free · مجاناً',             feeIqd: 0    },
  { id: 'home_erbil',   label: 'Home delivery — Erbil',     sub: '3,000 IQD',                  feeIqd: 3000 },
  { id: 'home_baghdad', label: 'Home delivery — Baghdad',   sub: '5,000 IQD',                  feeIqd: 5000 },
  { id: 'other',        label: 'Other city',                 sub: 'Contact us · تواصل معنا',    feeIqd: null },
] as const

const CATEGORY_OPTIONS: { id: PricingCategory; label: string }[] = [
  { id: 'clothing',     label: '👗 Clothing & Fashion' },
  { id: 'cosmetics',    label: '💄 Cosmetics & Beauty' },
  { id: 'supplements',  label: '💊 Supplements & Vitamins' },
  { id: 'electronics',  label: '📱 Electronics' },
  { id: 'accessories',  label: '💍 Accessories & Jewelry' },
  { id: 'uncategorized', label: '📦 Other' },
]

const FALLBACK_FX = { iqd: 1540, EUR: 0.92, GBP: 0.79, TRY: 32.5, AED: 3.67 }
const WA_URL = 'https://wa.me/9647XXXXXXXXX'

type Unit = 'metric' | 'imperial'
type Currency = 'USD' | 'EUR' | 'GBP' | 'TRY' | 'AED'
interface FxRates { iqd: number; EUR: number; GBP: number; TRY: number; AED: number }

interface CalcResult {
  breakdown: PricingBreakdown
  billableKg: number
  deliveryFeeUsd: number | null
  deliveryContactOnly: boolean
  iqdPerUsd: number
}

function convertVal(val: string, factor: number, dec: number): string {
  if (!val) return ''
  const n = parseFloat(val)
  return isNaN(n) ? '' : (n * factor).toFixed(dec)
}

function toUsd(price: number, currency: Currency, fx: FxRates): number {
  if (currency === 'USD') return price
  if (currency === 'EUR') return price / fx.EUR
  if (currency === 'GBP') return price / fx.GBP
  if (currency === 'TRY') return price / fx.TRY
  if (currency === 'AED') return price / fx.AED
  return price
}

export default function ShippingCalculator() {
  const [unit, setUnit]             = useState<Unit>('metric')
  const [country, setCountry]       = useState<OriginCountry>('UAE')
  const [category, setCategory]     = useState<PricingCategory>('uncategorized')
  const [qty, setQty]               = useState('1')
  const [weight, setWeight]         = useState('')
  const [length, setLength]         = useState('')
  const [width, setWidth]           = useState('')
  const [height, setHeight]         = useState('')
  const [itemPrice, setItemPrice]   = useState('')
  const [itemCurrency, setItemCurrency] = useState<Currency>('USD')
  const [insurance, setInsurance]   = useState(false)
  const [delivery, setDelivery]     = useState('pickup')
  const [result, setResult]         = useState<CalcResult | null>(null)
  const [fx, setFx]                 = useState<FxRates>(FALLBACK_FX)

  // Pricing config — single source of truth, read from Supabase (shared with the app).
  const [configs, setConfigs] = useState<Record<OriginCountry, CountryPricingConfig> | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRates() {
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
      } catch { /* use fallback */ }
    }
    loadRates()

    getPricingConfig().then(({ configs, error }) => {
      const map = {} as Record<OriginCountry, CountryPricingConfig>
      for (const c of configs) map[c.country] = c
      setConfigs(map)
      setConfigError(error)
    })
  }, [])

  function switchUnit(next: Unit) {
    if (next === unit) return
    const toImp = next === 'imperial'
    const wf = toImp ? 2.20462 : 1 / 2.20462
    const df = toImp ? 1 / 2.54 : 2.54
    setWeight(v => convertVal(v, wf, 2))
    setLength(v => convertVal(v, df, 1))
    setWidth(v  => convertVal(v, df, 1))
    setHeight(v => convertVal(v, df, 1))
    setUnit(next)
    setResult(null)
  }

  function reset() {
    setUnit('metric'); setCountry('UAE'); setCategory('uncategorized'); setQty('1')
    setWeight(''); setLength(''); setWidth(''); setHeight('')
    setItemPrice(''); setItemCurrency('USD'); setInsurance(false); setDelivery('pickup')
    setResult(null)
  }

  function calculate() {
    const w = parseFloat(weight)
    if (!w || w <= 0) return

    // Normalize the entered weight/dims to kg, then let the engine convert to the
    // country's billing unit — keeps all the pricing math in one place.
    const actualKg = unit === 'metric' ? w : w / 2.20462
    const l = parseFloat(length); const wi = parseFloat(width); const h = parseFloat(height)
    let dimKg = 0
    if (l > 0 && wi > 0 && h > 0) {
      const cm = unit === 'metric' ? 1 : 2.54
      dimKg = (l * cm) * (wi * cm) * (h * cm) / 5000
    }
    const billableKgPerItem = Math.max(actualKg, dimKg)
    const quantity = Math.max(1, parseInt(qty) || 1)

    const priceNum = parseFloat(itemPrice)
    const itemPriceUsd = !isNaN(priceNum) && priceNum > 0 ? toUsd(priceNum, itemCurrency, fx) : null

    const config = configs?.[country] ?? defaultConfig(country)
    const breakdown = calculatePricing(config, {
      billableWeightKg: billableKgPerItem,
      qty: quantity,
      category,
      itemPrice: itemPriceUsd,
      insuranceOptIn: insurance,
    })

    const deliveryOpt = DELIVERY_OPTIONS.find(d => d.id === delivery)
    const deliveryFeeIqd = deliveryOpt?.feeIqd ?? null
    const deliveryFeeUsd = deliveryFeeIqd !== null ? deliveryFeeIqd / fx.iqd : null

    setResult({
      breakdown,
      billableKg: Math.round(billableKgPerItem * quantity * 100) / 100,
      deliveryFeeUsd,
      deliveryContactOnly: deliveryFeeIqd === null,
      iqdPerUsd: fx.iqd,
    })
  }

  const wLabel  = unit === 'metric' ? 'Weight (kg)' : 'Weight (lbs)'
  const dimUnit = unit === 'metric' ? 'cm' : 'in'

  // Display helpers — engine amounts are in the config currency (USD by default).
  const money = (n: number) => `$${n.toFixed(2)}`

  // Grand total shown to the customer = engine total + Iraq delivery (a separate add-on).
  const b = result?.breakdown
  const deliveryAdd = result && !result.deliveryContactOnly ? (result.deliveryFeeUsd ?? 0) : 0
  const grandTotalUsd = b ? b.total + deliveryAdd : 0

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          <div style={{ textAlign: 'center' }}>
            <div>Calculate Your Shipping</div>
            <div style={{ color: 'var(--gold)' }}>احسب تكلفة شحنك</div>
          </div>
        </h2>
        <p className={styles.subtitle}>
          Get a full cost estimate — item price, shipping, service fee, customs &amp; insurance
        </p>
      </div>

      {configError && (
        <div style={{ marginBottom: 20, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          ⚠️ Live rates are still being set up — totals may show as $0 until configured.
        </div>
      )}

      {/* Unit toggle */}
      <div className={styles.unitToggleWrap}>
        <div className={styles.unitToggle}>
          <button className={`${styles.unitBtn} ${unit === 'metric' ? styles.unitActive : ''}`} onClick={() => switchUnit('metric')}>
            Metric (kg / cm)
          </button>
          <button className={`${styles.unitBtn} ${unit === 'imperial' ? styles.unitActive : ''}`} onClick={() => switchUnit('imperial')}>
            Imperial (lbs / in)
          </button>
        </div>
      </div>

      {/* Item Price */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>
            Item Price
            <span className={styles.optional}>— Optional</span>
            <span className={styles.labelAr}>سعر المنتج · اختياري</span>
          </label>
          <input
            className={styles.input}
            type="number"
            placeholder="e.g. 120.00"
            min="0"
            step="0.01"
            value={itemPrice}
            onChange={e => { setItemPrice(e.target.value); setResult(null) }}
          />
        </div>
        <div className={styles.field} style={{ maxWidth: 130 }}>
          <label className={styles.label}>
            Currency
            <span className={styles.labelAr}>العملة</span>
          </label>
          <select className={styles.select} value={itemCurrency} onChange={e => { setItemCurrency(e.target.value as Currency); setResult(null) }}>
            <option value="USD">USD — دولار</option>
            <option value="EUR">EUR — يورو</option>
            <option value="GBP">GBP — جنيه</option>
            <option value="TRY">TRY — ليرة</option>
            <option value="AED">AED — درهم</option>
          </select>
        </div>
      </div>

      {/* Country + Category */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>
            Origin Country
            <span className={styles.labelAr}>الدولة</span>
          </label>
          <select className={styles.select} value={country} onChange={e => { setCountry(e.target.value as OriginCountry); setResult(null) }}>
            <option value="USA">🇺🇸 USA — أمريكا</option>
            <option value="Turkey">🇹🇷 Turkey — تركيا</option>
            <option value="UAE">🇦🇪 UAE — الإمارات</option>
            <option value="China">🇨🇳 China — الصين</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>
            Product Category
            <span className={styles.labelAr}>الفئة</span>
          </label>
          <select className={styles.select} value={category} onChange={e => { setCategory(e.target.value as PricingCategory); setResult(null) }}>
            {CATEGORY_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Weight + Quantity */}
      <div className={styles.row}>
        <div className={styles.field} style={{ maxWidth: 200 }}>
          <label className={styles.label}>
            {wLabel} <span className={styles.optional}>per item</span>
            <span className={styles.labelAr}>الوزن لكل قطعة</span>
          </label>
          <input
            className={styles.input}
            type="number"
            placeholder={unit === 'metric' ? 'e.g. 1.5' : 'e.g. 3.3'}
            min="0.01"
            step="0.01"
            value={weight}
            onChange={e => { setWeight(e.target.value); setResult(null) }}
            onKeyDown={e => e.key === 'Enter' && calculate()}
          />
        </div>
        <div className={styles.field} style={{ maxWidth: 110 }}>
          <label className={styles.label}>
            Quantity
            <span className={styles.labelAr}>الكمية</span>
          </label>
          <input
            className={styles.input}
            type="number"
            min="1"
            step="1"
            value={qty}
            onChange={e => { setQty(e.target.value); setResult(null) }}
          />
        </div>
        <div className={styles.airBadge}>✈️ Air Freight</div>
      </div>

      {/* Dimensions */}
      <div className={styles.dimSection}>
        <div className={styles.dimLabel}>
          Dimensions ({dimUnit})
          <span className={styles.tooltip} title="Dimensional weight = (L × W × H) ÷ 5000">ℹ️</span>
          <span className={styles.optional}>— Optional</span>
          <span className={styles.labelAr}>الأبعاد · اختياري</span>
        </div>
        <div className={styles.dimInputs}>
          <div className={styles.dimField}>
            <input className={styles.input} type="number" placeholder="Length" min="0" step="0.1" value={length} onChange={e => { setLength(e.target.value); setResult(null) }} />
            <span className={styles.dimLetter}>L</span>
          </div>
          <span className={styles.dimX}>×</span>
          <div className={styles.dimField}>
            <input className={styles.input} type="number" placeholder="Width" min="0" step="0.1" value={width} onChange={e => { setWidth(e.target.value); setResult(null) }} />
            <span className={styles.dimLetter}>W</span>
          </div>
          <span className={styles.dimX}>×</span>
          <div className={styles.dimField}>
            <input className={styles.input} type="number" placeholder="Height" min="0" step="0.1" value={height} onChange={e => { setHeight(e.target.value); setResult(null) }} />
            <span className={styles.dimLetter}>H</span>
          </div>
          <span className={styles.dimUnitBadge}>{dimUnit}</span>
        </div>
        <div className={styles.dimHint}>
          Dimensional weight = (L × W × H) ÷ 5000 &nbsp;·&nbsp; Billable = max(actual, dimensional)
        </div>
      </div>

      {/* Insurance opt-in */}
      <div
        onClick={() => { setInsurance(v => !v); setResult(null) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 20, cursor: 'pointer',
          background: insurance ? 'rgba(201,168,76,0.07)' : 'var(--surface2)',
          border: `1px solid ${insurance ? 'rgba(201,168,76,0.35)' : 'var(--border)'}`, borderRadius: 10,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
          background: insurance ? 'var(--gold)' : 'transparent',
          border: `2px solid ${insurance ? 'var(--gold)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f0e0c', fontSize: 13, fontWeight: 800,
        }}>
          {insurance && '✓'}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>🛡️ Add shipment insurance · إضافة تأمين</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>A percentage of your item price · نسبة من سعر المنتج</div>
        </div>
      </div>

      {/* Delivery in Iraq */}
      <div style={{ marginBottom: 28 }}>
        <div className={styles.dimLabel}>
          Delivery in Iraq
          <span className={styles.labelAr}>التوصيل في العراق</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {DELIVERY_OPTIONS.map((opt, i) => (
            <label
              key={opt.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
                borderBottom: i < DELIVERY_OPTIONS.length - 1 ? '1px solid var(--border)' : 'none',
                background: delivery === opt.id ? 'rgba(201,168,76,0.07)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <input
                type="radio" name="calcDelivery" value={opt.id}
                checked={delivery === opt.id}
                onChange={() => { setDelivery(opt.id); setResult(null) }}
                style={{ accentColor: 'var(--gold)', width: 16, height: 16, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: opt.feeIqd === 0 ? 'var(--green)' : 'var(--text-dim)', marginTop: 1 }}>{opt.sub}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className={styles.actions}>
        <button className={styles.calcBtn} onClick={calculate} disabled={!weight}>
          Calculate · احسب
        </button>
        <button className={styles.resetBtn} onClick={reset}>
          Reset · إعادة
        </button>
      </div>

      {/* Result */}
      {result && b && (
        <div className={styles.result} style={{ textAlign: 'left', padding: '24px 28px', marginTop: 28 }}>

          <div className={styles.resultLabel} style={{ textAlign: 'center', marginBottom: 18 }}>
            📦 Full Cost Estimate · تقدير التكلفة الكاملة
          </div>

          {/* Breakdown rows */}
          <div style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 16 }}>

            {b.itemPrice != null && (
              <Row label="Item Price · سعر المنتج" value={money(b.itemPrice)} />
            )}

            {b.shipping != null
              ? <Row label="Shipping · الشحن" value={money(b.shipping)} valueColor="var(--gold)" />
              : <RowNote label="Shipping · الشحن" note="Rates not set yet — contact us · تواصل معنا" />
            }

            {/* Service fee */}
            {b.serviceFee != null ? (
              <Row label="Service Fee · رسوم الخدمة" value={money(b.serviceFee)} />
            ) : (
              <RowNote label="Service Fee · رسوم الخدمة" note={b.serviceFeeMessage ?? 'Enter item price'} />
            )}

            {/* Customs */}
            <Row label="Customs · الجمارك" value={money(b.customs)} />

            {/* Insurance (only when opted in) */}
            {b.insuranceOptIn && (
              b.insurance != null
                ? <Row label="Insurance · التأمين" value={money(b.insurance)} />
                : <RowNote label="Insurance · التأمين" note={b.insuranceMessage ?? 'Enter item price'} />
            )}

            {/* Iraq delivery (separate add-on, not part of the engine) */}
            <Row
              label="Iraq Delivery · التوصيل"
              value={result.deliveryContactOnly ? 'Contact us' : (result.deliveryFeeUsd === 0 ? 'Free' : money(result.deliveryFeeUsd ?? 0))}
              valueColor={result.deliveryFeeUsd === 0 ? 'var(--green)' : undefined}
              last
            />
          </div>

          {/* Total */}
          {b.ratesUnavailable ? (
            <div style={{ padding: '14px 16px', background: 'rgba(224,123,58,0.08)', border: '1px solid rgba(224,123,58,0.25)', borderRadius: 10, marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)', marginBottom: 4 }}>
                Shipping rates for {b.country} aren&apos;t set yet
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Contact us for a quote · تواصل معنا للحصول على عرض سعر
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 16px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {b.partialTotal ? 'Partial Total' : 'Estimated Total'}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', letterSpacing: '-0.5px' }}>
                    {b.partialTotal ? '~' : ''}{money(grandTotalUsd)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    ≈ {Math.round(grandTotalUsd * result.iqdPerUsd).toLocaleString()} IQD
                  </div>
                </div>
              </div>
              {b.partialTotal && b.totalMessage && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 8 }}>
                  {b.totalMessage}
                </div>
              )}
            </div>
          )}

          {(result.deliveryContactOnly || b.ratesUnavailable) && (
            <a href={WA_URL} target="_blank" rel="noopener noreferrer" className={styles.waBtn} style={{ display: 'inline-flex', marginBottom: 14 }}>
              💬 WhatsApp Us · تواصل واتساب
            </a>
          )}

          <div style={{ textAlign: 'center' }}>
            <div className={styles.billable}>
              Billed weight: <strong>{b.effectiveWeight} {b.weightUnit}</strong>
              {b.effectiveWeight > b.billableWeight && <> (minimum applied)</>}
              {' · '}{result.billableKg.toFixed(2)} kg actual
            </div>
            <div className={styles.disclaimer} style={{ marginTop: 8 }}>
              * Estimate only — final total confirmed by ShipIQ after reviewing your order ·{' '}
              <span className="ar">تقدير فقط — السعر النهائي يتم تأكيده من شيب آي كيو</span>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

// ── Small presentational helpers for breakdown rows ──
function Row({ label, value, valueColor, last }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: last ? 'none' : '1px solid rgba(201,168,76,0.08)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: valueColor ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}

function RowNote({ label, note }: { label: string; note: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'right', maxWidth: '60%' }}>{note}</span>
    </div>
  )
}
