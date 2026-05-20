'use client'
import { useState, useEffect } from 'react'
import { updateLanguage, getTierSettings, updateProfile, changePassword } from '@/lib/api'
import type { Profile, Order, TierSettings } from '@/lib/types'
import { useLanguage } from '@/lib/useLanguage'
import type { Lang } from '@/lib/useLanguage'
import DeliveryAddress from './DeliveryAddress'
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
interface NotifPrefs { orders: boolean; balance: boolean; promos: boolean }

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    if (raw) return JSON.parse(raw) as NotifPrefs
  } catch {}
  return { orders: true, balance: true, promos: true }
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
  mode?: 'panel' | 'page'
  onClose: () => void
  onProfileUpdate: (updated: Partial<Profile>) => void
  onSignOut: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountSettings({ profile, orders, mode, onClose, onProfileUpdate, onSignOut }: Props) {
  const isPageMode = mode === 'page'
  const { language, t, setLanguage: applyLang } = useLanguage()
  const [localProfile, setLocalProfile] = useState(profile)

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
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifMsg, setNotifMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  // ── Tiers ──────────────────────────────────────────────────────────────────
  const [tierSettings, setTierSettings] = useState<TierSettings[]>([])
  useEffect(() => { if (profile.role === 'customer') getTierSettings().then(setTierSettings) }, [profile.role])

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
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function saveName() {
    if (!name.trim()) return
    setNameLoading(true); setNameMsg(null)
    const { error } = await updateProfile(profile.id, { full_name: name.trim() })
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
    const { error } = await updateProfile(profile.id, { phone: normalized })
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
      const prefs: NotifPrefs = { orders: notifOrders, balance: notifBalance, promos: notifPromos }
      localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs))
      setNotifMsg({ ok: true, text: t('settings', 'prefsSaved') })
    } catch {
      setNotifMsg({ ok: false, text: t('settings', 'prefsError') })
    }
    setNotifLoading(false)
    setTimeout(() => setNotifMsg(null), 2500)
  }

  async function handleLangChange(lang: Lang) {
    applyLang(lang)
    try {
      await updateLanguage(profile.id, lang)
      onProfileUpdate({ language: lang })
    } catch {}
  }

  async function handleChangePassword() {
    if (!currentPw) { setPwMsg({ ok: false, text: 'Please enter your current password.' }); return }
    if (newPw.length < 6) { setPwMsg({ ok: false, text: 'New password must be at least 6 characters.' }); return }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Passwords do not match.' }); return }
    setPwLoading(true); setPwMsg(null)
    const { error } = await changePassword(profile.email, currentPw, newPw)
    setPwLoading(false)
    if (error) {
      setPwMsg({ ok: false, text: error })
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
      {!isPageMode && <div className={styles.overlay} onClick={onClose} />}

      <div className={`${styles.panel} ${isPageMode ? styles.pageMode : ''}`} role="dialog" aria-label="Account Settings">

        {/* ── Header (panel mode only) ── */}
        {!isPageMode && (
          <div className={styles.header}>
            <div>
              <div className={styles.headerTitle}>{t('settings', 'title')}</div>
              <div className={styles.headerSub}>{t('settings', 'sub')}</div>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>
        )}

        {/* ── Scrollable content ── */}
        <div className={`${styles.content} ${isPageMode ? styles.pageModeContent : ''}`}>

          {/* ── 0. MEMBERSHIP TIER (customers only) ── */}
          {profile.role === 'customer' && tierSettings.length > 0 && (() => {
            const sorted = [...tierSettings].sort((a, b) => a.min_spend - b.min_spend)
            const currentTierKey = profile.tier || 'bronze'
            const current = sorted.find(t => t.tier === currentTierKey) || sorted[0]
            const currentIdx = sorted.indexOf(current)
            const next = sorted[currentIdx + 1] ?? null
            const totalSpent = profile.total_spent || 0
            const prevMin = current.min_spend
            const nextMin = next?.min_spend ?? null
            const progress = nextMin != null ? Math.min(100, ((totalSpent - prevMin) / (nextMin - prevMin)) * 100) : 100
            const remaining = nextMin != null ? Math.max(0, nextMin - totalSpent) : 0
            const tierName = language === 'ar' ? current.name_ar : current.name_en
            return (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>{language === 'ar' ? 'مستوى العضوية' : 'Membership Tier'}</div>

                {/* Current tier hero card */}
                <div style={{
                  borderRadius: 12, border: `1px solid ${current.color}50`,
                  background: `linear-gradient(135deg, ${current.color}12 0%, ${current.color}05 100%)`,
                  boxShadow: `0 0 20px ${current.color}18`,
                  padding: '16px', marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 32, lineHeight: 1 }}>{current.icon}</span>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: current.color }}>{tierName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{totalSpent.toFixed(2)} USD spent</div>
                      </div>
                    </div>
                    {next && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Next tier</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: next.color }}>{next.icon} {language === 'ar' ? next.name_ar : next.name_en}</div>
                      </div>
                    )}
                    {!next && <div style={{ fontSize: 12, fontWeight: 700, color: current.color }}>Max tier 👑</div>}
                  </div>
                  <div style={{ background: 'var(--surface3)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, width: `${progress}%`, background: `linear-gradient(90deg, ${current.color}80, ${current.color})`, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                    {next ? `${remaining.toFixed(2)} USD to ${language === 'ar' ? next.name_ar : next.name_en}` : "You've reached the highest tier!"}
                  </div>
                  {current.benefits && current.benefits !== 'Coming soon' && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: `${current.color}10`, borderRadius: 7, fontSize: 12, color: current.color, fontWeight: 600 }}>
                      ✨ {current.benefits}
                    </div>
                  )}
                </div>

                {/* All tiers list */}
                <div className={styles.card}>
                  {sorted.map((t, i) => {
                    const isCurrent = t.tier === currentTierKey
                    const isPassed = (profile.total_spent || 0) >= t.min_spend
                    const tName = language === 'ar' ? t.name_ar : t.name_en
                    return (
                      <div key={t.tier} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px',
                        borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                        background: isCurrent ? `${t.color}0a` : 'transparent',
                        transition: 'background 0.15s',
                      }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{t.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: isCurrent ? t.color : 'var(--text-muted)' }}>{tName}</span>
                            {isCurrent && (
                              <span style={{ fontSize: 9, fontWeight: 800, color: t.color, background: `${t.color}18`, border: `1px solid ${t.color}40`, borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                            {t.min_spend === 0 ? 'Starting tier' : `From $${t.min_spend} USD`}
                          </div>
                          {t.benefits && t.benefits !== 'Coming soon' && (
                            <div style={{ fontSize: 11, color: isCurrent ? t.color : 'var(--text-dim)', marginTop: 2, opacity: 0.85 }}>{t.benefits}</div>
                          )}
                        </div>
                        <div style={{ fontSize: 16, flexShrink: 0, opacity: isPassed ? 1 : 0.25 }}>
                          {isPassed ? '✅' : '🔒'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── 1. PROFILE ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('settings', 'profile')}</div>
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
                      {nameLoading ? <Spinner /> : t('settings', 'save')}
                    </button>
                    <button className={styles.btnCancel} onClick={() => { setEditingName(false); setName(profile.full_name); setNameMsg(null) }}>
                      {t('settings', 'cancel')}
                    </button>
                  </div>
                  {nameMsg && <Feedback ok={nameMsg.ok} text={nameMsg.text} />}
                </div>
              ) : (
                <div className={styles.fieldRow}>
                  <span className={styles.fieldKey}>{t('settings', 'name')}</span>
                  <span className={styles.fieldVal}>{profile.full_name}</span>
                  <button className={styles.editBtn} onClick={() => setEditingName(true)}>{t('settings', 'edit')}</button>
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
                      {phoneLoading ? <Spinner /> : t('settings', 'save')}
                    </button>
                    <button className={styles.btnCancel} onClick={() => { setEditingPhone(false); setPhoneDisplay(formatIraqiPhone(profile.phone || '')); setPhoneError(''); setPhoneMsg(null) }}>
                      {t('settings', 'cancel')}
                    </button>
                  </div>
                  {phoneMsg && <Feedback ok={phoneMsg.ok} text={phoneMsg.text} />}
                </div>
              ) : (
                <div className={styles.fieldRow}>
                  <span className={styles.fieldKey}>{t('settings', 'phone')}</span>
                  <span className={styles.fieldVal}>{displayPhone(profile.phone)}</span>
                  <button className={styles.editBtn} onClick={() => setEditingPhone(true)}>{t('settings', 'edit')}</button>
                </div>
              )}

              {/* Email (read-only) */}
              <div className={styles.fieldRow}>
                <span className={styles.fieldKey}>{t('settings', 'email')}</span>
                <span className={styles.fieldVal}>{profile.email}</span>
              </div>

            </div>
          </div>

          {/* ── 2. NOTIFICATIONS ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('settings', 'notifications')}</div>
            <div className={styles.card}>

              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>{t('settings', 'orderUpdates')}</div>
                  <div className={styles.toggleSub}>{t('settings', 'orderUpdatesSub')}</div>
                </div>
                <Toggle checked={notifOrders} onChange={setNotifOrders} />
              </div>

              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>{t('settings', 'balanceUpdates')}</div>
                  <div className={styles.toggleSub}>{t('settings', 'balanceUpdatesSub')}</div>
                </div>
                <Toggle checked={notifBalance} onChange={setNotifBalance} />
              </div>

              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>{t('settings', 'promos')}</div>
                  <div className={styles.toggleSub}>{t('settings', 'promosSub')}</div>
                </div>
                <Toggle checked={notifPromos} onChange={setNotifPromos} />
              </div>

              <div className={styles.saveRow}>
                <button className={styles.btnSave} onClick={saveNotifPrefs} disabled={notifLoading}>
                  {notifLoading ? <Spinner /> : t('settings', 'savePrefs')}
                </button>
                {notifMsg && <Feedback ok={notifMsg.ok} text={notifMsg.text} />}
              </div>

            </div>
          </div>

          {/* ── 2b. SITE LANGUAGE ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('settings', 'siteLanguage')}</div>
            <div className={styles.card}>
              <div className={styles.langRow}>
                <div className={styles.langOptions}>
                  {([
                    { code: 'en',     label: '🇬🇧 English' },
                    { code: 'ar',     label: '🇮🇶 العربية' },
                    { code: 'sorani', label: '🏔️ سۆرانی' },
                    { code: 'badini', label: '🏔️ بادینی' },
                  ] as { code: Lang; label: string }[]).map(({ code, label }) => (
                    <button
                      key={code}
                      className={`${styles.langBtn} ${language === code ? styles.langBtnActive : ''}`}
                      onClick={() => handleLangChange(code)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── 2c. DELIVERY ADDRESS (customers only) ── */}
          {profile.role === 'customer' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Delivery Address</div>
              <DeliveryAddress
                profile={localProfile}
                onSaved={updates => {
                  const merged = { ...localProfile, ...updates }
                  setLocalProfile(merged)
                  onProfileUpdate(updates)
                }}
              />
            </div>
          )}

          {/* ── 3. SECURITY ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('settings', 'security')}</div>
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
                  onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                />
                <button className={styles.btnSave} onClick={handleChangePassword} disabled={pwLoading}>
                  {pwLoading ? <Spinner /> : t('settings', 'changePw')}
                </button>
                {pwMsg && <Feedback ok={pwMsg.ok} text={pwMsg.text} />}
              </div>

            </div>
          </div>

          {/* ── 4. ACCOUNT INFO ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('settings', 'accountInfo')}</div>
            <div className={styles.card}>

              <div className={styles.infoRow}>
                <span className={styles.infoKey}>{t('settings', 'memberSince')}</span>
                <span className={styles.infoVal}>{memberSince}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>{t('settings', 'totalOrders')}</span>
                <span className={styles.infoVal}>{orders.length}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>{t('settings', 'currentBalance')}</span>
                <span className={`${styles.infoVal} ${styles.infoValGold}`}>
                  {profile.balance?.toLocaleString()} IQD
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>{t('settings', 'accountId')}</span>
                <span className={styles.infoVal} style={{ fontSize: 11, fontFamily: 'monospace' }}>
                  {profile.id.slice(0, 16)}…
                </span>
              </div>

            </div>
          </div>

          {/* ── Sign out ── */}
          <button className={`${styles.signOutBtn} ${isPageMode ? styles.signOutBtnPage : ''}`} onClick={onSignOut}>
            {t('settings', 'signOut')}
          </button>

        </div>
      </div>
    </>
  )
}
