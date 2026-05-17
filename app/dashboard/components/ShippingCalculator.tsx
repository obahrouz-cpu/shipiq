'use client'
import { useState } from 'react'
import styles from './ShippingCalculator.module.css'

// UAE rates in USD per kg
const UAE_RATES: Record<string, number> = {
  Clothing:    3.50,
  Cosmetics:   7.25,
  Supplements: 35.00,
  Accessories: 3.50,
  Other:       3.50,
}

const IQD_PER_USD = 1540
const WA_URL = 'https://wa.me/9647XXXXXXXXX'

type Unit = 'metric' | 'imperial'

interface CalcResult {
  billableKg: number
  usd: number
  iqd: number
  contactOnly: boolean
  country: string
}

function convertVal(val: string, factor: number, dec: number): string {
  if (!val) return ''
  const n = parseFloat(val)
  return isNaN(n) ? '' : (n * factor).toFixed(dec)
}

export default function ShippingCalculator() {
  const [unit, setUnit]         = useState<Unit>('metric')
  const [country, setCountry]   = useState('UAE')
  const [category, setCategory] = useState('Other')
  const [weight, setWeight]     = useState('')
  const [length, setLength]     = useState('')
  const [width, setWidth]       = useState('')
  const [height, setHeight]     = useState('')
  const [result, setResult]     = useState<CalcResult | null>(null)

  function switchUnit(next: Unit) {
    if (next === unit) return
    const toImp = next === 'imperial'
    const wf = toImp ? 2.20462 : 1 / 2.20462
    const df = toImp ? 1 / 2.54  : 2.54
    setWeight(v => convertVal(v, wf, 2))
    setLength(v => convertVal(v, df, 1))
    setWidth(v  => convertVal(v, df, 1))
    setHeight(v => convertVal(v, df, 1))
    setUnit(next)
    setResult(null)
  }

  function reset() {
    setUnit('metric')
    setCountry('UAE')
    setCategory('Other')
    setWeight('')
    setLength('')
    setWidth('')
    setHeight('')
    setResult(null)
  }

  function calculate() {
    const w = parseFloat(weight)
    if (!w || w <= 0) return

    const actualKg = unit === 'metric' ? w : w / 2.20462

    const l = parseFloat(length)
    const wi = parseFloat(width)
    const h = parseFloat(height)
    let dimKg = 0
    if (l > 0 && wi > 0 && h > 0) {
      const cm = unit === 'metric' ? 1 : 2.54
      dimKg = (l * cm) * (wi * cm) * (h * cm) / 5000
    }

    const billableKg = Math.max(actualKg, dimKg)

    if (country !== 'UAE') {
      setResult({ billableKg, usd: 0, iqd: 0, contactOnly: true, country })
      return
    }

    const rate = UAE_RATES[category] ?? UAE_RATES.Other
    const usd = billableKg * rate
    setResult({ billableKg, usd, iqd: usd * IQD_PER_USD, contactOnly: false, country })
  }

  const wLabel  = unit === 'metric' ? 'Weight (kg) · الوزن' : 'Weight (lbs) · الوزن'
  const dimUnit = unit === 'metric' ? 'cm' : 'in'

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          Calculate Your Shipping · <span className="ar">احسب تكلفة شحنك</span>
        </h2>
        <p className={styles.subtitle}>
          Get an instant estimate before you commit to an order
        </p>
      </div>

      {/* Unit toggle */}
      <div className={styles.unitToggleWrap}>
        <div className={styles.unitToggle}>
          <button
            className={`${styles.unitBtn} ${unit === 'metric' ? styles.unitActive : ''}`}
            onClick={() => switchUnit('metric')}
          >
            Metric (kg / cm)
          </button>
          <button
            className={`${styles.unitBtn} ${unit === 'imperial' ? styles.unitActive : ''}`}
            onClick={() => switchUnit('imperial')}
          >
            Imperial (lbs / in)
          </button>
        </div>
      </div>

      {/* Country + Category */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Origin Country · الدولة</label>
          <select
            className={styles.select}
            value={country}
            onChange={e => { setCountry(e.target.value); setResult(null) }}
          >
            <option value="USA">🇺🇸 USA — أمريكا</option>
            <option value="Turkey">🇹🇷 Turkey — تركيا</option>
            <option value="UAE">🇦🇪 UAE — الإمارات</option>
            <option value="China">🇨🇳 China — الصين</option>
          </select>
        </div>

        {country === 'UAE' && (
          <div className={styles.field}>
            <label className={styles.label}>Product Category · الفئة</label>
            <select
              className={styles.select}
              value={category}
              onChange={e => { setCategory(e.target.value); setResult(null) }}
            >
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
          <span
            className={styles.tooltip}
            title="Dimensions help calculate dimensional weight for accurate pricing · الأبعاد تساعد على حساب الوزن الحجمي"
          >
            ℹ️
          </span>
          <span className={styles.optional}>— Optional · اختياري</span>
        </div>

        <div className={styles.dimInputs}>
          <div className={styles.dimField}>
            <input
              className={styles.input}
              type="number"
              placeholder="Length"
              min="0"
              step="0.1"
              value={length}
              onChange={e => { setLength(e.target.value); setResult(null) }}
            />
            <span className={styles.dimLetter}>L</span>
          </div>
          <span className={styles.dimX}>×</span>
          <div className={styles.dimField}>
            <input
              className={styles.input}
              type="number"
              placeholder="Width"
              min="0"
              step="0.1"
              value={width}
              onChange={e => { setWidth(e.target.value); setResult(null) }}
            />
            <span className={styles.dimLetter}>W</span>
          </div>
          <span className={styles.dimX}>×</span>
          <div className={styles.dimField}>
            <input
              className={styles.input}
              type="number"
              placeholder="Height"
              min="0"
              step="0.1"
              value={height}
              onChange={e => { setHeight(e.target.value); setResult(null) }}
            />
            <span className={styles.dimLetter}>H</span>
          </div>
          <span className={styles.dimUnitBadge}>{dimUnit}</span>
        </div>

        <div className={styles.dimHint}>
          Dimensional weight = (L × W × H) ÷ 5000 &nbsp;·&nbsp; Billable = max(actual, dimensional)
        </div>
      </div>

      {/* Buttons */}
      <div className={styles.actions}>
        <button className={styles.calcBtn} onClick={calculate}>
          Calculate · احسب
        </button>
        <button className={styles.resetBtn} onClick={reset}>
          Reset · إعادة
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={`${styles.result} ${result.contactOnly ? styles.resultAlt : ''}`}>
          {result.contactOnly ? (
            <>
              <div className={styles.resultLabel}>
                Contact Us for Rates · تواصل معنا للأسعار
              </div>
              <p className={styles.contactMsg}>
                We offer competitive rates from {result.country}.
                Chat with us on WhatsApp for a quick quote.{' '}
                <span className="ar">
                  نقدم أسعاراً تنافسية. تواصل معنا على واتساب لعرض سعر سريع.
                </span>
              </p>
              <div className={styles.billable}>
                Billable weight: <strong>{result.billableKg.toFixed(2)} kg</strong>
              </div>
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.waBtn}
              >
                💬 WhatsApp Us · تواصل واتساب
              </a>
            </>
          ) : (
            <>
              <div className={styles.resultLabel}>
                ✈️ Air Freight · Estimated Shipping · تقدير الشحن
              </div>
              <div className={styles.resultPrice}>
                ${result.usd.toFixed(2)}
                <span className={styles.resultCurrency}> USD</span>
              </div>
              <div className={styles.resultIqd}>
                ≈ {Math.round(result.iqd).toLocaleString()} IQD
              </div>
              <div className={styles.billable}>
                Billable weight: <strong>{result.billableKg.toFixed(2)} kg</strong>
              </div>
              <div className={styles.disclaimer}>
                * Final price confirmed by ShipIQ after reviewing your order ·{' '}
                <span className="ar">السعر النهائي يتم تأكيده من شيب آي كيو</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
