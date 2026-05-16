'use client'
import { useState } from 'react'

const WEIGHT_OPTIONS = [
  { id: 'light',  emoji: '👕', label: 'Light item (t-shirt, underwear, socks)',  kg: 0.3 },
  { id: 'medium', emoji: '👖', label: 'Medium item (jeans, dress, blouse)',       kg: 0.6 },
  { id: 'heavy',  emoji: '🧥', label: 'Heavy item (jacket, coat, sweater)',       kg: 1.2 },
  { id: 'shoes',  emoji: '👟', label: 'Shoes (any type)',                         kg: 0.8 },
  { id: 'bag',    emoji: '👜', label: 'Bag or accessory',                         kg: 0.5 },
  { id: 'manual', emoji: '✏️', label: 'Enter manually',                           kg: 0   },
]

const RATE_USD = 3.5
const IQD_PER_USD = 1450

interface Props {
  onWeightSelect: (kg: number) => void
}

export default function TrendyolWeightEstimator({ onWeightSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [manualKg, setManualKg] = useState('')

  const selectedOpt = WEIGHT_OPTIONS.find(o => o.id === selected)
  const activeKg = selected === 'manual'
    ? (parseFloat(manualKg) || 0)
    : (selectedOpt?.kg ?? 0)

  const shippingUsd  = activeKg > 0 ? (activeKg * RATE_USD).toFixed(2) : null
  const shippingIqd  = activeKg > 0 ? Math.round(activeKg * RATE_USD * IQD_PER_USD).toLocaleString() : null

  const handleSelect = (id: string) => {
    setSelected(id)
    if (id !== 'manual') {
      const opt = WEIGHT_OPTIONS.find(o => o.id === id)!
      onWeightSelect(opt.kg)
    }
  }

  const handleManualApply = () => {
    const kg = parseFloat(manualKg)
    if (kg > 0) onWeightSelect(kg)
  }

  return (
    <div style={{
      margin: '12px 0',
      padding: '14px 16px',
      background: 'rgba(242,122,26,0.05)',
      border: '1px solid rgba(242,122,26,0.22)',
      borderRadius: 12,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
          🇹🇷 Estimate Item Weight · تقدير وزن المنتج
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Trendyol doesn&apos;t provide weight data. Select the closest option:
        </div>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {WEIGHT_OPTIONS.map(opt => (
          <label
            key={opt.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px 11px',
              borderRadius: 8,
              border: `1px solid ${selected === opt.id ? 'rgba(242,122,26,0.45)' : 'var(--border)'}`,
              background: selected === opt.id ? 'rgba(242,122,26,0.08)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.13s',
            }}
          >
            <input
              type="radio"
              name="ty-weight"
              value={opt.id}
              checked={selected === opt.id}
              onChange={() => handleSelect(opt.id)}
              style={{ accentColor: '#F27A1A', flexShrink: 0 }}
            />
            <span style={{ fontSize: 15, lineHeight: 1 }}>{opt.emoji}</span>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {opt.label}
              {opt.kg > 0 && (
                <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>— {opt.kg} kg</span>
              )}
            </span>
          </label>
        ))}
      </div>

      {/* Manual input */}
      {selected === 'manual' && (
        <div style={{ marginTop: 8, display: 'flex', gap: 7 }}>
          <input
            type="number"
            step="0.1"
            min="0.1"
            placeholder="Weight in kg e.g. 0.4"
            value={manualKg}
            onChange={e => setManualKg(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '8px 11px',
              fontSize: 13,
              color: 'var(--text)',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            onClick={handleManualApply}
            disabled={!manualKg || parseFloat(manualKg) <= 0}
            style={{
              padding: '8px 15px',
              background: 'var(--gold)',
              border: 'none',
              borderRadius: 7,
              color: '#000',
              fontSize: 13,
              fontWeight: 700,
              cursor: parseFloat(manualKg) > 0 ? 'pointer' : 'default',
              fontFamily: 'inherit',
              opacity: parseFloat(manualKg) > 0 ? 1 : 0.45,
              transition: 'opacity 0.15s',
            }}
          >
            Apply
          </button>
        </div>
      )}

      {/* Live estimate preview */}
      {shippingUsd && (
        <div style={{
          marginTop: 10,
          padding: '10px 13px',
          background: 'rgba(201,168,76,0.07)',
          border: '1px dashed rgba(201,168,76,0.3)',
          borderRadius: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ≈ Estimated Shipping
            </span>
            <span style={{ fontSize: 9, color: 'var(--gold-dim)', background: 'rgba(201,168,76,0.12)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(201,168,76,0.2)', fontWeight: 700, letterSpacing: '0.5px' }}>
              APPROXIMATE
            </span>
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--gold)', marginBottom: 2, lineHeight: 1.2 }}>
            ~${shippingUsd} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gold-dim)' }}>USD</span>
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-dim)', marginLeft: 8 }}>({shippingIqd} IQD)</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            {activeKg} kg × ${RATE_USD}/kg Turkey rate · Final price confirmed by ShipIQ after arrival
          </div>
        </div>
      )}
    </div>
  )
}
