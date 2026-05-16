'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { googleSignIn, emailSignIn, emailSignUp } from '@/lib/api'
import type { AuthForm } from '@/lib/types'
import styles from './auth.module.css'

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState<AuthForm>({ name: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = (k: keyof AuthForm, v: string) => setForm(p => ({ ...p, [k]: v }))

  const login = async () => {
    setLoading(true); setError('')
    const { session, error: err } = await emailSignIn(form.email, form.password)
    if (err) { setError(err); setLoading(false); return }
    if (session) {
      window.location.href = '/dashboard'
    } else {
      setError('No session returned — your email may not be confirmed yet.')
    }
    setLoading(false)
  }

  const register = async () => {
    setLoading(true); setError('')
    const { error: err } = await emailSignUp(form.email, form.password, form.name, form.phone)
    if (err) { setError(err); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.card}>
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
            <div className={styles.grid2}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Email · البريد</label>
                <input className={styles.input} type="email" placeholder="email@example.com" value={form.email} onChange={e => handle('email', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Phone · الهاتف</label>
                <input className={styles.input} placeholder="+964 7XX XXX XXXX" value={form.phone} onChange={e => handle('phone', e.target.value)} />
              </div>
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
