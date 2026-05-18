'use client'
import { useState, useEffect } from 'react'
import { getSession, getProfile } from '../api'
import type { Profile } from '../types'

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const session = await getSession()
        if (cancelled || !session) { setLoading(false); return }
        const prof = await getProfile(session.user.id)
        if (!cancelled) { setProfile(prof); setLoading(false) }
      } catch (err) {
        console.error('useProfile: failed to load profile', err)
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { profile, setProfile, loading }
}
