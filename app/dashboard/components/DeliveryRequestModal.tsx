'use client'
import { useState } from 'react'
import type { Order, Profile } from '@/lib/types'
import { createDeliveryRequest, deductBalance } from '@/lib/api'
import styles from '../dashboard.module.css'

const IQD_PER_USD = 1540

const DELIVERY_OPTS = [
  { id: 'pickup',        label: 'Pickup from office',        labelAr: 'استلام من المكتب',      icon: '🏢', fee: 0    },
  { id: 'home_erbil',    label: 'Home delivery — Erbil',     labelAr: 'توصيل منزلي — أربيل',   icon: '🚗', fee: 3000 },
  { id: 'home_baghdad',  label: 'Home delivery — Baghdad',   labelAr: 'توصيل منزلي — بغداد',   icon: '🚗', fee: 5000 },
] as const

interface Props {
  profile: Profile
  arrivedOrders: Order[]
  onClose: () => void
  onDone: () => void
}

export default function DeliveryRequestModal({ profile, arrivedOrders, onClose, onDone }: Props) {
  const [step, setStep] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deliveryType, setDeliveryType] = useState<string>('pickup')
  const [address, setAddress] = useState(profile.delivery_address || '')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const opt = DELIVERY_OPTS.find(d => d.id === deliveryType) ?? DELIVERY_OPTS[0]
  const isHome = deliveryType !== 'pickup'

  const toggleOrder = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const goNext = () => {
    if (step === 1) {
      if (selectedIds.length === 0) { setError('Select at least one order'); return }
      setError(''); setStep(2)
    } else if (step === 2) {
      if (isHome && !address.trim()) { setError('Enter your delivery address'); return }
      setError(''); setStep(3)
    }
  }

  const feeUsd = opt.fee / IQD_PER_USD
  const balanceUsd = profile.balance_usd ?? 0

  const confirm = async () => {
    if (opt.fee > 0 && balanceUsd + 0.001 < feeUsd) {
      setError(`Insufficient balance. You need $${feeUsd.toFixed(2)}.`)
      return
    }
    setLoading(true); setError('')
    const { error: createErr } = await createDeliveryRequest(profile.id, {
      order_ids: selectedIds,
      delivery_preference: deliveryType,
      delivery_address: isHome ? address : undefined,
      delivery_notes: notes || undefined,
      delivery_fee: opt.fee,
    })
    if (createErr) { setError(createErr); setLoading(false); return }
    if (opt.fee > 0) {
      await deductBalance(profile.id, balanceUsd, feeUsd, IQD_PER_USD, `Delivery fee — ${opt.label}`)
    }
    setLoading(false)
    onDone()
    onClose()
  }

  const stepLabel = ['', 'Select Orders', 'Delivery Type', 'Confirm'][step]

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Schedule Delivery · جدولة التوصيل</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 16 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: step >= s ? 'var(--gold)' : 'var(--surface2)',
                color: step >= s ? 'var(--bg)' : 'var(--text-dim)',
                border: `2px solid ${step >= s ? 'var(--gold)' : 'var(--border)'}`,
                flexShrink: 0,
              }}>{s}</div>
              {s < 3 && <div style={{ width: 20, height: 2, background: step > s ? 'var(--gold)' : 'var(--border)', borderRadius: 1 }} />}
            </div>
          ))}
          <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 6 }}>{stepLabel}</span>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {/* Step 1: Select orders */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Select which arrived orders to include in this delivery:
            </div>
            {arrivedOrders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📦</div>
                <div className={styles.emptyTitle}>No arrived orders available</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>All arrived orders already have delivery requests</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
                {arrivedOrders.map(o => (
                  <div
                    key={o.id}
                    onClick={() => toggleOrder(o.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      background: selectedIds.includes(o.id) ? 'rgba(201,168,76,0.08)' : 'var(--surface2)',
                      border: `1px solid ${selectedIds.includes(o.id) ? 'rgba(201,168,76,0.4)' : 'var(--border)'}`,
                      borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox" readOnly
                      checked={selectedIds.includes(o.id)}
                      style={{ accentColor: 'var(--gold)', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                    />
                    {o.photo_url && (
                      <img src={o.photo_url} alt="" loading="lazy" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{o.id}</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>🏙️ Arrived</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={styles.btnGhost} style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button className={styles.btnPrimary} style={{ flex: 1 }} onClick={goNext} disabled={selectedIds.length === 0}>
                Next → ({selectedIds.length} selected)
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Delivery type */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>How would you like to receive your orders?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {DELIVERY_OPTS.map(o => (
                <div
                  key={o.id}
                  onClick={() => setDeliveryType(o.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px',
                    background: deliveryType === o.id ? 'rgba(201,168,76,0.08)' : 'var(--surface2)',
                    border: `1.5px solid ${deliveryType === o.id ? 'var(--gold)' : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{o.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{o.labelAr}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: o.fee === 0 ? 'var(--green)' : 'var(--gold)' }}>
                    {o.fee === 0 ? 'Free' : `${o.fee.toLocaleString()} IQD`}
                  </div>
                </div>
              ))}
            </div>
            {isHome && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Delivery Address · عنوان التوصيل *</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Street, neighborhood, landmark..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  rows={3}
                />
              </div>
            )}
            <div className={styles.formGroup}>
              <label className={styles.label}>Notes (optional) · ملاحظات</label>
              <textarea
                className={styles.textarea}
                placeholder="Any special delivery instructions..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={styles.btnGhost} style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
              <button className={styles.btnPrimary} style={{ flex: 1 }} onClick={goNext}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Summary · الملخص</div>
              {[
                ['Orders', `${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''}`],
                ['Delivery', opt.label],
                ...(isHome && address ? [['Address', address]] : []),
                ...(notes ? [['Notes', notes]] : []),
              ].map(([k, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, gap: 12 }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right', fontSize: k === 'Address' ? 12 : 13 }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                <span style={{ color: 'var(--text-muted)' }}>Delivery Fee</span>
                <span style={{ color: opt.fee === 0 ? 'var(--green)' : 'var(--gold)' }}>
                  {opt.fee === 0 ? 'Free' : `${opt.fee.toLocaleString()} IQD`}
                </span>
              </div>
            </div>
            {opt.fee > 0 && (
              <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Balance after payment</span>
                <span style={{ fontWeight: 700, color: balanceUsd >= feeUsd ? 'var(--text)' : '#ef4444' }}>
                  ${(balanceUsd - feeUsd).toFixed(2)}
                </span>
              </div>
            )}
            {opt.fee > 0 && balanceUsd < feeUsd && (
              <div className={styles.errorBox} style={{ marginBottom: 12 }}>
                ⚠️ Insufficient balance. You need ${(feeUsd - balanceUsd).toFixed(2)} more.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={styles.btnGhost} style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
              <button
                className={styles.btnPrimary}
                style={{ flex: 1 }}
                onClick={confirm}
                disabled={loading || (opt.fee > 0 && balanceUsd < feeUsd)}
              >
                {loading ? <span className={styles.spinner} /> : opt.fee === 0 ? '✅ Confirm Pickup' : `✅ Pay & Confirm`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
