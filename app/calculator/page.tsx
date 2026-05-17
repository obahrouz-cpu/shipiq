'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import ShippingCalculator from '../dashboard/components/ShippingCalculator'

export default function CalculatorPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(15,14,12,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 28px',
          height: 64, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Link href="/" style={{
            fontSize: 22, fontWeight: 800, color: 'var(--gold)',
            textDecoration: 'none', letterSpacing: -0.5, flexShrink: 0,
          }}>
            ShipIQ
          </Link>

          <div style={{ flex: 1 }} />

          <Link href="/" style={{
            fontSize: 14, fontWeight: 500, color: 'var(--text-muted)',
            textDecoration: 'none', padding: '7px 13px', borderRadius: 8,
            transition: 'color 0.18s',
          }}>
            ← Home
          </Link>

          {loggedIn === null ? null : loggedIn ? (
            <Link href="/dashboard" style={{
              background: 'var(--gold)', color: '#0f0e0c',
              textDecoration: 'none', fontSize: 14, fontWeight: 700,
              padding: '8px 18px', borderRadius: 8,
            }}>
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/auth" style={{
                color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14,
                fontWeight: 500, padding: '7px 16px', borderRadius: 8,
                border: '1px solid var(--border)',
              }}>
                Sign In
              </Link>
              <Link href="/auth" style={{
                background: 'var(--gold)', color: '#0f0e0c',
                textDecoration: 'none', fontSize: 14, fontWeight: 700,
                padding: '8px 18px', borderRadius: 8,
              }}>
                Sign Up Free
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── CALCULATOR ── */}
      <div style={{ flex: 1, padding: '64px 24px 96px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <ShippingCalculator />
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '24px',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--text-dim)',
      }}>
        © 2025 ShipIQ · <span className="ar">جميع الحقوق محفوظة</span>
        {' '}·{' '}
        <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
          Back to Home
        </Link>
        {' '}·{' '}
        <a href="https://wa.me/9647XXXXXXXXX" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--green)', textDecoration: 'none' }}>
          💬 WhatsApp
        </a>
      </footer>
    </div>
  )
}
