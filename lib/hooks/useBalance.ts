'use client'
import { useState, useCallback } from 'react'
import { getProfile } from '../api'

export function useBalance(userId: string | null) {
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const profile = await getProfile(userId)
      if (profile) setBalance(profile.balance_usd ?? 0)
    } catch (err) {
      console.error('useBalance: failed to fetch balance', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  return { balance, setBalance, loading, refresh }
}
