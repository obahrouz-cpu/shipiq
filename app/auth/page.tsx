'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import styles from './auth.module.css'

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

const loginWithGoogle = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://shipiq1.vercel.app/dashboard'
      }
    })
  }
 const login = async () => {
    setLoading(true); setError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    console.log('Login result:', data, error)
    if (error) { setError(error.message); setLoading(false); return }
    if (data.session) {
      setError('Got session! Redirecting...')
      window.location.href = '/dashboard'
    } else {
      setError('No session returned - email may not be confirmed')
    }
    setLoading(false)
  }

  const register = async () => {
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.name, phone: form.phone }
      }
    })
    if (error) { setError(error.message); setLoading(false); return }
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
            <div className={styles.formGroup}>
              <label className={styles.label}>Email · البريد الإلكتروني</label>
              <input className={styles.input} type="email" placeholder="email@example.com" value={form.email} onChange={e => handle('email', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Password · كلمة المرور</label>
              <input className={styles.input} type="password" placeholder="••••••••" value={form.password} onChange={e => handle('password', e.target.value)} />
            </div>
<button className={styles.btnGoogle} onClick={loginWithGoogle}>
  <img src="https://www.google.com/favicon.ico" width="16" height="16" />
  Continue with Google · الدخول بجوجل
</button>
<div className={styles.divider}>or</div>
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
              <input className={styles.input} type="password" placeholder="Min 6 characters" value={form.password} onChange={e => handle('password', e.target.value)} />
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
