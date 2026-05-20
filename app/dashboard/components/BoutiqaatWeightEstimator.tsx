'use client'
import { useState } from 'react'

const WEIGHT_OPTIONS = [
  { id: 'small',  emoji: '💄', label: 'Small item (lipstick, mascara, serum)',   kg: 0.2 },
  { id: 'medium', emoji: '🧴', label: 'Medium item (foundation, moisturizer)',   kg: 0.4 },
  { id: 'large',  emoji: '🌸', label: 'Large item (perfume, palette set)',       kg: 0.7 },
  { id: 'bundle', emoji: '🎁', label: 'Bundle / set',                            kg: 1.2 },
  { id: 'manual', emoji: '✏️', label: 'Enter manually',                          kg: 0   },
]

const RATE_USD   = 7.25

interface Props {
  onWeightSelect: (kg: number) => void
}

export default function BoutiqaatWeightEstimator({ onWeightSelect }: Props) {
  const [selected, setSelected]   = useState<string | null>(null)
  const [manualKg, setManualKg]   = useState('')

  const selectedOpt = WEIGHT_OPTIONS.find(o => o.id === selected)
  const activeKg    = selected === 'manual' ? (parseFloat(manualKg) || 0) : (selectedOpt?.kg ?? 0)

  const shippingUsd = activeKg > 0 ? (activeKg * RATE_USD).toFixed(2) : null

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
      background: 'rgba(194,24,91,0.05)',
      border: '1px solid rgba(194,24,91,0.22)',
      borderRadius: 12,
    }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
          💄 Estimate Item Weight · تقدير وزن المنتج
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Weight data not listed. Select the closest option:
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {WEIGHT_OPTIONS.map(opt => (
          <label key={opt.id} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 11px', borderRadius: 8,
            border: `1px solid ${selected === opt.id ? 'rgba(194,24,91,0.45)' : 'var(--border)'}`,
            background: selected === opt.id ? 'rgba(194,24,91,0.08)' : 'transparent',
            cursor: 'pointer', transition: 'all 0.13s',
          }}>
            <input
              type="radio" name="bq-weight" value={opt.id}
              checked={selected === opt.id} onChange={() => handleSelect(opt.id)}
              style={{ accentColor: '#c2185b', flexShrink: 0 }}
            />
            <span style={{ fontSize: 15, lineHeight: 1 }}>{opt.emoji}</span>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {opt.label}
              {opt.kg > 0 && <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>— {opt.kg} kg</span>}
            </span>
          </label>
        ))}
      </div>

      {selected === 'manual' && (
        <div style={{ marginTop: 8, display: 'flex', gap: 7 }}>
          <input
            type="number" step="0.1" min="0.1" placeholder="Weight in kg e.g. 0.3"
            value={manualKg} onChange={e => setManualKg(e.target.value)}
            style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
          />
          <button
            onClick={handleManualApply}
            disabled={!manualKg || parseFloat(manualKg) <= 0}
            style={{ padding: '8px 15px', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#000', fontSize: 13, fontWeight: 700, cursor: parseFloat(manualKg) > 0 ? 'pointer' : 'default', fontFamily: 'inherit', opacity: parseFloat(manualKg) > 0 ? 1 : 0.45, transition: 'opacity 0.15s' }}
          >
            Apply
          </button>
        </div>
      )}

      {shippingUsd && (
        <div style={{ marginTop: 10, padding: '10px 13px', background: 'rgba(201,168,76,0.07)', border: '1px dashed rgba(201,168,76,0.3)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>≈ Estimated Shipping</span>
            <span style={{ fontSize: 9, color: 'var(--gold-dim)', background: 'rgba(201,168,76,0.12)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(201,168,76,0.2)', fontWeight: 700, letterSpacing: '0.5px' }}>APPROXIMATE</span>
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--gold)', marginBottom: 2, lineHeight: 1.2 }}>
            ~${shippingUsd} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gold-dim)' }}>USD</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            {activeKg} kg × ${RATE_USD}/kg UAE cosmetics rate · Final price confirmed by ShipIQ
          </div>
        </div>
      )}
    </div>
  )
}
