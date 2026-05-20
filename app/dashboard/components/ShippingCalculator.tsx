'use client'
import { useState, useEffect } from 'react'
import styles from './ShippingCalculator.module.css'

// UAE shipping rates in USD per kg
const UAE_RATES: Record<string, number> = {
  Clothing:    3.50,
  Cosmetics:   7.25,
  Supplements: 35.00,
  Accessories: 3.50,
  Other:       3.50,
}

const DELIVERY_OPTIONS = [
  { id: 'pickup',       label: 'Pickup at office',          sub: 'Free · مجاناً',             feeIqd: 0    },
  { id: 'home_erbil',   label: 'Home delivery — Erbil',     sub: '3,000 IQD',                  feeIqd: 3000 },
  { id: 'home_baghdad', label: 'Home delivery — Baghdad',   sub: '5,000 IQD',                  feeIqd: 5000 },
  { id: 'other',        label: 'Other city',                 sub: 'Contact us · تواصل معنا',    feeIqd: null },
] as const

const FALLBACK_FX = { iqd: 1540, EUR: 0.92, GBP: 0.79, TRY: 32.5, AED: 3.67 }
const WA_URL = 'https://wa.me/9647XXXXXXXXX'

type Unit = 'metric' | 'imperial'
type Currency = 'USD' | 'EUR' | 'GBP' | 'TRY' | 'AED'
interface FxRates { iqd: number; EUR: number; GBP: number; TRY: number; AED: number }

