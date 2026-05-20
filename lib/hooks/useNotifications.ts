'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getNotifications, markAllNotificationsRead } from '../api'
import type { Notification } from '../types'

const POLL_INTERVAL_MS = 30_000

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch_ = useCallback(async (showLoading = false) => {
    if (!userId) return
    if (showLoading) setLoading(true)
    try {
      const data = await getNotifications(userId)
      setNotifications(data)
    } catch (err) {
      console.error('useNotifications: failed to fetch', err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [userId])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    await markAllNotificationsRead(userId)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    fetch_(true)
    intervalRef.current = setInterval(() => fetch_(false), POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [userId, fetch_])

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, unreadCount, loading, refresh: fetch_, markAllRead }
}
