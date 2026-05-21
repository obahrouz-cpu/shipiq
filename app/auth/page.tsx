'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { googleSignIn, emailSignIn, emailSignUp } from '@/lib/api'
import type { AuthForm } from '@/lib/types'
import { useLanguage } from '@/lib/useLanguage'
import styles from './auth.module.css'

// ── Phone helpers ─────────────────────────────────────────────────────────────

function formatIraqiPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  // Strip country code if user pastes a full number
  if (digits.startsWith('964')) digits = digits.slice(3)
  if (digits.startsWith('0'))   digits = digits.slice(1)
  digits = digits.slice(0, 10)
  // Format: 7XX XXX XXXX
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

function isValidIraqiPhone(phone: string): boolean {
  return /^\+9647\d{9}$/.test(phone)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const router = useRouter()
  const { language, setLanguage } = useLanguage()
  const isAr = language === 'ar'
  const [tab, setTab]         = useState<'login' | 'register'>('login')
  const [form, setForm]       = useState<AuthForm>({ name: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Phone field local state
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [phoneError, setPhoneError]     = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)

  const handle = (k: keyof AuthForm, v: string) => setForm(p => ({ ...p, [k]: v }))

  // Where to send the user after auth — supports ?redirect=/some/path (relative only).
  function postAuthDest(): string {
    if (typeof window === 'undefined') return '/dashboard'
    const param = new URLSearchParams(window.location.search).get('redirect')
    return param && param.startsWith('/') ? param : '/dashboard'
  }

  function validatePhone(display: string): boolean {
    const digits = display.replace(/\D/g, '')
    if (!digits) {
      setPhoneError('Phone number is required · الهاتف مطلوب')
      return false
    }
    if (digits.length !== 10 || !digits.startsWith('7')) {
      setPhoneError('Please enter a valid Iraqi phone number · الرجاء إدخال رقم هاتف عراقي صحيح')
      return false
    }
    setPhoneError('')
    return true
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIraqiPhone(e.target.value)
    setPhoneDisplay(formatted)
    const digits = formatted.replace(/\D/g, '')
    handle('phone', digits.length === 10 ? `+964${digits}` : '')
    if (phoneTouched) validatePhone(formatted)
  }

  const login = async () => {
    setLoading(true); setError('')
    const { session, error: err } = await emailSignIn(form.email, form.password)
    if (err) { setError(err); setLoading(false); return }
    if (session) {
      window.location.href = postAuthDest()
    } else {
      setError('No session returned — your email may not be confirmed yet.')
    }
    setLoading(false)
  }

  const register = async () => {
    setPhoneTouched(true)
    if (!validatePhone(phoneDisplay)) return
    setLoading(true); setError('')
    const { error: err } = await emailSignUp(form.email, form.password, form.name, form.phone)
    if (err) { setError(err); setLoading(false); return }
    router.push(postAuthDest())
  }

  return (
    <div className={styles.page} dir={isAr ? 'rtl' : 'ltr'}>
      <div className={styles.bg} />
      <div className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={() => setLanguage(isAr ? 'en' : 'ar')}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}
          >
            {isAr ? 'English' : 'عربي'}
          </button>
        </div>
        <div className={styles.logo}>
          <div className={styles.logoMark}>ShipIQ</div>
          <div className={`${styles.logoSub} ar`}>شيب آي كيو — خدمة الشحن الذكي</div>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'login' ? styles.active : ''}`} onClick={() => setTab('login')}>
            Sign In · تسجيل الدخول
          </button>
          <button className={`${styles.tab} ${tab === 'register' ? styles.active : ''}`} onClick={() => setTab('register')}>
            Register · تسجيل
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {tab === 'login' ? (
          <div>
            <button className={styles.btnGoogle} onClick={googleSignIn}>
              <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google · الدخول بجوجل
            </button>
            <div className={styles.divider}>or · أو</div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email · البريد الإلكتروني</label>
              <input className={styles.input} type="email" placeholder="email@example.com" value={form.email} onChange={e => handle('email', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Password · كلمة المرور</label>
              <input className={styles.input} type="password" placeholder="••••••••" value={form.password} onChange={e => handle('password', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()} />
            </div>
            <button className={styles.btnPrimary} onClick={login} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Sign In · دخول'}
            </button>
          </div>
        ) : (
          <div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Full Name · الاسم الكامل</label>
              <input className={styles.input} placeholder="Ahmed Hassan" value={form.name} onChange={e => handle('name', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email · البريد الإلكتروني</label>
              <input className={styles.input} type="email" placeholder="email@example.com" value={form.email} onChange={e => handle('email', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Phone · الهاتف</label>
              <div className={`${styles.phoneGroup} phone-number ${phoneError ? styles.phoneGroupError : ''}`} dir="ltr">
                <span className={styles.phonePrefix}>+964</span>
                <input
                  className={`${styles.phoneInput} phone-number`}
                  dir="ltr"
                  type="tel"
                  placeholder="770 123 4567"
                  value={phoneDisplay}
                  onChange={handlePhoneChange}
                  onBlur={() => { setPhoneTouched(true); validatePhone(phoneDisplay) }}
                  maxLength={12}
                />
              </div>
              {phoneError && <div className={styles.fieldError}>{phoneError}</div>}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Password · كلمة المرور</label>
              <input className={styles.input} type="password" placeholder="At least 6 characters" value={form.password} onChange={e => handle('password', e.target.value)} />
            </div>
            <button className={styles.btnPrimary} onClick={register} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Create Account · إنشاء حساب'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