interface CalcResult {
  billableKg: number
  itemPriceUsd: number
  shippingUsd: number | null
  deliveryFeeUsd: number | null
  deliveryContactOnly: boolean
  shippingContactOnly: boolean
  country: string
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
  const [country, setCountry]       = useState('UAE')
  const [category, setCategory]     = useState('Other')
  const [weight, setWeight]         = useState('')
  const [length, setLength]         = useState('')
  const [width, setWidth]           = useState('')
  const [height, setHeight]         = useState('')
  const [itemPrice, setItemPrice]   = useState('')
  const [itemCurrency, setItemCurrency] = useState<Currency>('USD')
  const [delivery, setDelivery]     = useState('pickup')
  const [result, setResult]         = useState<CalcResult | null>(null)
  const [fx, setFx]                 = useState<FxRates>(FALLBACK_FX)

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
    setUnit('metric'); setCountry('UAE'); setCategory('Other')
    setWeight(''); setLength(''); setWidth(''); setHeight('')
    setItemPrice(''); setItemCurrency('USD'); setDelivery('pickup')
    setResult(null)
  }

  function calculate() {
    const w = parseFloat(weight)
    if (!w || w <= 0) return

    const actualKg = unit === 'metric' ? w : w / 2.20462
    const l = parseFloat(length); const wi = parseFloat(width); const h = parseFloat(height)
    let dimKg = 0
    if (l > 0 && wi > 0 && h > 0) {
      const cm = unit === 'metric' ? 1 : 2.54
      dimKg = (l * cm) * (wi * cm) * (h * cm) / 5000
    }
    const billableKg = Math.max(actualKg, dimKg)

    const itemPriceNum = parseFloat(itemPrice) || 0
    const itemPriceUsd = itemPriceNum > 0 ? toUsd(itemPriceNum, itemCurrency, fx) : 0

    const deliveryOpt = DELIVERY_OPTIONS.find(d => d.id === delivery)
    const deliveryFeeIqd = deliveryOpt?.feeIqd ?? null
    const deliveryFeeUsd = deliveryFeeIqd !== null ? deliveryFeeIqd / fx.iqd : null
    const deliveryContactOnly = deliveryFeeIqd === null

    if (country !== 'UAE') {
      setResult({ billableKg, itemPriceUsd, shippingUsd: null, deliveryFeeUsd, deliveryContactOnly, shippingContactOnly: true, country, iqdPerUsd: fx.iqd })
      return
    }

    const rate = UAE_RATES[category] ?? UAE_RATES.Other
    const shippingUsd = billableKg * rate
    setResult({ billableKg, itemPriceUsd, shippingUsd, deliveryFeeUsd, deliveryContactOnly, shippingContactOnly: false, country, iqdPerUsd: fx.iqd })
  }

  const wLabel  = unit === 'metric' ? 'Weight (kg) · الوزن' : 'Weight (lbs) · الوزن'
  const dimUnit = unit === 'metric' ? 'cm' : 'in'

  const hasItemPrice = !!result && result.itemPriceUsd > 0
  // Service fee is a rough 5–10% of the item price (varies per order).
  const serviceFeeLow  = hasItemPrice ? result!.itemPriceUsd * 0.05 : 0
  const serviceFeeHigh = hasItemPrice ? result!.itemPriceUsd * 0.10 : 0

  const baseUsd = result
    ? (result.itemPriceUsd || 0) + (result.shippingUsd ?? 0) + (result.deliveryFeeUsd ?? 0)
    : 0
  const totalLowUsd  = baseUsd + serviceFeeLow
  const totalHighUsd = baseUsd + serviceFeeHigh
  const totalMidIqd  = result ? Math.round((totalLowUsd + totalHighUsd) / 2 * result.iqdPerUsd / 1000) * 1000 : 0

  // We can only show a meaningful total when shipping + delivery are both known.
  const hasMeaningfulTotal = result && !result.shippingContactOnly && !result.deliveryContactOnly && baseUsd > 0
  const isRangeTotal = hasMeaningfulTotal && hasItemPrice

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          Calculate Your Shipping · <span className="ar">احسب تكلفة شحنك</span>
        </h2>
        <p className={styles.subtitle}>
          Get a full cost estimate — item price, shipping, and Iraq delivery
        </p>
      </div>

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
            Item Price · سعر المنتج
            <span className={styles.optional}>— Optional · اختياري</span>
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
          <label className={styles.label}>Currency · العملة</label>
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
          <label className={styles.label}>Origin Country · الدولة</label>
          <select className={styles.select} value={country} onChange={e => { setCountry(e.target.value); setResult(null) }}>
            <option value="USA">🇺🇸 USA — أمريكا</option>
            <option value="Turkey">🇹🇷 Turkey — تركيا</option>
            <option value="UAE">🇦🇪 UAE — الإمارات</option>
            <option value="China">🇨🇳 China — الصين</option>
          </select>
        </div>
        {country === 'UAE' && (
          <div className={styles.field}>
            <label className={styles.label}>Product Category · الفئة</label>
            <select className={styles.select} value={category} onChange={e => { setCategory(e.target.value); setResult(null) }}>
              <option value="Clothing">👗 Clothing &amp; Fashion</option>
              <option value="Cosmetics">💄 Cosmetics &amp; Beauty</option>
              <option value="Supplements">💊 Supplements &amp; Vitamins</option>
              <option value="Accessories">💍 Accessories &amp; Jewelry</option>
              <option value="Other">📦 Other</option>
            </select>
          </div>
        )}
      </div>

      {/* Weight */}
      <div className={styles.row}>
        <div className={styles.field} style={{ maxWidth: 260 }}>
          <label className={styles.label}>{wLabel}</label>
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
        <div className={styles.airBadge}>✈️ Air Freight</div>
      </div>

      {/* Dimensions */}
      <div className={styles.dimSection}>
        <div className={styles.dimLabel}>
          Dimensions ({dimUnit}) · الأبعاد
          <span className={styles.tooltip} title="Dimensional weight = (L × W × H) ÷ 5000">ℹ️</span>
          <span className={styles.optional}>— Optional · اختياري</span>
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

      {/* Delivery in Iraq */}
      <div style={{ marginBottom: 28 }}>
        <div className={styles.dimLabel}>Delivery in Iraq · التوصيل في العراق</div>
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
      {result && (
        <div className={styles.result} style={{ textAlign: 'left', padding: '24px 28px', marginTop: 28 }}>

          <div className={styles.resultLabel} style={{ textAlign: 'center', marginBottom: 18 }}>
            📦 Full Cost Estimate · تقدير التكلفة الكاملة
          </div>

          {/* Breakdown rows */}
          <div style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 16 }}>

            {hasItemPrice && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Item Price · سعر المنتج</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>~${result.itemPriceUsd.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Shipping Cost · الشحن</span>
              {result.shippingUsd !== null
                ? <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>~${result.shippingUsd.toFixed(2)}</span>
                : <span style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>Contact us for rates</span>
              }
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Service Fee · رسوم الخدمة <span style={{ color: 'var(--text-dim)' }}>(~5–10%)</span></span>
              {hasItemPrice
                ? <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>~${Math.round(serviceFeeLow)}–{Math.round(serviceFeeHigh)}</span>
                : <span style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>~5–10%</span>
              }
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Iraq Delivery · التوصيل</span>
              {result.deliveryContactOnly
                ? <span style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>Contact us</span>
                : result.deliveryFeeUsd === 0
                  ? <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>Free</span>
                  : <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>${result.deliveryFeeUsd!.toFixed(2)}</span>
              }
            </div>

          </div>

          {/* Estimated total */}
          {hasMeaningfulTotal ? (
            <div style={{ padding: '14px 16px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estimated Total</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', letterSpacing: '-0.5px' }}>
                    {isRangeTotal
                      ? <>~${Math.round(totalLowUsd)}–{Math.round(totalHighUsd)}</>
                      : <>~${totalLowUsd.toFixed(2)}</>
                    }
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                    ≈ {(isRangeTotal ? totalMidIqd : Math.round(totalLowUsd * result.iqdPerUsd)).toLocaleString()} IQD
                  </div>
                </div>
              </div>
            </div>
          ) : result.shippingContactOnly && (
            <a href={WA_URL} target="_blank" rel="noopener noreferrer" className={styles.waBtn} style={{ display: 'inline-flex', marginBottom: 14 }}>
              💬 WhatsApp Us · تواصل واتساب
            </a>
          )}

          <div style={{ textAlign: 'center' }}>
            <div className={styles.billable}>Billable weight: <strong>{result.billableKg.toFixed(2)} kg</strong></div>
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
