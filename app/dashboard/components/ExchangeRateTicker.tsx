'use client'
import { useState, useEffect } from 'react'

interface Rate {
  code: string
  rate: number
  label: string
  isIQD?: boolean
}

export default function ExchangeRateTicker() {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRates() {
      try {
        const [iqdRes, fxRes] = await Promise.all([
          fetch('/api/exchange-rate'),
          fetch('https://open.er-api.com/v6/latest/USD'),
        ])

        const iqdData = await iqdRes.json()
        const fxData = await fxRes.json()

        const fx = fxData?.rates ?? {}
        const built: Rate[] = [
          { code: 'IQD', rate: iqdData.rate, label: `1 USD = ${iqdData.rate.toLocaleString()} IQD`, isIQD: true },
          fx.EUR && { code: 'EUR', rate: fx.EUR, label: `1 USD = ${fx.EUR.toFixed(4)} EUR` },
          fx.GBP && { code: 'GBP', rate: fx.GBP, label: `1 USD = ${fx.GBP.toFixed(4)} GBP` },
          fx.TRY && { code: 'TRY', rate: fx.TRY, label: `1 USD = ${fx.TRY.toFixed(2)} TRY` },
          fx.AED && { code: 'AED', rate: fx.AED, label: `1 USD = ${fx.AED.toFixed(4)} AED` },
        ].filter(Boolean) as Rate[]

        setRates(built)
      } catch {
        // silently fail — ticker is non-critical
      } finally {
        setLoading(false)
      }
    }

    fetchRates()
  }, [])

  if (loading || rates.length === 0) return null

  // Duplicate items so the marquee loops seamlessly
  const items = [...rates, ...rates]

  return (
    <>
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '6px 0',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100vw',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 32,
          paddingLeft: 24,
          whiteSpace: 'nowrap',
          animation: 'tickerScroll 20s linear infinite',
        }}>
          {items.map((r, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
              {r.isIQD && (
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 4px #22c55e',
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
              )}
              <span style={{ fontWeight: r.isIQD ? 700 : 500, color: r.isIQD ? 'var(--text)' : undefined }}>
                {r.label}
              </span>
              {r.isIQD && (
                <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, letterSpacing: '0.3px' }}>LIVE</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
