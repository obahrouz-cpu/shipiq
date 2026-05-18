'use client'
import { useState, useCallback } from 'react'
import { getAdminOrders, getUserOrders } from '../api'
import type { Order } from '../types'

export function useOrders(userId: string | null, isAdmin: boolean) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = isAdmin ? await getAdminOrders() : await getUserOrders(userId)
      setOrders(data)
    } catch (err) {
      console.error('useOrders: failed to fetch orders', err)
    } finally {
      setLoading(false)
    }
  }, [userId, isAdmin])

  return { orders, setOrders, loading, fetchOrders }
}
