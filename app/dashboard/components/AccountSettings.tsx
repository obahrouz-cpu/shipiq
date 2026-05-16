'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile, Order } from '@/lib/types'
import styles from './AccountSettings.module.css'

// ── Phone helpers (same rules as signup) ──────────────────────────────────────

function formatIraqiPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('964')) digits = digits.slice(3)
  if (digits.startsWith('0'))   digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

function displayPhone(phone?: string | null): string {
  if (!phone) return 'Not set'
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('964') && digits.length === 13) {
    const local = digits.slice(3)
    return `+964 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }
  return phone
}

// ── Notification prefs (persisted to localStorage) ────────────────────────────

const NOTIF_KEY = 'shipiq_notif_prefs'
interface NotifPrefs { orders: boolean; balance: boolean; promos: boolean; language: 'en' | 'ar' | 'both' }

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    if (raw) return JSON.parse(raw) as NotifPrefs
  } catch {}
  return { orders: true, balance: true, promos: true, language: 'both' }
}

// ── Small shared sub-components ───────────────────────────────────────────────

function Feedback({ ok, text }: { ok: boolean; text: string }) {
  return <div className={`${styles.msg} ${ok ? styles.msgOk : styles.msgErr}`}>{text}</div>
}

function Spinner({ dark }: { dark?: boolean }) {
  return <span className={`${styles.spinner} ${dark ? styles.spinnerDark : ''}`} />
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className={styles.toggleSlider} />
    </label>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  profile: Profile
  orders: Order[]
  onClose: () => void
  onProfileUpdate: (updated: Partial<Profile>) => void
  onSignOut: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountSettings({ profile, orders, onClose, onProfileUpdate, onSignOut }: Props) {
  const supabase = createClient()

  // ── Profile: name ──────────────────────────────────────────────────────────
  const [editingName, setEditingName]   = useState(false)
  const [name, setName]                 = useState(profile.full_name)
  const [nameLoading, setNameLoading]   = useState(false)
  const [nameMsg, setNameMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  // ── Profile: phone ─────────────────────────────────────────────────────────
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneDisplay, setPhoneDisplay] = useState(formatIraqiPhone(profile.phone || ''))
  const [phoneError, setPhoneError]     = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneMsg, setPhoneMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  // ── Notifications ──────────────────────────────────────────────────────────
  const [notifOrders, setNotifOrders]   = useState(true)
  const [notifBalance, setNotifBalance] = useState(true)
  const [notifPromos, setNotifPromos]   = useState(true)
  const [language, setLanguage]         = useState<'en' | 'ar' | 'both'>('both')
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifMsg, setNotifMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  // ── Security ───────────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [pwLoading, setPwLoading]   = useState(false)
  const [pwMsg, setPwMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  // Load notification prefs from localStorage after mount
  useEffect(() => {
    const prefs = loadNotifPrefs()
    setNotifOrders(prefs.orders)
    setNotifBalance(prefs.balance)
    setNotifPromos(prefs.promos)
    setLanguage(prefs.language)
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function saveName() {
    if (!name.trim()) return
    setNameLoading(true); setNameMsg(null)
    const { error } = await supabase
      .from('profiles').update({ full_name: name.trim() }).eq('id', profile.id)
    setNameLoading(false)
    if (error) {
      setNameMsg({ ok: false, text: 'Failed to save. Please try again.' })
    } else {
      setNameMsg({ ok: true, text: 'Name updated successfully!' })
      onProfileUpdate({ full_name: name.trim() })
      setEditingName(false)
      setTimeout(() => setNameMsg(null), 3000)
    }
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatIraqiPhone(e.target.value)
    setPhoneDisplay(formatted)
    setPhoneError('')
  }

  async function savePhone() {
    const digits = phoneDisplay.replace(/\D/g, '')
    if (!digits) { setPhoneError('Phone number is required · الهاتف مطلوب'); return }
    if (digits.length !== 10 || !digits.startsWith('7')) {
      setPhoneError('Please enter a valid Iraqi phone number · الرجاء إدخال رقم هاتف عراقي صحيح')
      return
    }
    const normalized = `+964${digits}`
    setPhoneLoading(true); setPhoneMsg(null)
    const { error } = await supabase
      .from('profiles').update({ phone: normalized }).eq('id', profile.id)
    setPhoneLoading(false)
    if (error) {
      setPhoneMsg({ ok: false, text: 'Failed to save. Please try again.' })
    } else {
      setPhoneMsg({ ok: true, text: 'Phone updated successfully!' })
      onProfileUpdate({ phone: normalized })
      setEditingPhone(false)
      setTimeout(() => setPhoneMsg(null), 3000)
    }
  }

  function saveNotifPrefs() {
    setNotifLoading(true)
    try {
      const prefs: NotifPrefs = { orders: notifOrders, balance: notifBalance, promos: notifPromos, language }
      localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs))
      setNotifMsg({ ok: true, text: 'Preferences saved!' })
    } catch {
      setNotifMsg({ ok: false, text: 'Could not save preferences.' })
    }
    setNotifLoading(false)
    setTimeout(() => setNotifMsg(null), 2500)
  }

  async function changePassword() {
    if (!currentPw) { setPwMsg({ ok: false, text: 'Please enter your current password.' }); return }
    if (newPw.length < 6) { setPwMsg({ ok: false, text: 'New password must be at least 6 characters.' }); return }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Passwords do not match.' }); return }
    setPwLoading(true); setPwMsg(null)
    // Verify current password by re-authenticating
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: profile.email, password: currentPw })
    if (authErr) {
      setPwMsg({ ok: false, text: 'Current password is incorrect.' })
      setPwLoading(false); return
    }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) {
      setPwMsg({ ok: false, text: error.message })
    } else {
      setPwMsg({ ok: true, text: 'Password changed successfully!' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwMsg(null), 3500)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />

      <div className={styles.panel} role="dialog" aria-label="Account Settings">

        {/* ── Header ── */}
        <div className={styles.header}>
          <div>
            <div className={styles.headerTitle}>Account Settings · الإعدادات</div>
            <div className={styles.headerSub}>Manage your profile and preferences</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Scrollable content ── */}
        <div className={styles.content}>

          {/* ── 1. PROFILE ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Profile</div>
            <div className={styles.card}>

              {/* Avatar row */}
              <div className={styles.avatarRow}>
                <div className={styles.avatar}>{(name || profile.full_name)?.[0]?.toUpperCase() || '?'}</div>
                <div>
                  <div className={styles.avatarName}>{profile.full_name}</div>
                  <div className={styles.avatarRole}>{profile.role === 'admin' ? '🔧 Admin' : '👤 Customer'}</div>
                </div>
              </div>

              {/* Name */}
              {editingName ? (
                <div className={styles.editForm}>
                  <input
                    className={styles.input}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Full name"
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    autoFocus
                  />
                  <div className={styles.editBtns}>
                    <button className={styles.btnSave} onClick={saveName} disabled={nameLoading}>
                      {nameLoading ? <Spinner /> : 'Save'}
                    </button>
                    <button className={styles.btnCancel} onClick={() => { setEditingName(false); setName(profile.full_name); setNameMsg(null) }}>
                      Cancel
                    </button>
                  </div>
                  {nameMsg && <Feedback ok={nameMsg.ok} text={nameMsg.text} />}
                </div>
              ) : (
                <div className={styles.fieldRow}>
                  <span className={styles.fieldKey}>Name</span>
                  <span className={styles.fieldVal}>{profile.full_name}</span>
                  <button className={styles.editBtn} onClick={() => setEditingName(true)}>Edit</button>
                </div>
              )}

              {/* Phone */}
              {editingPhone ? (
                <div className={styles.editForm}>
                  <div className={`${styles.phoneGroup} ${phoneError ? styles.phoneGroupError : ''}`}>
                    <span className={styles.phonePrefix}>+964</span>
                    <input
                      className={styles.phoneInput}
                      type="tel"
                      placeholder="770 123 4567"
                      value={phoneDisplay}
                      onChange={handlePhoneChange}
                      maxLength={12}
                      autoFocus
                    />
                  </div>
                  {phoneError && <div className={styles.fieldError}>{phoneError}</div>}
                  <div className={styles.editBtns}>
                    <button className={styles.btnSave} onClick={savePhone} disabled={phoneLoading}>
                      {phoneLoading ? <Spinner /> : 'Save'}
                    </button>
                    <button className={styles.btnCancel} onClick={() => { setEditingPhone(false); setPhoneDisplay(formatIraqiPhone(profile.phone || '')); setPhoneError(''); setPhoneMsg(null) }}>
                      Cancel
                    </button>
                  </div>
                  {phoneMsg && <Feedback ok={phoneMsg.ok} text={phoneMsg.text} />}
                </div>
              ) : (
                <div className={styles.fieldRow}>
                  <span className={styles.fieldKey}>Phone</span>
                  <span className={styles.fieldVal}>{displayPhone(profile.phone)}</span>
                  <button className={styles.editBtn} onClick={() => setEditingPhone(true)}>Edit</button>
                </div>
              )}

              {/* Email (read-only) */}
              <div className={styles.fieldRow}>
                <span className={styles.fieldKey}>Email</span>
                <span className={styles.fieldVal}>{profile.email}</span>
              </div>

            </div>
          </div>

          {/* ── 2. NOTIFICATIONS ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Notifications · الإشعارات</div>
            <div className={styles.card}>

              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Order status updates</div>
                  <div className={styles.toggleSub}>Get notified when your order status changes</div>
                </div>
                <Toggle checked={notifOrders} onChange={setNotifOrders} />
              </div>

              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Balance updates</div>
                  <div className={styles.toggleSub}>Notifications when balance is added or deducted</div>
                </div>
                <Toggle checked={notifBalance} onChange={setNotifBalance} />
              </div>

              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Promotions & announcements</div>
                  <div className={styles.toggleSub}>New stores, features and ShipIQ news</div>
                </div>
                <Toggle checked={notifPromos} onChange={setNotifPromos} />
              </div>

              <div className={styles.langRow}>
                <span className={styles.toggleLabel}>Language · اللغة</span>
                <div className={styles.langOptions}>
                  {(['en', 'ar', 'both'] as const).map(l => (
                    <button
                      key={l}
                      className={`${styles.langBtn} ${language === l ? styles.langBtnActive : ''}`}
                      onClick={() => setLanguage(l)}
                    >
                      {l === 'en' ? 'EN' : l === 'ar' ? 'عر' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.saveRow}>
                <button className={styles.btnSave} onClick={saveNotifPrefs} disabled={notifLoading}>
                  {notifLoading ? <Spinner /> : 'Save preferences'}
                </button>
                {notifMsg && <Feedback ok={notifMsg.ok} text={notifMsg.text} />}
              </div>

            </div>
          </div>

          {/* ── 3. SECURITY ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Security · الأمان</div>
            <div className={styles.card}>

              <div className={styles.editForm} style={{ borderBottom: 'none' }}>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Current password · كلمة المرور الحالية"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                />
                <input
                  className={styles.input}
                  type="password"
                  placeholder="New password · كلمة المرور الجديدة"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                />
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Confirm new password · تأكيد كلمة المرور"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && changePassword()}
                />
                <button className={styles.btnSave} onClick={changePassword} disabled={pwLoading}>
                  {pwLoading ? <Spinner /> : 'Change Password · تغيير كلمة المرور'}
                </button>
                {pwMsg && <Feedback ok={pwMsg.ok} text={pwMsg.text} />}
              </div>

            </div>
          </div>

          {/* ── 4. ACCOUNT INFO ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Account Info · معلومات الحساب</div>
            <div className={styles.card}>

              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Member since</span>
                <span className={styles.infoVal}>{memberSince}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Total orders</span>
                <span className={styles.infoVal}>{orders.length}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Current balance</span>
                <span className={`${styles.infoVal} ${styles.infoValGold}`}>
                  {profile.balance?.toLocaleString()} IQD
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Account ID</span>
                <span className={styles.infoVal} style={{ fontSize: 11, fontFamily: 'monospace' }}>
                  {profile.id.slice(0, 16)}…
                </span>
              </div>

            </div>
          </div>

          {/* ── Sign out ── */}
          <button className={styles.signOutBtn} onClick={onSignOut}>
            ↪ Sign Out · تسجيل الخروج
          </button>

        </div>
      </div>
    </>
  )
}
