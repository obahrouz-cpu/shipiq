'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Order, Profile } from '@/lib/types'
import { createDeliveryBundle, deductBalance, getDeliveryFeeIqd } from '@/lib/api'
import styles from '../dashboard.module.css'

const MapPicker = dynamic(() => import('./MapPicker'), { ssr: false })

const DEFAULT_LAT = 33.3152
const DEFAULT_LNG = 44.3661

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    return data.display_name || ''
  } catch {
    return ''
  }
}

interface Props {
  profile: Profile
  arrivedOrders: Order[]      // selectable — currently in the in-city warehouse
  inTransitOrders: Order[]    // informational — still on the way
  iqdRate: number
  onClose: () => void
  onDone: () => void
}

export default function DeliveryRequestModal({ profile, arrivedOrders, inTransitOrders, iqdRate, onClose, onDone }: Props) {
  // Default to everything that's arrived selected — the common case is "send it all".
  const [selectedIds, setSelectedIds] = useState<string[]>(() => arrivedOrders.map(o => o.id))
  const [feeIqd, setFeeIqd] = useState<number | null>(null)
  // Default: pay the fee in cash on handover. Opt in to deduct from balance instead.
  const [payFromBalance, setPayFromBalance] = useState(false)

  // Address — pre-filled from the customer's saved profile address, overridable per bundle.
  const hasSavedAddress = !!(profile.delivery_lat && profile.delivery_lng)
  const [editingAddress, setEditingAddress] = useState(!hasSavedAddress)
  const [lat, setLat] = useState(profile.delivery_lat || DEFAULT_LAT)
  const [lng, setLng] = useState(profile.delivery_lng || DEFAULT_LNG)
  const [address, setAddress] = useState(profile.delivery_address || '')
  const [notes, setNotes] = useState('')
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getDeliveryFeeIqd().then(setFeeIqd) }, [])

  const handleMapMove = useCallback((newLat: number, newLng: number) => {
    setLat(newLat); setLng(newLng)
    if (geoTimer.current) clearTimeout(geoTimer.current)
    geoTimer.current = setTimeout(async () => {
      const a = await reverseGeocode(newLat, newLng)
      if (a) setAddress(a)
    }, 800)
  }, [])

  const toggleOrder = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const balanceUsd = profile.balance_usd ?? 0
  const feeIqdVal = feeIqd ?? 0
  const feeUsdEquiv = iqdRate > 0 ? feeIqdVal / iqdRate : 0
  // Balance only matters when the customer chooses to pay from balance.
  const insufficient = payFromBalance && balanceUsd + 0.001 < feeUsdEquiv
  const hasAddress = !!address.trim() || (lat !== DEFAULT_LAT || lng !== DEFAULT_LNG)

  const confirm = async () => {
    if (selectedIds.length === 0) { setError('Select at least one order to deliver'); return }
    if (!hasAddress) { setError('Set your delivery address'); return }
    if (insufficient) { setError(`Insufficient balance. You need $${feeUsdEquiv.toFixed(2)} to pay from balance.`); return }
    setLoading(true); setError('')
    const { error: createErr } = await createDeliveryBundle(profile.id, {
      order_ids: selectedIds,
      delivery_address: address || undefined,
      delivery_lat: lat,
      delivery_lng: lng,
      delivery_notes: notes || undefined,
      delivery_fee: feeIqdVal,
      payment_method: payFromBalance ? 'balance' : 'cash',
    })
    if (createErr) { setError(createErr); setLoading(false); return }
    if (payFromBalance && feeUsdEquiv > 0) {
      await deductBalance(profile.id, balanceUsd, feeUsdEquiv, iqdRate, 'Home delivery fee')
    }
    // Notify the customer their items are out for delivery (fire-and-forget).
    selectedIds.forEach(orderId => {
      fetch('/api/whatsapp/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, event: 'out_for_delivery' }),
      }).catch(() => {})
    })
    setLoading(false)
    onDone()
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>📦 Deliver my products · توصيل منتجاتي</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {/* ── Arrived orders (selectable) ── */}
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
          Select which arrived items to deliver to your door:
        </div>
        {arrivedOrders.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📦</div>
            <div className={styles.emptyTitle}>No items ready to deliver</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Items appear here once they arrive in your city</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', marginBottom: 14 }}>
            {arrivedOrders.map(o => {
              const sel = selectedIds.includes(o.id)
              return (
                <div
                  key={o.id}
                  onClick={() => toggleOrder(o.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: sel ? 'rgba(201,168,76,0.08)' : 'var(--surface2)',
                    border: `1px solid ${sel ? 'rgba(201,168,76,0.4)' : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox" readOnly checked={sel}
                    style={{ accentColor: 'var(--gold)', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                  />
                  {o.photo_url && (
                    <img src={o.photo_url} alt="" loading="lazy" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'monospace' }}>{o.id}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>🏙️ Arrived</span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Still in transit (informational, non-selectable) ── */}
        {inTransitOrders.length > 0 && (
          <div style={{ padding: '10px 14px', background: 'rgba(91,155,213,0.06)', border: '1px solid rgba(91,155,213,0.2)', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 6 }}>
              ✈️ {inTransitOrders.length} more item{inTransitOrders.length > 1 ? 's' : ''} still on the way
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {inTransitOrders.slice(0, 5).map(o => (
                <div key={o.id} style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  • {o.description}
                </div>
              ))}
              {inTransitOrders.length > 5 && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>…and {inTransitOrders.length - 5} more</div>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, fontStyle: 'italic' }}>
              You can deliver these in a later bundle once they arrive.
            </div>
          </div>
        )}

        {/* ── Delivery address ── */}
        <div className={styles.formGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className={styles.label} style={{ marginBottom: 0 }}>Delivery Address · عنوان التوصيل</label>
            {hasSavedAddress && (
              <button
                onClick={() => setEditingAddress(v => !v)}
                style={{ fontSize: 11, padding: '3px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                {editingAddress ? 'Use saved address' : 'Use a different address'}
              </button>
            )}
          </div>

          {!editingAddress && hasSavedAddress ? (
            <div style={{ padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, marginBottom: 4 }}>📍 Saved location</div>
              {address && <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{address}</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Tap the map to set your delivery location</div>
              <div style={{ borderRadius: 10, overflow: 'hidden' }}>
                <MapPicker lat={lat} lng={lng} onMove={handleMapMove} height={200} />
              </div>
              <textarea
                className={styles.textarea}
                placeholder="Address (auto-filled from map)"
                value={address}
                onChange={e => setAddress(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Notes (optional) · ملاحظات</label>
          <textarea
            className={styles.textarea}
            placeholder="Building, floor, landmark, special instructions..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* ── Fee summary ── */}
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>Items selected</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{selectedIds.length}</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
            <span style={{ color: 'var(--text-muted)' }}>Flat Delivery Fee · رسوم التوصيل</span>
            <span style={{ color: 'var(--gold)', textAlign: 'right' }}>
              {feeIqd === null ? '…' : feeIqdVal === 0 ? 'Free' : (
                <>
                  {feeIqdVal.toLocaleString()} IQD
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>≈ ${feeUsdEquiv.toFixed(2)}</span>
                </>
              )}
            </span>
          </div>

          {/* Payment method — cash on delivery by default, or deduct from balance */}
          {feeIqdVal > 0 && (
            <>
              <label
                onClick={() => setPayFromBalance(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', marginTop: 12, cursor: 'pointer',
                  background: payFromBalance ? 'rgba(201,168,76,0.10)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${payFromBalance ? 'rgba(201,168,76,0.35)' : 'var(--border)'}`, borderRadius: 8,
                }}
              >
                <span style={{
                  width: 18, height: 18, flexShrink: 0, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: payFromBalance ? 'var(--gold)' : 'transparent',
                  border: `2px solid ${payFromBalance ? 'var(--gold)' : 'var(--border)'}`, color: '#0f0e0c', fontSize: 12, fontWeight: 800,
                }}>{payFromBalance ? '✓' : ''}</span>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>💳 Pay now from my balance · ادفع من رصيدي</span>
              </label>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                {payFromBalance ? (
                  <span>Balance after payment: <strong style={{ color: insufficient ? '#ef4444' : 'var(--text)' }}>${(balanceUsd - feeUsdEquiv).toFixed(2)}</strong></span>
                ) : (
                  <span>💵 Pay {feeIqdVal.toLocaleString()} IQD in cash when your order is handed over.</span>
                )}
              </div>
            </>
          )}
        </div>

        {insufficient && (
          <div className={styles.errorBox} style={{ marginBottom: 12 }}>
            ⚠️ Insufficient balance to pay from balance — you need ${(feeUsdEquiv - balanceUsd).toFixed(2)} more, or pay cash on delivery instead.
          </div>
        )}

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button
            className={styles.btnPrimary}
            onClick={confirm}
            disabled={loading || feeIqd === null || selectedIds.length === 0 || insufficient}
          >
            {loading ? <span className={styles.spinner} /> : '✅ Confirm Delivery · تأكيد التوصيل'}
          </button>
        </div>
      </div>
    </div>
  )
}
