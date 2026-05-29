'use client'
import { useState, useEffect } from 'react'
import { getPricingConfig, savePricingConfig, getDeliveryFeeUsd, saveDeliveryFeeUsd } from '@/lib/api'
import {
  type CountryPricingConfig, type OriginCountry, type PricingCategory,
  ORIGIN_COUNTRIES, PRICING_CATEGORIES, defaultConfig,
} from '@/lib/pricing'

const COUNTRY_FLAG: Record<OriginCountry, string> = { USA: '🇺🇸', UAE: '🇦🇪', Turkey: '🇹🇷', China: '🇨🇳' }
const CATEGORY_LABEL: Record<PricingCategory, string> = {
  cosmetics: '💄 Cosmetics', supplements: '💊 Supplements', clothing: '👗 Clothing',
  electronics: '📱 Electronics', accessories: '💍 Accessories', uncategorized: '📦 Uncategorized',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }
const hintStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }

function NumberRow({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          type="number"
          min="0"
          step="0.01"
          value={Number.isFinite(value) ? value : 0}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
        />
        {suffix && <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0, whiteSpace: 'nowrap' }}>{suffix}</span>}
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 38, height: 22, borderRadius: 11, flexShrink: 0,
          background: checked ? 'var(--gold)' : 'var(--border)',
          position: 'relative', transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 19 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>
    </label>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase',
      letterSpacing: '0.6px', margin: '18px 0 10px', paddingBottom: 6, borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  )
}

