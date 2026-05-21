'use client'
import { useState, useEffect } from 'react'
import { getAppSettings } from '../api'

const FALLBACK_RATE = 1540

// Resolves the IQD/USD rate from app_settings (manual override or live scrape)
// and the business WhatsApp number, both used by the wallet top-up flow.
export function useIqdRate() {
  const [rate, setRate] = useState<number>(FALLBACK_RATE)
  const [whatsapp, setWhatsapp] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { settings } = await getAppSettings()
        if (cancelled) return
        if (settings.business_whatsapp) setWhatsapp(settings.business_whatsapp.replace(/\D/g, ''))
        const manual = parseInt(settings.iqd_rate_manual || '', 10)
        const hasManual = manual > 1000

        if (settings.iqd_rate_mode === 'manual' && hasManual) {
          setRate(manual)
          return
        }
        const data = await fetch('/api/exchange-rate').then(r => r.json()).catch(() => null)
        if (cancelled) return
        if (data && typeof data.rate === 'number' && data.rate > 1000) setRate(data.rate)
        else if (hasManual) setRate(manual)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { rate, whatsapp, loading }
}
