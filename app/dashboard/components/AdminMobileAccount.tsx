'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { updateLanguage } from '@/lib/api'
import type { Profile, Order } from '@/lib/types'
import { useLanguage } from '@/lib/useLanguage'

interface Props {
  profile: Profile
  orders: Order[]
  users: Profile[]
  pendingCount: number
  onNavigate: (page: string) => void
  onShowSettings: () => void
  onSignOut: () => void
}

export default function AdminMobileAccount({ profile, orders, users, pendingCount, onNavigate, onShowSettings, onSignOut }: Props) {
  const { language, setLanguage: applyLang } = useLanguage()
  const supabase = useMemo(() => createClient(), [])

  const [showPw, setShowPw] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const todayOrders = orders.filter(o => o.created_at?.startsWith(today)).length

  async function handleLangChange(lang: 'en' | 'ar') {
    applyLang(lang)
    try { await updateLanguage(profile.id, lang) } catch {}
  }

  async function changePassword() {
    if (!currentPw) { setPwMsg({ ok: false, text: 'Enter your current password.' }); return }
    if (newPw.length < 6) { setPwMsg({ ok: false, text: 'New password must be 6+ characters.' }); return }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Passwords do not match.' }); return }
    setPwLoading(true); setPwMsg(null)
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: profile.email, password: currentPw })
    if (authErr) { setPwMsg({ ok: false, text: 'Current password is incorrect.' }); setPwLoading(false); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) {
      setPwMsg({ ok: false, text: error.message })
    } else {
      setPwMsg({ ok: true, text: 'Password changed!' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwMsg(null), 3000)
    }
  }

  const shortcuts = [
    { icon: '⚙️', label: 'Admin Settings', sub: 'WhatsApp number, message templates', onClick: () => onNavigate('admin-settings') },
    { icon: '👥', label: 'Customers', sub: 'Manage customer accounts', onClick: () => onNavigate('admin-customers') },
    { icon: '📋', label: 'All Orders', sub: 'View and manage orders', onClick: () => onNavigate('admin-orders') },
    { icon: '📊', label: 'Analytics', sub: 'Revenue and performance', onClick: () => onNavigate('admin-analytics') },
  ]

  return (
    <div style={{ padding: '0 0 100px' }}>

      {/* Profile card */}
      <div style={{
        background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14,
        padding: '20px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: 'var(--bg)', flexShrink: 0,
        }}>
          {profile.full_name?.[0] || '?'}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{profile.full_name}</div>
          <div style={{
            display: 'inline-block', marginTop: 4, padding: '2px 8px',
            background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--gold)',
          }}>🔧 Admin</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{profile.email}</div>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Orders Today', value: todayOrders, icon: '📋', color: '#5b9bd5' },
          { label: 'Customers', value: users.length, icon: '👥', color: '#16a34a' },
          { label: 'Pending', value: pendingCount, icon: '⏳', color: '#e07b3a' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '12px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Shortcuts */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
        {shortcuts.map((item, i) => (
          <button key={i} onClick={item.onClick} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px', background: 'transparent', border: 'none',
            borderBottom: i < shortcuts.length - 1 ? '1px solid var(--border)' : 'none',
            cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{item.sub}</div>
            </div>
            <span style={{ color: 'var(--text-dim)', fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>

      {/* Language + Change Password */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>

        {/* Language toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>🌐</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>Language</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['en', 'ar'] as const).map(l => (
              <button key={l} onClick={() => handleLangChange(l)} style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 700,
                background: language === l ? 'var(--gold)' : 'transparent',
                color: language === l ? 'var(--bg)' : 'var(--text-muted)',
                border: '1px solid ' + (language === l ? 'var(--gold)' : 'var(--border)'),
                borderRadius: 6, cursor: 'pointer',
              }}>
                {l === 'en' ? 'EN' : 'AR'}
              </button>
            ))}
          </div>
        </div>

        {/* Change password toggle */}
        <button onClick={() => setShowPw(v => !v)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px', background: 'transparent', border: 'none',
          borderBottom: showPw ? '1px solid var(--border)' : 'none',
          cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>🔒</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>Change Password</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 18 }}>{showPw ? '∨' : '›'}</span>
        </button>

        {showPw && (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { placeholder: 'Current password', value: currentPw, set: setCurrentPw },
              { placeholder: 'New password (6+ characters)', value: newPw, set: setNewPw },
              { placeholder: 'Confirm new password', value: confirmPw, set: setConfirmPw },
            ].map((f, i) => (
              <input key={i} type="password" placeholder={f.placeholder} value={f.value}
                onChange={e => f.set(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
                }}
              />
            ))}
            <button onClick={changePassword} disabled={pwLoading} style={{
              padding: '10px', fontSize: 13, fontWeight: 700,
              background: 'var(--gold)', color: 'var(--bg)',
              border: 'none', borderRadius: 8, cursor: pwLoading ? 'not-allowed' : 'pointer', opacity: pwLoading ? 0.7 : 1,
            }}>
              {pwLoading ? '...' : 'Update Password'}
            </button>
            {pwMsg && (
              <div style={{ fontSize: 12, color: pwMsg.ok ? '#16a34a' : '#ef4444', textAlign: 'center' }}>
                {pwMsg.text}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Sign Out */}
      <button onClick={onSignOut} style={{
        width: '100%', padding: '14px', fontSize: 14, fontWeight: 700,
        background: 'rgba(239,68,68,0.08)', color: '#ef4444',
        border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14,
        cursor: 'pointer',
      }}>
        🚪 Sign Out
      </button>

    </div>
  )
}
