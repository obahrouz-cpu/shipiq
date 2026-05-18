'use client'
import { useState, useEffect, useRef } from 'react'
import { getSession, updateOrder, agentMarkOrdered, agentMarkWarehouse } from '@/lib/api'
import type { Order, Profile } from '@/lib/types'
import styles from './AgentDashboard.module.css'

const COUNTRY_FLAGS: Record<string, string> = {
  USA:    '🇺🇸',
  Turkey: '🇹🇷',
  UAE:    '🇦🇪',
  China:  '🇨🇳',
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: string }> = {
  confirmed: { label: 'Confirmed',  cls: 'badgeConfirmed', icon: '✅' },
  ordered:   { label: 'Ordered',    cls: 'badgeOrdered',   icon: '🛒' },
  warehouse: { label: 'Warehouse',  cls: 'badgeWarehouse', icon: '🏭' },
  transit:   { label: 'In Transit', cls: 'badgeTransit',   icon: '✈️' },
  arrived:   { label: 'Arrived',    cls: 'badgeArrived',   icon: '🏙️' },
  delivered: { label: 'Delivered',  cls: 'badgeDelivered', icon: '📬' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.confirmed
  return <span className={`${styles.badge} ${styles[cfg.cls]}`}>{cfg.icon} {cfg.label}</span>
}

// ── Action Modal (photo upload) ───────────────────────────────────────────────

function ActionModal({
  order, type, agentId, onClose, onDone,
}: {
  order: Order
  type: 'ordered' | 'warehouse'
  agentId: string
  onClose: () => void
  onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const isOrdered = type === 'ordered'

  const submit = async () => {
    if (!file) { setError('Please upload a photo first'); return }
    setLoading(true); setError('')
    const result = isOrdered
      ? await agentMarkOrdered(order.id, file, agentId)
      : await agentMarkWarehouse(order.id, file, agentId)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onDone()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalTitle}>
          {isOrdered ? '🛒 Confirm Order Placed · تأكيد تقديم الطلب' : '🏭 Confirm Arrived at Warehouse · تأكيد الوصول للمستودع'}
        </div>

        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>Order: </span>
          <span style={{ fontFamily: 'monospace', color: 'var(--text)', fontWeight: 700 }}>{order.id}</span>
          <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 11 }}>{order.description}</div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <label className={styles.label}>{isOrdered ? 'Order receipt / screenshot *' : 'Warehouse photo *'}</label>
        <div
          className={`${styles.uploadArea} ${file ? styles.uploadAreaHasFile : ''}`}
          onClick={() => fileRef.current?.click()}
        >
          <div className={styles.uploadIcon}>{file ? '✅' : '📷'}</div>
          <div className={styles.uploadText}>{file ? file.name : 'Tap to take photo or select file'}</div>
          <div className={styles.uploadSub}>{file ? `${(file.size / 1024).toFixed(0)} KB` : 'JPG, PNG up to 10 MB'}</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => setFile(e.target.files?.[0] || null)}
        />

        <label className={styles.label}>Notes (optional)</label>
        <textarea
          className={styles.textarea}
          placeholder="Any notes about this order..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button className={styles.btnConfirm} onClick={submit} disabled={loading || !file}>
            {loading
              ? <span className={styles.spinner} />
              : (isOrdered ? '🛒 Mark as Ordered' : '🏭 Mark as Warehouse')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({
  order, onPhotoAction, onRefresh,
}: {
  order: Order
  onPhotoAction: (type: 'ordered' | 'warehouse') => void
  onRefresh: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [updating, setUpdating] = useState(false)

  const copyId = () => {
    navigator.clipboard.writeText(order.id).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const directUpdate = async (status: string) => {
    setUpdating(true)
    await updateOrder(order.id, { status })
    setUpdating(false)
    onRefresh()
  }

  const cardStyle = order.status === 'confirmed' ? styles.cardAction
    : order.status === 'delivered' ? styles.cardCompleted
    : styles.cardInProgress

  return (
    <div className={`${styles.card} ${cardStyle}`}>
      {order.status === 'confirmed' && <span className={styles.pulse} />}

      <div className={styles.cardTop}>
        <div className={styles.orderIdRow}>
          <span className={styles.orderId}>{order.id}</span>
          <button className={styles.copyBtn} onClick={copyId}>{copied ? '✓ Copied!' : '⎘ Copy'}</button>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className={styles.cardFields}>
        <div className={styles.fieldRow}>
          <span className={styles.fieldKey}>URL</span>
          <a href={order.url} target="_blank" rel="noopener noreferrer" className={styles.urlLink}>
            {order.url.length > 55 ? order.url.slice(0, 55) + '…' : order.url}
          </a>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldKey}>Item</span>
          <span className={styles.fieldVal}>{order.description}</span>
        </div>
        {order.qty > 1 && (
          <div className={styles.fieldRow}>
            <span className={styles.fieldKey}>Qty</span>
            <span className={styles.fieldVal} style={{ fontWeight: 700 }}>× {order.qty}</span>
          </div>
        )}
        {order.note && (
          <div className={styles.fieldRow}>
            <span className={styles.fieldKey}>Notes</span>
            <span className={styles.fieldVal} style={{ color: 'var(--orange)' }}>⚠️ {order.note}</span>
          </div>
        )}
        {order.item_price && (
          <div className={styles.fieldRow}>
            <span className={styles.fieldKey}>Price</span>
            <span className={styles.fieldVal}>{order.item_price} {order.item_price_currency}</span>
          </div>
        )}
      </div>

      {/* Product photo */}
      {order.photo_url && (
        <div style={{ marginBottom: 14 }}>
          <a href={order.photo_url} target="_blank" rel="noopener noreferrer">
            <img
              src={order.photo_url}
              alt="product"
              className={styles.customerPhoto}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          </a>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>Product photo</div>
        </div>
      )}

      {/* Agent uploaded photos */}
      {(order.agent_receipt_url || order.agent_warehouse_photo_url) && (
        <div className={styles.photoRow}>
          {order.agent_receipt_url && (
            <div className={styles.photoItem}>
              <a href={order.agent_receipt_url} target="_blank" rel="noopener noreferrer">
                <img src={order.agent_receipt_url} alt="receipt" className={styles.photoThumb}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              </a>
              <span className={styles.photoLabel}>Receipt</span>
            </div>
          )}
          {order.agent_warehouse_photo_url && (
            <div className={styles.photoItem}>
              <a href={order.agent_warehouse_photo_url} target="_blank" rel="noopener noreferrer">
                <img src={order.agent_warehouse_photo_url} alt="warehouse" className={styles.photoThumb}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              </a>
              <span className={styles.photoLabel}>Warehouse</span>
            </div>
          )}
        </div>
      )}

      {/* Status-driven action buttons */}
      {order.status === 'confirmed' && (
        <button className={`${styles.actionBtn} ${styles.actionBtnOrange}`} onClick={() => onPhotoAction('ordered')}>
          🛒 Mark as Ordered
        </button>
      )}
      {order.status === 'ordered' && (
        <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`} onClick={() => onPhotoAction('warehouse')}>
          🏭 Mark as At Warehouse
        </button>
      )}
      {order.status === 'warehouse' && (
        <button className={`${styles.actionBtn} ${styles.actionBtnBlue}`} onClick={() => directUpdate('transit')} disabled={updating}>
          {updating ? <span className={styles.spinner} /> : '✈️ Mark as In Transit'}
        </button>
      )}
      {order.status === 'transit' && (
        <button className={`${styles.actionBtn} ${styles.actionBtnPurple}`} onClick={() => directUpdate('arrived')} disabled={updating}>
          {updating ? <span className={styles.spinner} /> : '🏙️ Mark as Arrived in City'}
        </button>
      )}
      {order.status === 'arrived' && (
        <div className={styles.lastMileBadge}>🏠 Ready for Last Mile</div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AgentDashboard({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [actionOrder, setActionOrder] = useState<Order | null>(null)
  const [actionType, setActionType] = useState<'ordered' | 'warehouse' | null>(null)

  const country = profile.assigned_country || ''
  const flag = COUNTRY_FLAGS[country] || '🌍'

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) { setLoading(false); return }

      const res = await fetch('/api/agent/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: session.access_token }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        console.error('[AgentDashboard] fetch error:', data.error)
        setOrders([])
      } else {
        setOrders(data.orders || [])
      }
    } catch (e) {
      console.error('[AgentDashboard] exception:', e)
      setOrders([])
    }
    setLoading(false)
  }

  useEffect(() => { fetchOrders() }, [country])

  const needsAction = orders.filter(o => o.status === 'confirmed')
  const inProgress  = orders.filter(o => ['ordered', 'warehouse', 'transit', 'arrived'].includes(o.status))
  const completed   = orders.filter(o => o.status === 'delivered')

  const handlePhotoAction = (order: Order, type: 'ordered' | 'warehouse') => {
    setActionOrder(order)
    setActionType(type)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.logoText}>ShipIQ</span>
          <span style={{ color: 'var(--border)', fontSize: 16, margin: '0 2px' }}>|</span>
          <span style={{ fontSize: 22 }}>{flag}</span>
          <span className={styles.agentName}>{country} Agent</span>
        </div>
        <div className={styles.topBarRight}>
          <span className={styles.agentName}>{profile.full_name}</span>
          <button className={styles.refreshBtn} onClick={fetchOrders}>↻</button>
          <button className={styles.signOutBtn} onClick={onSignOut}>Sign Out</button>
        </div>
      </div>

      <div className={styles.root}>
        <div className={styles.statsBar}>
          <div className={styles.stat}>
            <span className={styles.statNum} style={{ color: needsAction.length > 0 ? 'var(--orange)' : 'var(--text-dim)' }}>
              {needsAction.length}
            </span>
            <span className={styles.statLabel}>Needs Action</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{inProgress.length}</span>
            <span className={styles.statLabel}>In Progress</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum} style={{ color: completed.length > 0 ? 'var(--green)' : 'var(--text-dim)' }}>
              {completed.length}
            </span>
            <span className={styles.statLabel}>Completed</span>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingWrap}>
            <span className={`${styles.spinner} ${styles.spinnerLight}`} />
            <div>Loading orders...</div>
          </div>
        ) : (
          <>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span
                  className={styles.sectionDot}
                  style={{ background: 'var(--orange)', boxShadow: needsAction.length > 0 ? '0 0 6px var(--orange)' : 'none' }}
                />
                NEEDS ACTION ({needsAction.length})
              </div>
              {needsAction.length === 0 ? (
                <div className={styles.empty}>✅ All caught up — no pending actions!</div>
              ) : (
                needsAction.map(o => (
                  <OrderCard key={o.id} order={o} onPhotoAction={type => handlePhotoAction(o, type)} onRefresh={fetchOrders} />
                ))
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionDot} style={{ background: 'var(--blue)' }} />
                IN PROGRESS ({inProgress.length})
              </div>
              {inProgress.length === 0 ? (
                <div className={styles.empty}>No orders in progress yet.</div>
              ) : (
                inProgress.map(o => (
                  <OrderCard key={o.id} order={o} onPhotoAction={type => handlePhotoAction(o, type)} onRefresh={fetchOrders} />
                ))
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionDot} style={{ background: 'var(--green)' }} />
                COMPLETED ({completed.length})
              </div>
              {completed.length === 0 ? (
                <div className={styles.empty}>No completed orders yet.</div>
              ) : (
                completed.map(o => (
                  <OrderCard key={o.id} order={o} onPhotoAction={type => handlePhotoAction(o, type)} onRefresh={fetchOrders} />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {actionOrder && actionType && (
        <ActionModal
          order={actionOrder}
          type={actionType}
          agentId={profile.id}
          onClose={() => { setActionOrder(null); setActionType(null) }}
          onDone={() => { setActionOrder(null); setActionType(null); fetchOrders() }}
        />
      )}
    </div>
  )
}
