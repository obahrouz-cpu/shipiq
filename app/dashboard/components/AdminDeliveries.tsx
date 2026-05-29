'use client'
import { useState, useEffect, useCallback } from 'react'
import type { DeliveryRequest } from '@/lib/types'
import { getAdminDeliveryRequests, markBundleDelivered } from '@/lib/api'
import { displayPhone } from '@/lib/phone'
import styles from '../dashboard.module.css'

// Bundle statuses. Legacy rows may still carry pending/scheduled/completed.
const STATUS_CFG: Record<string, { label: string; color: string; icon: string }> = {
  pending:          { label: 'Pending',          color: 'var(--orange)', icon: '⏳' },
  scheduled:        { label: 'Scheduled',        color: 'var(--blue)',   icon: '📅' },
  out_for_delivery: { label: 'Out for Delivery', color: 'var(--gold)',   icon: '🚗' },
  delivered:        { label: 'Delivered',        color: 'var(--green)',  icon: '✅' },
  completed:        { label: 'Delivered',        color: 'var(--green)',  icon: '✅' },
  cancelled:        { label: 'Cancelled',        color: '#ef4444',       icon: '✕'  },
}

// A bundle is "active" (still needs delivering) until it's delivered/cancelled.
const isActive = (status: string) => !['delivered', 'completed', 'cancelled'].includes(status)

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function AdminDeliveries({ onToast }: Props) {
  const [requests, setRequests] = useState<DeliveryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getAdminDeliveryRequests()
      .then(setRequests)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const markDelivered = async (req: DeliveryRequest) => {
    setUpdating(req.id)
    const { error } = await markBundleDelivered(req.id, req.order_ids ?? [])
    if (error) { onToast(error, 'error'); setUpdating(null); return }
    // Notify the customer for each order in the bundle.
    ;(req.order_ids ?? []).forEach(orderId => {
      fetch('/api/whatsapp/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, event: 'delivered' }),
      }).catch(() => {})
    })
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'delivered', completed_at: new Date().toISOString() } : r))
    onToast('Bundle delivered — all orders marked delivered!')
    setUpdating(null)
  }

  const filtered =
    statusFilter === 'all' ? requests
    : statusFilter === 'active' ? requests.filter(r => isActive(r.status))
    : requests.filter(r => r.status === statusFilter || (statusFilter === 'delivered' && r.status === 'completed'))

  const statCounts = {
    active:    requests.filter(r => isActive(r.status)).length,
    delivered: requests.filter(r => ['delivered', 'completed'].includes(r.status)).length,
    orders:    requests.reduce((n, r) => n + (r.order_ids?.length ?? 0), 0),
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeading}>🚚 Last Mile Deliveries</div>
          <div className={styles.pageSub}>Delivery bundles from the in-city warehouse to the customer&apos;s door</div>
        </div>
        <button className={styles.btnGhost} style={{ fontSize: 12, padding: '6px 14px' }} onClick={load}>↻ Refresh</button>
      </div>

      {/* Stat cards */}
      <div className={styles.statsGrid} style={{ marginBottom: 20 }}>
        {([
          { label: 'Out for Delivery', value: statCounts.active,    color: 'var(--gold)',  bg: 'rgba(201,168,76,0.1)', icon: '🚗' },
          { label: 'Delivered',        value: statCounts.delivered, color: 'var(--green)', bg: 'rgba(34,197,94,0.1)',  icon: '✅' },
          { label: 'Orders Bundled',   value: statCounts.orders,    color: 'var(--blue)',  bg: 'rgba(91,155,213,0.1)', icon: '📦' },
        ] as const).map((s, i) => (
          <div key={i} className={styles.statCard} style={{ animationDelay: `${i * 60}ms` }}>
            <div className={styles.statIcon} style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div className={styles.statLabel}>{s.label}</div>
            <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          { id: 'active',    label: 'Active' },
          { id: 'delivered', label: 'Delivered' },
          { id: 'all',       label: 'All' },
        ] as const).map(s => (
          <button
            key={s.id}
            onClick={() => setStatusFilter(s.id)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              background: statusFilter === s.id ? 'rgba(201,168,76,0.15)' : 'var(--surface2)',
              color: statusFilter === s.id ? 'var(--gold)' : 'var(--text-dim)',
              border: statusFilter === s.id ? '1px solid rgba(201,168,76,0.35)' : '1px solid var(--border)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>Loading deliveries...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🚚</div>
          <div className={styles.emptyTitle}>No delivery bundles{statusFilter !== 'all' ? ` (${statusFilter})` : ''}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(req => {
            const cfg = STATUS_CFG[req.status] ?? { label: req.status, color: 'var(--text-muted)', icon: '?' }
            const canDeliver = isActive(req.status)
            return (
              <div key={req.id} className={styles.card} style={{ padding: '16px 20px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: 4 }}>{req.id}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className={styles.userAvatar} style={{ width: 30, height: 30, fontSize: 12, flexShrink: 0 }}>
                        {(req.profiles?.full_name?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{req.profiles?.full_name || '—'}</div>
                        <div className="phone-number" dir="ltr" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{req.profiles?.email}</div>
                        {req.profiles?.phone && <div className="phone-number" dir="ltr" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{displayPhone(req.profiles.phone)}</div>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                      background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
                      color: cfg.color, border: `1px solid color-mix(in srgb, ${cfg.color} 35%, transparent)`,
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>
                    {canDeliver && (
                      <button
                        className={styles.btnPrimary}
                        style={{ fontSize: 12, padding: '5px 14px' }}
                        disabled={updating === req.id}
                        onClick={() => markDelivered(req)}
                      >
                        {updating === req.id ? <span className={styles.spinner} style={{ width: 14, height: 14 }} /> : '✅ Mark Delivered'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Orders ({req.order_ids?.length ?? 0})</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                      {(req.order_ids ?? []).map((id, i) => (
                        <div key={i} style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Fee</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: req.delivery_fee > 0 ? 'var(--gold)' : 'var(--green)' }}>
                      {req.delivery_fee > 0 ? `${req.delivery_fee.toLocaleString()} IQD` : 'Free'}
                    </div>
                    {req.delivery_fee > 0 && (
                      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: req.delivery_preference === 'balance' ? 'var(--green)' : 'var(--orange)' }}>
                        {req.delivery_preference === 'balance' ? '✓ Paid from balance' : '💵 Collect cash on delivery'}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Requested</div>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{req.created_at?.split('T')[0]}</div>
                  </div>
                </div>

                {/* Address */}
                {req.delivery_address && (
                  <div style={{ padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>📍 Delivery Address</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{req.delivery_address}</div>
                    {req.delivery_lat && req.delivery_lng && (
                      <a
                        href={`https://maps.google.com/?q=${req.delivery_lat},${req.delivery_lng}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}
                      >
                        Open in Google Maps ↗
                      </a>
                    )}
                  </div>
                )}

                {/* Notes */}
                {req.delivery_notes && (
                  <div style={{ padding: '8px 12px', background: 'rgba(91,155,213,0.06)', border: '1px solid rgba(91,155,213,0.2)', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>📝 Customer Notes</div>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{req.delivery_notes}</div>
                  </div>
                )}

                {/* Delivered timestamp */}
                {req.completed_at && (
                  <div style={{ fontSize: 11, color: 'var(--green)' }}>
                    ✅ Delivered: {new Date(req.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
