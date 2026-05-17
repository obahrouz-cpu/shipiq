'use client'
import { useState, useEffect } from 'react'
import { getTierSettings, updateTierSettings } from '@/lib/api'
import type { TierSettings } from '@/lib/types'
import styles from '../dashboard.module.css'

interface Props {
  onClose: () => void
}

function Spinner() {
  return <span className={styles.spinner} />
}

export default function AdminTierSettings({ onClose }: Props) {
  const [tiers, setTiers] = useState<TierSettings[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getTierSettings().then(data => { setTiers(data); setLoading(false) })
  }, [])

  const update = (tier: string, field: keyof TierSettings, value: string | number | boolean) => {
    setTiers(prev => prev.map(t => t.tier === tier ? { ...t, [field]: value } : t))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await updateTierSettings(tiers)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 680, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Tier Settings ⚙️</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table} style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Tier</th>
                    <th style={{ width: 140 }}>Min Spend (USD)</th>
                    <th>Benefits</th>
                    <th style={{ width: 70 }}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map(t => (
                    <tr key={t.tier}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 18 }}>{t.icon}</span>
                          <span style={{ fontWeight: 700, color: t.color, fontSize: 13 }}>{t.name_en}</span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={t.min_spend}
                          onChange={e => update(t.tier, 'min_spend', parseFloat(e.target.value) || 0)}
                          style={{
                            width: 100, background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '5px 9px', color: 'var(--text)',
                            fontSize: 13, fontFamily: 'inherit', outline: 'none',
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={t.benefits}
                          onChange={e => update(t.tier, 'benefits', e.target.value)}
                          placeholder="Benefits text..."
                          style={{
                            width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '5px 9px', color: 'var(--text)',
                            fontSize: 13, fontFamily: 'inherit', outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={t.is_active}
                            onChange={e => update(t.tier, 'is_active', e.target.checked)}
                            style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }}
                          />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className={styles.btnPrimary} onClick={save} disabled={saving}>
                {saving ? <Spinner /> : 'Save Changes'}
              </button>
              {saved && <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Saved successfully</span>}
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Changes apply to new orders only</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
