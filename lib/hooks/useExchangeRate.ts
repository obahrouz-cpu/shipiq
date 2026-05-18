'use client'
import { useState, useEffect } from 'react'

export function useExchangeRate(fallbackRate = 1450) {
  const [rate, setRate] = useState<number>(fallbackRate)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then((data: { rate?: number }) => {
        if (typeof data.rate === 'number') setRate(data.rate)
      })
      .catch(() => {}) // non-critical — fallback rate stays
      .finally(() => setLoading(false))
  }, [])

  return { rate, loading }
}