export default function AdminPricing() {
  const [configs, setConfigs] = useState<Record<OriginCountry, CountryPricingConfig>>(() => ({
    USA: defaultConfig('USA'), UAE: defaultConfig('UAE'), Turkey: defaultConfig('Turkey'), China: defaultConfig('China'),
  }))
  const [active, setActive] = useState<OriginCountry>('USA')
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Flat nationwide delivery fee (global, USD) ──
  const [deliveryFee, setDeliveryFee] = useState(4)
  const [deliverySaving, setDeliverySaving] = useState(false)
  const [deliverySaved, setDeliverySaved] = useState(false)
  const [deliveryError, setDeliveryError] = useState<string | null>(null)

  useEffect(() => {
    getPricingConfig().then(({ configs, error }) => {
      const map = {} as Record<OriginCountry, CountryPricingConfig>
      for (const c of configs) map[c.country] = c
      for (const country of ORIGIN_COUNTRIES) if (!map[country]) map[country] = defaultConfig(country)
      setConfigs(map)
      setLoadError(error)
      setLoaded(true)
    })
    getDeliveryFeeUsd().then(setDeliveryFee)
  }, [])

  async function handleSaveDelivery() {
    setDeliverySaving(true); setDeliveryError(null)
    const { error } = await saveDeliveryFeeUsd(deliveryFee)
    setDeliverySaving(false)
    if (error) { setDeliveryError(error); return }
    setDeliverySaved(true)
    setTimeout(() => setDeliverySaved(false), 2500)
  }

  const cfg = configs[active]

  function update(patch: Partial<CountryPricingConfig>) {
    setConfigs(prev => ({ ...prev, [active]: { ...prev[active], ...patch } }))
    setSaved(false)
  }
  function updateCategoryRate(field: 'shipping_category_rates' | 'customs_category_amounts', cat: PricingCategory, value: number) {
    setConfigs(prev => ({
      ...prev,
      [active]: { ...prev[active], [field]: { ...prev[active][field], [cat]: value } },
    }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true); setSaveError(null)
    const { error } = await savePricingConfig(cfg)
    setSaving(false)
    if (error) { setSaveError(error); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!loaded) {
    return <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)', fontSize: 13 }}>⏳ Loading pricing config…</div>
  }

  const unit = cfg.weight_unit
  const cur = cfg.currency || 'USD'

  return (
    <>
    {/* ── Flat nationwide delivery fee ── */}
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
        🚚 Delivery
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
          Single flat last-mile fee charged to the customer when they deliver arrived items home.
          Applies nationwide and is shared by the website and the Flutter app.
        </div>
        <div style={{ maxWidth: 280 }}>
          <NumberRow label="Flat delivery fee" suffix="USD" value={deliveryFee} onChange={v => { setDeliveryFee(v); setDeliverySaved(false) }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <button
            onClick={handleSaveDelivery}
            disabled={deliverySaving}
            style={{
              padding: '9px 20px', fontSize: 13, fontWeight: 700,
              background: deliverySaved ? '#16a34a' : 'var(--gold)', color: deliverySaved ? '#fff' : 'var(--bg)',
              border: 'none', borderRadius: 8, cursor: deliverySaving ? 'not-allowed' : 'pointer', opacity: deliverySaving ? 0.7 : 1,
            }}
          >
            {deliverySaving ? 'Saving…' : deliverySaved ? '✓ Saved' : '💾 Save delivery fee'}
          </button>
          {deliveryError && <span style={{ fontSize: 12, color: '#ef4444' }}>❌ {deliveryError}</span>}
        </div>
      </div>
    </div>

    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
        💲 Pricing Engine
      </div>

      <div style={{ padding: 16 }}>
        {loadError && (
          <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 12, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)' }}>
            ⚠️ Could not load saved config ({loadError}). Make sure the <code>pricing_config</code> table SQL has been run in Supabase. Showing defaults until then.
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
          Rates are shared by the website and the Flutter app. All amounts are in the country&apos;s currency. Edit one country at a time and Save.
        </div>

        {/* Country selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {ORIGIN_COUNTRIES.map(country => (
            <button
              key={country}
              onClick={() => { setActive(country); setSaved(false); setSaveError(null) }}
              style={{
                padding: '7px 16px', fontSize: 13, fontWeight: 700, borderRadius: 20, cursor: 'pointer',
                background: active === country ? 'var(--gold)' : 'var(--surface)',
                color: active === country ? 'var(--bg)' : 'var(--text)',
                border: `1px solid ${active === country ? 'var(--gold)' : 'var(--border)'}`,
              }}
            >
              {COUNTRY_FLAG[country]} {country}
            </button>
          ))}
        </div>

        {/* ── General ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Currency</div>
            <input style={inputStyle} value={cur} onChange={e => update({ currency: e.target.value.toUpperCase() })} placeholder="USD" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Weight Unit</div>
            <select style={inputStyle} value={unit} onChange={e => update({ weight_unit: e.target.value as 'lb' | 'kg' })}>
              <option value="kg">kg (kilograms)</option>
              <option value="lb">lb (pounds)</option>
            </select>
          </div>
        </div>

        {/* ── Shipping ── */}
        <SubHeading>📦 Shipping — rate per {unit}</SubHeading>
        <div style={{ ...hintStyle, marginBottom: 10 }}>
          A rate of <strong>0</strong> means &ldquo;not set yet&rdquo; — the calculator and app show
          &ldquo;contact us for a quote&rdquo; instead of a wrong number.
        </div>
        <Toggle
          checked={cfg.shipping_per_category}
          onChange={v => update({ shipping_per_category: v })}
          label="Separate rate per category"
        />
        {cfg.shipping_per_category ? (
          PRICING_CATEGORIES.map(catKey => (
            <NumberRow
              key={catKey}
              label={CATEGORY_LABEL[catKey]}
              suffix={`${cur} / ${unit}`}
              value={cfg.shipping_category_rates[catKey]}
              onChange={v => updateCategoryRate('shipping_category_rates', catKey, v)}
            />
          ))
        ) : (
          <NumberRow
            label="Flat rate (whole country)"
            suffix={`${cur} / ${unit}`}
            value={cfg.shipping_flat_rate}
            onChange={v => update({ shipping_flat_rate: v })}
          />
        )}
        <div style={{ ...hintStyle, margin: '6px 0 8px' }}>
          Billable weight is floored at this minimum before × rate. <strong>0</strong> = no minimum.
        </div>
        <NumberRow
          label={`Minimum weight (${unit})`}
          suffix={unit}
          value={cfg.min_billable_weight}
          onChange={v => update({ min_billable_weight: v })}
        />

        {/* ── Service fee ── */}
        <SubHeading>🧾 Service Fee</SubHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {([
            { id: 'percentage', label: 'Percentage + minimum — max(price × %, minimum)' },
            { id: 'per_piece', label: 'Per-piece — flat amount × quantity' },
          ] as { id: 'percentage' | 'per_piece'; label: string }[]).map(opt => (
            <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name="service_fee_mode"
                checked={cfg.service_fee_mode === opt.id}
                onChange={() => update({ service_fee_mode: opt.id })}
                style={{ accentColor: 'var(--gold)', width: 15, height: 15 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{opt.label}</span>
            </label>
          ))}
        </div>
        {cfg.service_fee_mode === 'percentage' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <NumberRow label="Percentage of item price" suffix="%" value={cfg.service_fee_percent} onChange={v => update({ service_fee_percent: v })} />
            <NumberRow label="Minimum (floor)" suffix={cur} value={cfg.service_fee_min} onChange={v => update({ service_fee_min: v })} />
          </div>
        ) : (
          <NumberRow label="Per-piece amount" suffix={`${cur} / item`} value={cfg.service_fee_per_piece} onChange={v => update({ service_fee_per_piece: v })} />
        )}

        {/* ── Customs ── */}
        <SubHeading>🛃 Customs</SubHeading>
        <Toggle
          checked={cfg.customs_per_category}
          onChange={v => update({ customs_per_category: v })}
          label="Separate amount per category"
        />
        {cfg.customs_per_category ? (
          PRICING_CATEGORIES.map(catKey => (
            <NumberRow
              key={catKey}
              label={CATEGORY_LABEL[catKey]}
              suffix={cur}
              value={cfg.customs_category_amounts[catKey]}
              onChange={v => updateCategoryRate('customs_category_amounts', catKey, v)}
            />
          ))
        ) : (
          <NumberRow label="Flat customs fee" suffix={cur} value={cfg.customs_flat} onChange={v => update({ customs_flat: v })} />
        )}

        {/* ── Insurance ── */}
        <SubHeading>🛡️ Insurance — % of item price (customer opts in)</SubHeading>
        <NumberRow label="Insurance rate" suffix="%" value={cfg.insurance_percent} onChange={v => update({ insurance_percent: v })} />

        {/* ── Save ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '9px 20px', fontSize: 13, fontWeight: 700,
              background: saved ? '#16a34a' : 'var(--gold)', color: saved ? '#fff' : 'var(--bg)',
              border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : saved ? `✓ Saved ${active}` : `💾 Save ${COUNTRY_FLAG[active]} ${active}`}
          </button>
          {saveError && <span style={{ fontSize: 12, color: '#ef4444' }}>❌ {saveError}</span>}
        </div>
      </div>
    </div>
    </>
  )
}
