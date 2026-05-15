'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard')
      else router.push('/auth')
    })
  }, [router])
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 24, height: 24, border: '2px solid #3a3835', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
    </div>
  )
}
