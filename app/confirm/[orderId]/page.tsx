'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getSession } from '@/lib/api'
import { useLanguage } from '@/lib/useLanguage'
import type { Order } from '@/lib/types'

type View = 'loading' | 'login' | 'order' | 'confirmed' | 'cancelled' | 'notfound'

const STR = {
  en: {
    title: 'Confirm Your Order',
    loading: 'Loading…',
    loginPrompt: 'Please sign in to view and confirm your order.',
    signIn: 'Sign In',
    notFound: 'Order not found or you don’t have access to it.',
    description: 'Item',
    shipping: 'Shipping',
    service: 'Service Fee',
    customs: 'Customs / Tax',
    delivery: 'Iraq Delivery',
    total: 'Total',
    confirm: '✅ Confirm Order',
    cancel: '❌ Cancel',
    confirming: 'Confirming…',
    confirmedTitle: 'Order Confirmed!',
    confirmedBody: 'Thank you. We’ll start processing your order right away.',
    cancelledTitle: 'Order Not Confirmed',
    cancelledBody: 'Please contact us on WhatsApp to discuss your order.',
    contactWhatsapp: 'Contact us on WhatsApp',
    alreadyConfirmed: 'This order has already been confirmed.',
    backHome: 'Go to Dashboard',
  },
  ar: {
    title: 'تأكيد طلبك',
    loading: 'جارٍ التحميل…',
    loginPrompt: 'الرجاء تسجيل الدخول لعرض وتأكيد طلبك.',
    signIn: 'تسجيل الدخول',
    notFound: 'الطلب غير موجود أو ليس لديك صلاحية الوصول إليه.',
    description: 'المنتج',
    shipping: 'الشحن',
    service: 'رسوم الخدمة',
    customs: 'الجمارك / الضريبة',
    delivery: 'التوصيل داخل العراق',
    total: 'الإجمالي',
    confirm: '✅ تأكيد الطلب',
    cancel: '❌ إلغاء',
    confirming: 'جارٍ التأكيد…',
    confirmedTitle: 'تم تأكيد الطلب!',
    confirmedBody: 'شكراً لك. سنبدأ بمعالجة طلبك على الفور.',
    cancelledTitle: 'لم يتم تأكيد الطلب',
    cancelledBody: 'الرجاء التواصل معنا عبر واتساب لمناقشة طلبك.',
    contactWhatsapp: 'تواصل معنا عبر واتساب',
    alreadyConfirmed: 'تم تأكيد هذا الطلب مسبقاً.',
    backHome: 'الذهاب إلى لوحة التحكم',
  },
}

export default function ConfirmPage() {
  const params = useParams()
  const router = useRouter()
  const { language, setLanguage } = useLanguage()
  const t = STR[language === 'ar' ? 'ar' : 'en']
  const isAr = language === 'ar'

  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : (params.orderId as string)

  const [view, setView] = useState<View>('loading')
  const [order, setOrder] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const [businessWhatsapp, setBusinessWhatsapp] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const session = await getSession()
      if (!session) {
        if (active) setView('login')
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
      const { data: settingsRows } = await supabase
        .from('app_settings')
        .select('key, value')
        .eq('key', 'business_whatsapp')
      if (!active) return
      if (settingsRows && settingsRows[0]) setBusinessWhatsapp(settingsRows[0].value || '')
      if (!data) {
        setView('notfound')
        return
      }
      setOrder(data as Order)
      setView(data.status === 'confirmed' || data.status === 'ordered' ? 'confirmed' : 'order')
    })()
    return () => { active = false }
  }, [orderId])

  const goToLogin = () => {
    router.push(`/auth?redirect=${encodeURIComponent(`/confirm/${orderId}`)}`)
  }

  const handleConfirm = async () => {
    if (busy || !order) return
    setBusy(true)
    const session = await getSession()
    if (!session) { setBusy(false); goToLogin(); return }
    const res = await fetch('/api/orders/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id, access_token: session.access_token }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok && !data.error) {
      setView('confirmed')
      // Fire notifications (silent-fail) — customer + admin.
      fetch('/api/whatsapp/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, event: 'order_confirmed' }),
      }).catch(() => {})
    } else if (data.error === 'Order already confirmed') {
      setView('confirmed')
    } else {
      console.error('confirm error', data.error)
    }
  }

  const whatsappLink = businessWhatsapp
    ? `https://wa.me/${businessWhatsapp.replace(/[^\d]/g, '')}`
    : null

  const IQD_PER_USD = 1540
  const money = (v?: number) => `$${((v ?? 0) / IQD_PER_USD).toFixed(2)} USD`

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={page}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>ShipIQ</div>
          <button
            onClick={() => setLanguage(isAr ? 'en' : 'ar')}
            style={langBtn}
          >
            {isAr ? 'English' : 'عربي'}
          </button>
        </div>

        {view === 'loading' && (
          <div style={centerMsg}>{t.loading}</div>
        )}

        {view === 'login' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{t.title}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 22 }}>{t.loginPrompt}</p>
            <button onClick={goToLogin} style={primaryBtn}>{t.signIn}</button>
          </div>
        )}

        {view === 'notfound' && (
          <div style={centerMsg}>{t.notFound}</div>
        )}

        {view === 'order' && order && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>{order.id}</div>

            {order.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.photo_url}
                alt={order.description}
                style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 12, background: 'var(--surface)', marginBottom: 16 }}
              />
            )}

            <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{t.description}</div>
            <div style={{ fontSize: 15, color: 'var(--text)', marginBottom: 18 }}>{order.description}</div>

            <div style={breakdown}>
              <Row label={t.shipping} value={money(order.shipping_price)} />
              {!!order.service_fee && <Row label={t.service} value={money(order.service_fee)} />}
              {!!order.customs_fee && <Row label={t.customs} value={money(order.customs_fee)} />}
              {!!order.delivery_fee && <Row label={t.delivery} value={money(order.delivery_fee)} />}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--gold)', fontSize: 16 }}>
                <span>{t.total}</span>
                <span>{money(order.total_cost ?? order.shipping_price)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              <button onClick={handleConfirm} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
                {busy ? t.confirming : t.confirm}
              </button>
              <button onClick={() => setView('cancelled')} disabled={busy} style={dangerBtn}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {view === 'confirmed' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t.confirmedTitle}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 22 }}>{t.confirmedBody}</p>
            <button onClick={() => router.push('/dashboard')} style={primaryBtn}>{t.backHome}</button>
          </div>
        )}

        {view === 'cancelled' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t.cancelledTitle}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 22 }}>{t.cancelledBody}</p>
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ ...primaryBtn, display: 'inline-block', textDecoration: 'none' }}>
                {t.contactWhatsapp}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
      <span>{label}</span><span>{value}</span>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const page: React.CSSProperties = {
  minHeight: '100vh', background: 'var(--bg)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: 16,
}
const card: React.CSSProperties = {
  width: '100%', maxWidth: 420, background: 'var(--surface2)',
  border: '1px solid var(--border)', borderRadius: 16, padding: 24,
  boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
}
const centerMsg: React.CSSProperties = {
  textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 14,
}
const breakdown: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 16,
}
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px', fontSize: 15, fontWeight: 700,
  background: 'var(--gold)', color: 'var(--bg)', border: 'none',
  borderRadius: 10, cursor: 'pointer',
}
const dangerBtn: React.CSSProperties = {
  width: '100%', padding: '13px', fontSize: 15, fontWeight: 700,
  background: 'transparent', color: 'var(--text-muted)',
  border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer',
}
const langBtn: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontWeight: 700,
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
}
