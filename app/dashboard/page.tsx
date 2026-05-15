'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import styles from './dashboard.module.css'
import ShopSection from './components/ShopSection'

const CATEGORIES = ['Electronics','Clothing','Cosmetics','Books','Home & Kitchen','Toys','Sports','Other']

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; cls: string; icon: string }> = {
  pending:    { label: 'Pending',    labelAr: 'قيد الانتظار', cls: 'pending',    icon: '⏳' },
  calculated: { label: 'Calculated', labelAr: 'تم الحساب',   cls: 'calculated', icon: '💰' },
  confirmed:  { label: 'Confirmed',  labelAr: 'مؤكد',        cls: 'confirmed',  icon: '✅' },
  shipped:    { label: 'Shipped',    labelAr: 'تم الشحن',    cls: 'shipped',    icon: '📦' },
  rejected:   { label: 'Rejected',   labelAr: 'مرفوض',       cls: 'rejected',   icon: '❌' },
}

const SUPPORTED_SITES = [
  'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.ae', 'amazon.ca',
  'bhphotovideo.com', 'newegg.com', 'bestbuy.com', 'ebay.com',
  'trendyol.com', 'hepsiburada.com', 'n11.com',
  'aliexpress.com', 'taobao.com', '1688.com', 'jd.com'
]

const SHIPPING_RATE_RANGES: Record<string, { min: number; max: number }> = {
  'USA':     { min: 12000, max: 19000 },
  'UK':      { min: 11000, max: 17000 },
  'Germany': { min: 11000, max: 17000 },
  'Canada':  { min: 10000, max: 16000 },
  'UAE':     { min:  6000, max: 10000 },
  'Turkey':  { min:  5000, max:  8000 },
  'China':   { min:  8000, max: 14000 },
}


function Badge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return <span className={`${styles.badge} ${styles[s.cls]}`}>{s.icon} {s.label}</span>
}

function Spinner() {
  return <span className={styles.spinner} />
}

function Toast({ toasts }: { toasts: { id: number; message: string; type: string }[] }) {
  return (
    <div className={styles.toastContainer}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles['toast_' + t.type]}`}>
          <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
          {t.message}
        </div>
      ))}
    </div>
  )
}

function AutoCalculate({ url, onResult }: { url: string; onResult: (weight: string, dims: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const isSupported = SUPPORTED_SITES.some(site => url.toLowerCase().includes(site))
  const detectedSite = SUPPORTED_SITES.find(site => url.toLowerCase().includes(site))

  const calculate = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const data = await response.json()
      if (!data.found) { setError(data.reason || data.error || 'Could not find info. Enter manually.'); setLoading(false); return }
      setResult(data)
      onResult(`${data.billable_weight_kg} kg`, `${data.length_cm} x ${data.width_cm} x ${data.height_cm} cm`)
    } catch (e) { setError('Could not fetch. Enter manually.') }
    setLoading(false)
  }

  return (
    <div>
      {isSupported ? (
        <>
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(76,175,122,0.08)', border: '1px solid rgba(76,175,122,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--green)' }}>
            ✅ Supported site detected: <strong>{detectedSite}</strong>
          </div>
          <button className={styles.btnPrimary} style={{ width: '100%', marginBottom: 16 }} onClick={calculate} disabled={loading}>
            {loading ? <><span className={styles.spinner} /> Fetching product info...</> : '🤖 Auto Calculate from URL'}
          </button>
          {error && <div className={styles.errorBox}>{error}</div>}
          {result?.found && (
            <div className={styles.infoBox} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>✅ {result.product_name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div>⚖️ Actual Weight: <strong>{result.actual_weight_kg ? `${result.actual_weight_kg} kg` : '—'}</strong></div>
                <div>📐 Length: <strong>{result.length_cm ? `${result.length_cm} cm` : '—'}</strong></div>
                <div>📐 Width: <strong>{result.width_cm ? `${result.width_cm} cm` : '—'}</strong></div>
                <div>📐 Height: <strong>{result.height_cm ? `${result.height_cm} cm` : '—'}</strong></div>
                {result.dimensional_weight_kg
                  ? <div>📦 Dim. Weight: <strong>{result.dimensional_weight_kg} kg</strong></div>
                  : <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>📦 Dimensions not listed</div>
                }
                <div style={{ color: 'var(--gold)', fontWeight: 700 }}>💰 Billable: <strong>{result.billable_weight_kg} kg</strong></div>
              </div>
              {!result.dimensional_weight_kg && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>
                  ⚠️ Dimensions not available. Billable weight based on actual weight only.
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,123,58,0.08)', border: '1px solid rgba(224,123,58,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--orange)' }}>
          ⚠️ Auto calculate only available for supported sites. Enter manually below.
        </div>
      )}
      <div className={styles.infoBox}>📋 Review the product link, then enter shipping details below.</div>
    </div>
  )
}

function SubmitOrderModal({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ url: '', description: '', category: 'Electronics', qty: 1, itemPrice: '', itemPriceCurrency: 'USD', note: '', urgency: false })
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const handle = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const [scrapeResult, setScrapeResult] = useState<any>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [estimateError, setEstimateError] = useState('')

  useEffect(() => {
    const supported = SUPPORTED_SITES.some(s => form.url.toLowerCase().includes(s))
    if (!supported || !form.url) { setScrapeResult(null); setEstimateLoading(false); setEstimateError(''); return }
    setEstimateLoading(true)
    setEstimateError('')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: form.url }) })
        const data = await res.json()
        if (data.found && data.billable_weight_kg) {
          setScrapeResult(data)
        } else {
          setScrapeResult(null)
          setEstimateError(data.reason || data.error || 'Could not calculate estimate for this product.')
        }
      } catch (e: any) {
        setScrapeResult(null)
        setEstimateError(e?.message || 'Failed to reach the scrape API.')
      }
      setEstimateLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [form.url])

  const submit = async () => {
    if (!form.url || !form.description) { setError('URL and description are required'); return }
    if (!form.url.startsWith('http')) { setError('URL must start with http:// or https://'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    let photoUrl = null
    if (photo) {
      const ext = photo.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}.${ext}`
      const { data, error: uploadError } = await supabase.storage.from('order-photos').upload(fileName, photo)
      if (!uploadError && data) {
        const { data: urlData } = supabase.storage.from('order-photos').getPublicUrl(fileName)
        photoUrl = urlData.publicUrl
      }
    }
    const { error: insertError } = await supabase.from('orders').insert({
      user_id: userId, url: form.url, description: form.description, category: form.category,
      qty: form.qty, item_price: form.itemPrice ? parseFloat(form.itemPrice) : null,
      item_price_currency: form.itemPriceCurrency, note: form.note, urgency: form.urgency,
      photo_url: photoUrl, status: 'pending',
    })
    setLoading(false)
    if (insertError) { setError(insertError.message); return }
    onDone(); onClose()
  }

  const isUrlSupported = SUPPORTED_SITES.some(s => form.url.toLowerCase().includes(s))
  const rates = SHIPPING_RATE_RANGES[scrapeResult?.site?.country ?? ''] ?? { min: 10000, max: 18000 }
  const totalKg = scrapeResult?.billable_weight_kg ? scrapeResult.billable_weight_kg * form.qty : 0
  const shippingEstimate = totalKg > 0 ? { min: Math.round(rates.min * totalKg), max: Math.round(rates.max * totalKg), kg: totalKg } : null

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>New Order · طلب جديد</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        {error && <div className={styles.errorBox}>{error}</div>}
        <div className={styles.formGroup}>
          <label className={styles.label}>Product URL · رابط المنتج *</label>
          <input className={styles.input} placeholder="https://amazon.com/dp/..." value={form.url} onChange={e => handle('url', e.target.value)} />
        </div>
        {estimateLoading && isUrlSupported && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 8, fontSize: 12, color: 'var(--text-dim)', marginTop: -12, marginBottom: 16 }}>
            <span className={styles.spinner} style={{ width: 14, height: 14, borderColor: 'rgba(201,168,76,0.25)', borderTopColor: 'var(--gold)' }} /> Calculating shipping estimate...
          </div>
        )}
        {estimateError && !estimateLoading && isUrlSupported && (
          <div style={{ padding: '9px 13px', background: 'rgba(224,123,58,0.08)', border: '1px solid rgba(224,123,58,0.25)', borderRadius: 8, fontSize: 12, color: 'var(--orange)', marginTop: -12, marginBottom: 16 }}>
            ⚠️ {estimateError}
          </div>
        )}
        {shippingEstimate && !estimateLoading && (
          <div style={{ padding: '14px 16px', background: 'rgba(201,168,76,0.06)', border: '1px dashed rgba(201,168,76,0.35)', borderRadius: 10, marginTop: -12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>≈ Shipping Estimate · تقدير الشحن</span>
              <span style={{ fontSize: 10, color: 'var(--gold-dim)', background: 'rgba(201,168,76,0.12)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(201,168,76,0.2)', fontWeight: 600, letterSpacing: '0.5px' }}>APPROXIMATE</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)', marginBottom: 6 }}>
              {shippingEstimate.min.toLocaleString()} – {shippingEstimate.max.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gold-dim)' }}>IQD</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {shippingEstimate.kg} kg billable weight{form.qty > 1 ? ` × ${form.qty} items` : ''} · Final price confirmed by ShipIQ
            </div>
          </div>
        )}
        <div className={styles.formGroup}>
          <label className={styles.label}>Description · الوصف *</label>
          <input className={styles.input} placeholder="e.g. Nike Air Max 270 - Size 42 - Black" value={form.description} onChange={e => handle('description', e.target.value)} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5 }}>Include size, color, model number, and any variant details</div>
        </div>
        <div className={styles.grid2}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Category · الفئة</label>
            <select className={styles.input} value={form.category} onChange={e => handle('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Quantity · الكمية</label>
            <input className={styles.input} type="number" min="1" value={form.qty} onChange={e => handle('qty', parseInt(e.target.value) || 1)} />
          </div>
        </div>
        <div className={styles.grid2}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Item Price · سعر المنتج</label>
            <input className={styles.input} type="number" placeholder="0.00" value={form.itemPrice} onChange={e => handle('itemPrice', e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Currency · العملة</label>
            <select className={styles.input} value={form.itemPriceCurrency} onChange={e => handle('itemPriceCurrency', e.target.value)}>
              <option value="USD">USD — دولار</option>
              <option value="IQD">IQD — دينار</option>
              <option value="EUR">EUR — يورو</option>
              <option value="GBP">GBP — جنيه</option>
            </select>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Notes · ملاحظات</label>
          <textarea className={styles.textarea} placeholder="Color, size, special instructions..." value={form.note} onChange={e => handle('note', e.target.value)} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Photo (optional) · صورة اختيارية</label>
          <div className={`${styles.uploadArea} ${photo ? styles.hasFile : ''}`} onClick={() => fileRef.current?.click()}>
            <div className={styles.uploadIcon}>{photo ? '🖼️' : '📎'}</div>
            <div className={styles.uploadLabel}>{photo ? photo.name : 'Click to upload a screenshot or photo'}</div>
            <div className={styles.uploadSub}>PNG, JPG up to 5MB</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setPhoto(e.target.files?.[0] || null)} />
        </div>
        <div className={styles.urgencyRow} onClick={() => handle('urgency', !form.urgency)}>
          <div className={`${styles.checkbox} ${form.urgency ? styles.checked : ''}`}>{form.urgency && <span>✓</span>}</div>
          <div>
            <div className={styles.urgencyLabel}>⚡ Urgent Order · طلب عاجل</div>
            <div className={styles.urgencySub}>May affect pricing · قد يؤثر على السعر</div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={loading || !form.url || !form.description}>
            {loading ? <Spinner /> : 'Submit Order · إرسال'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OrderDetailModal({ order, isAdmin, onClose, onRefresh }: { order: any; isAdmin: boolean; onClose: () => void; onRefresh: () => void }) {
  const [view, setView] = useState<'detail' | 'calculate' | 'reject'>('detail')
  const [shipping, setShipping] = useState({ price: '', currency: 'IQD', weight: '' })
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)
  const s = STATUS_CONFIG[order.status]

  const updateOrder = async (updates: any) => {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('orders').update(updates).eq('id', order.id)
    setLoading(false); onRefresh(); onClose()
  }

  const handleCalculate = () => updateOrder({
    status: 'calculated', shipping_price: parseInt(shipping.price),
    shipping_currency: shipping.currency, weight: shipping.weight,
  })

  const handleConfirm = async () => {
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id)
    if (order.shipping_price) {
      const { data: profile } = await supabase.from('profiles').select('balance, id').eq('id', order.user_id).single()
      if (profile) {
        await supabase.from('profiles').update({ balance: profile.balance - order.shipping_price }).eq('id', profile.id)
        await supabase.from('transactions').insert({
          user_id: order.user_id, amount: -order.shipping_price, currency: order.shipping_currency,
          note: `Shipping confirmed for ${order.id}`, order_id: order.id,
        })
      }
    }
    onRefresh(); onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={styles.modalTitle}>{order.id}</span>
            <Badge status={order.status} />
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        {isAdmin && (
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${view === 'detail' ? styles.activeTab : ''}`} onClick={() => setView('detail')}>Details</button>
            {order.status === 'pending' && <button className={`${styles.tab} ${view === 'calculate' ? styles.activeTab : ''}`} onClick={() => setView('calculate')}>Calculate Shipping</button>}
            {['pending', 'calculated'].includes(order.status) && <button className={`${styles.tab} ${view === 'reject' ? styles.activeTab : ''}`} onClick={() => setView('reject')}>Reject</button>}
            {order.status === 'confirmed' && <button className={styles.tab} onClick={() => updateOrder({ status: 'shipped' })}>Mark Shipped 📦</button>}
          </div>
        )}
        {view === 'detail' && (
          <div>
            {[
              ['Product URL', order.url, true],
              ['Description', order.description],
              ['Category', order.category],
              ['Quantity', order.qty],
              ['Item Price', order.item_price ? `${order.item_price} ${order.item_price_currency}` : '—'],
              order.urgency ? ['Urgency', '⚡ Urgent'] : null,
              order.note ? ['Notes', order.note] : null,
              order.weight ? ['Weight', order.weight] : null,
              ['Submitted', order.created_at?.split('T')[0]],
              order.reject_reason ? ['Rejection Reason', order.reject_reason] : null,
            ].filter(Boolean).map(([k, v, isLink]: any, i) => (
              <div key={i} className={styles.detailRow}>
                <span className={styles.detailKey}>{k}</span>
                {isLink
                  ? <a href={v} target="_blank" className={styles.detailLink}>{v}</a>
                  : <span className={styles.detailVal} style={k === 'Rejection Reason' ? { color: 'var(--red)' } : k === 'Urgency' ? { color: 'var(--orange)' } : {}}>{v}</span>
                }
              </div>
            ))}
            {order.photo_url && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Photo</span>
                <a href={order.photo_url} target="_blank" className={styles.detailLink}>View Photo 🖼️</a>
              </div>
            )}
            {order.shipping_price && (
              <div className={styles.priceBox}>
                <div className={styles.priceLabel}>Estimated Shipping Cost</div>
                <div>
                  <span className={styles.priceBig}>{order.shipping_price.toLocaleString()}</span>
                  <span className={styles.priceCurrency}>{order.shipping_currency}</span>
                </div>
              </div>
            )}
            {order.status === 'calculated' && !isAdmin && (
              <button className={styles.btnPrimary} style={{ width: '100%', marginTop: 20 }} onClick={handleConfirm}>
                Confirm & Proceed · تأكيد المضي قدماً
              </button>
            )}
          </div>
        )}
        {view === 'calculate' && (
          <div>
            <AutoCalculate url={order.url} onResult={(weight: string, dims: string) => {
              setShipping(p => ({ ...p, weight }))
            }} />
            <div className={styles.grid2}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Shipping Price</label>
                <input className={styles.input} type="number" placeholder="e.g. 35000" value={shipping.price} onChange={e => setShipping(p => ({ ...p, price: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Currency</label>
                <select className={styles.input} value={shipping.currency} onChange={e => setShipping(p => ({ ...p, currency: e.target.value }))}>
                  <option value="IQD">IQD — دينار</option>
                  <option value="USD">USD — دولار</option>
                </select>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Estimated Weight</label>
              <input className={styles.input} placeholder="e.g. 0.5 kg" value={shipping.weight} onChange={e => setShipping(p => ({ ...p, weight: e.target.value }))} />
            </div>
            <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={handleCalculate} disabled={loading || !shipping.price}>
              {loading ? <Spinner /> : 'Save & Notify Customer'}
            </button>
          </div>
        )}
        {view === 'reject' && (
          <div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Rejection Reason</label>
              <textarea className={styles.textarea} placeholder="e.g. Item not available..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            </div>
            <button className={styles.btnDanger} style={{ width: '100%' }} onClick={() => updateOrder({ status: 'rejected', reject_reason: rejectReason })}>
              Reject Order
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TopUpModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('IQD')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    const supabase = createClient()
    const add = parseInt(amount)
    await supabase.from('profiles').update({ balance: user.balance + add }).eq('id', user.id)
    await supabase.from('transactions').insert({ user_id: user.id, amount: add, currency, note: 'Balance top-up by admin' })
    setLoading(false); onDone(); onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 380 }}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Add Balance · إضافة رصيد</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{user.full_name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Current Balance: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{user.balance?.toLocaleString()} IQD</span>
          </div>
        </div>
        <div className={styles.grid2}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Amount</label>
            <input className={styles.input} type="number" placeholder="e.g. 50000" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Currency</label>
            <select className={styles.input} value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="IQD">IQD</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={submit} disabled={loading || !amount}>
          {loading ? <Spinner /> : 'Add Balance · إضافة الرصيد'}
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [page, setPage] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [topUpUser, setTopUpUser] = useState<any>(null)
  const [orderFilter, setOrderFilter] = useState('all')
  const [toasts, setToasts] = useState<any[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toast = (message: string, type = 'success') => {
    const id = Date.now()
    setToasts(p => [...p, { id, message, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }

  const fetchData = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/auth'; return }
    const user = session.user
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof) { setLoading(false); return }
    setProfile(prof)
    if (prof.role === 'admin') {
      const { data: allOrders } = await supabase.from('orders').select('*, profiles(full_name, email)').order('created_at', { ascending: false })
      const { data: allUsers } = await supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false })
      setOrders(allOrders || []); setUsers(allUsers || [])
    } else {
      const { data: myOrders } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      const { data: txns } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setOrders(myOrders || []); setTransactions(txns || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)', letterSpacing: -0.5 }}>ShipIQ</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Tajawal, sans-serif', marginTop: -8 }}>خدمة الشحن الذكي</div>
      <div className={styles.spinner} style={{ width: 28, height: 28, borderWidth: 2, marginTop: 8 }} />
    </div>
  )

  const isAdmin = profile?.role === 'admin'
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const calculatedCount = orders.filter(o => o.status === 'calculated').length
  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter)

  const navItems = isAdmin
    ? [
        { id: 'admin-orders', icon: '📋', label: 'All Orders · جميع الطلبات', badge: pendingCount },
        { id: 'admin-customers', icon: '👥', label: 'Customers · العملاء' },
      ]
    : [
        { id: 'dashboard', icon: '⊞', label: 'Dashboard · لوحة التحكم' },
        { id: 'shop', icon: '🛍️', label: 'Shop · تسوق' },
        { id: 'orders', icon: '📦', label: 'My Orders · طلباتي', badge: calculatedCount },
        { id: 'balance', icon: '💳', label: 'Balance · الرصيد' },
      ]

  const pageTitle: Record<string, string> = {
    dashboard: 'Dashboard · لوحة التحكم',
    shop: 'Shop · تسوق',
    orders: 'My Orders · طلباتي',
    balance: 'Balance · الرصيد',
    'admin-orders': 'All Orders · جميع الطلبات',
    'admin-customers': 'Customers · العملاء',
  }

  return (
    <div className={styles.layout}>
      {sidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}
      <div className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <div className={styles.logoMark}>ShipIQ</div>
          <div className={`${styles.logoSub} ar`}>خدمة الشحن الذكي</div>
        </div>
        <div className={styles.sidebarNav}>
          <div className={styles.navSection}>{isAdmin ? 'Admin Panel' : 'Menu'}</div>
          {navItems.map(n => (
            <div key={n.id} className={`${styles.navItem} ${page === n.id ? styles.navActive : ''}`} onClick={() => { setPage(n.id); setSidebarOpen(false) }}>
              <span>{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {!!n.badge && (n.badge as number) > 0 && <span className={styles.navBadge}>{n.badge}</span>}
            </div>
          ))}
        </div>
        <div className={styles.sidebarFooter}>
          <div className={styles.userCard} onClick={logout}>
            <div className={styles.userAvatar}>{profile?.full_name?.[0] || '?'}</div>
            <div>
              <div className={styles.userName}>{profile?.full_name}</div>
              <div className={styles.userRole}>{isAdmin ? '🔧 Admin' : '👤 Customer'} · Sign Out</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className={styles.hamburger} onClick={() => setSidebarOpen(true)}>☰</button>
            <div className={styles.pageTitle}>{pageTitle[page]}</div>
          </div>
          <div className={styles.topbarActions}>
            {!isAdmin && (
              <div className={styles.balanceChip}>
                <span>💳</span>
                <span>{profile?.balance?.toLocaleString()} IQD</span>
              </div>
            )}
            {!isAdmin && page === 'orders' && (
              <button className={styles.btnPrimary} style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => setShowNewOrder(true)}>+ New Order</button>
            )}
          </div>
        </div>

        <div className={styles.body}>

          {page === 'dashboard' && (
            <div className="fade-up">
              <div className={styles.statsGrid}>
                {[
                  { label: 'Balance · الرصيد', value: `${profile?.balance?.toLocaleString()} IQD`, icon: '💳', color: '#c9a84c', bg: 'rgba(201,168,76,0.1)' },
                  { label: 'Pending · معلق', value: orders.filter(o => o.status === 'pending').length, icon: '⏳', color: '#e07b3a', bg: 'rgba(224,123,58,0.1)' },
                  { label: 'Calculated · محسوب', value: orders.filter(o => o.status === 'calculated').length, icon: '💰', color: '#5b9bd5', bg: 'rgba(91,155,213,0.1)' },
                  { label: 'Shipped · مشحون', value: orders.filter(o => o.status === 'shipped').length, icon: '📦', color: '#4caf7a', bg: 'rgba(76,175,122,0.1)' },
                ].map((s, i) => (
                  <div key={i} className={styles.statCard} style={{ animationDelay: `${i * 80}ms` }}>
                    <div className={styles.statIcon} style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                    <div className={styles.statLabel}>{s.label}</div>
                    <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {calculatedCount > 0 && (
                <div className={styles.alertBox}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>💰 {calculatedCount} order{calculatedCount > 1 ? 's' : ''} ready for confirmation</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Shipping prices calculated — review and confirm to proceed</div>
                  </div>
                  <button className={styles.btnGhost} style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setPage('orders')}>View →</button>
                </div>
              )}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Recent Orders · أحدث الطلبات</span>
                  <button className={styles.btnGhost} style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setPage('orders')}>View All</button>
                </div>
                {orders.length === 0 ? (
                  <div className={styles.empty}>
                    <div className={styles.emptyIcon}>🚀</div>
                    <div className={styles.emptyTitle}>Start your shipping journey</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>Submit your first order and we'll handle the rest</div>
                    <button className={styles.btnPrimary} style={{ marginTop: 16 }} onClick={() => { setPage('orders'); setShowNewOrder(true) }}>+ New Order · طلب جديد</button>
                  </div>
                ) : (
                  <table className={styles.table}>
                    <thead><tr><th>ID</th><th>Description</th><th>Date</th><th>Status</th></tr></thead>
                    <tbody>
                      {orders.slice(0, 5).map(o => (
                        <tr key={o.id} onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                          <td className={styles.tdMain}>{o.id}</td>
                          <td>{o.description}</td>
                          <td>{o.created_at?.split('T')[0]}</td>
                          <td><Badge status={o.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {page === 'shop' && (
            <div className="fade-up">
              <div className={styles.pageHeader}>
                <div>
                  <div className={styles.pageHeading}>Shop · تسوق</div>
                  <div className={styles.pageSub}>Browse your favourite stores and get a shipping estimate</div>
                </div>
              </div>
              <ShopSection />
            </div>
          )}

          {(page === 'orders' || page === 'admin-orders') && (
            <div className="fade-up">
              {page === 'orders' && (
                <div className={styles.pageHeader}>
                  <div>
                    <div className={styles.pageHeading}>My Orders</div>
                    <div className={styles.pageSub} style={{ fontFamily: 'Tajawal' }}>طلباتي</div>
                  </div>
                  <button className={styles.btnPrimary} onClick={() => setShowNewOrder(true)}>+ New Order · طلب جديد</button>
                </div>
              )}
              {page === 'admin-orders' && (
                <div className={styles.pageHeader}>
                  <div>
                    <div className={styles.pageHeading}>All Orders</div>
                    <div className={styles.pageSub}>Manage and process customer orders</div>
                  </div>
                </div>
              )}
              <div className={styles.tabs}>
                {[['all','All'],['pending','Pending ⏳'],['calculated','Calculated 💰'],['confirmed','Confirmed ✅'],['shipped','Shipped 📦'],['rejected','Rejected ❌']].map(([v, l]) => (
                  <button key={v} className={`${styles.tab} ${orderFilter === v ? styles.activeTab : ''}`} onClick={() => setOrderFilter(v as string)}>
                    {l} <span style={{ opacity: 0.5, fontSize: 11 }}>({(v === 'all' ? orders : orders.filter(o => o.status === v)).length})</span>
                  </button>
                ))}
              </div>
              <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                {filteredOrders.length === 0 ? (
                  <div className={styles.empty}>
                    <div className={styles.emptyIcon}>📬</div>
                    <div className={styles.emptyTitle}>No orders match this filter</div>
                    {page === 'orders' && orderFilter === 'all' && (
                      <button className={styles.btnPrimary} style={{ marginTop: 16 }} onClick={() => setShowNewOrder(true)}>+ Submit your first order</button>
                    )}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className={styles.table}>
                      <thead><tr>
                        <th>ID</th>
                        {isAdmin && <th>Customer</th>}
                        <th>Description</th><th>Category</th><th>Item Price</th><th>Shipping</th><th>Date</th><th>Status</th>
                      </tr></thead>
                      <tbody>
                        {filteredOrders.map(o => (
                          <tr key={o.id} onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                            <td className={styles.tdMain}>{o.id}</td>
                            {isAdmin && (
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div className={styles.userAvatar} style={{ width: 26, height: 26, fontSize: 11, flexShrink: 0 }}>
                                    {(o.profiles?.full_name?.[0] || '?').toUpperCase()}
                                  </div>
                                  <span>{o.profiles?.full_name || '—'}</span>
                                </div>
                              </td>
                            )}
                            <td>
                              <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: 13 }}>{o.description}</div>
                              <a className={styles.tdLink} href={o.url} target="_blank" onClick={e => e.stopPropagation()}>{o.url}</a>
                              {o.urgency && <span style={{ fontSize: 10, color: 'var(--orange)' }}> ⚡ Urgent</span>}
                            </td>
                            <td>{o.category}</td>
                            <td>{o.item_price ? `${o.item_price} ${o.item_price_currency}` : '—'}</td>
                            <td style={{ color: o.shipping_price ? 'var(--gold)' : 'var(--text-dim)', fontWeight: o.shipping_price ? 700 : 400 }}>
                              {o.shipping_price ? `${o.shipping_price.toLocaleString()} ${o.shipping_currency}` : '—'}
                            </td>
                            <td>{o.created_at?.split('T')[0]}</td>
                            <td>
                              <Badge status={o.status} />
                              {o.status === 'pending' && (
                                <button className={styles.processBadge} onClick={e => { e.stopPropagation(); setSelectedOrder(o) }}>→ Process</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === 'balance' && (
            <div className="fade-up">
              <div className={styles.pageHeader}>
                <div><div className={styles.pageHeading}>Balance · الرصيد</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div className={styles.card} style={{ textAlign: 'center', padding: '36px 24px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Balance · الرصيد المتاح</div>
                  <span className={styles.priceBig}>{profile?.balance?.toLocaleString()}</span>
                  <span className={styles.priceCurrency}>IQD</span>
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-dim)' }}>≈ ${Math.round((profile?.balance || 0) / 1450)} USD</div>
                </div>
                <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(37,211,102,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💬</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Top Up Your Balance · شحن الرصيد</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Contact us on WhatsApp — we'll top you up within a few hours</div>
                    </div>
                  </div>
                  <a className={styles.btnWhatsApp} href="https://wa.me/964XXXXXXXXXX" target="_blank" rel="noopener noreferrer">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.1 21.9l4.837-1.316A9.956 9.956 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.956 7.956 0 0 1-4.099-1.132l-.293-.174-3.044.828.852-3.004-.192-.31A7.953 7.953 0 0 1 4 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/>
                    </svg>
                    Chat on WhatsApp
                  </a>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
                    +964 XXX XXX XXXX · Available Sat–Thu, 9am–9pm
                  </div>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}><span style={{ fontSize: 15, fontWeight: 700 }}>Transaction History · سجل المعاملات</span></div>
                {transactions.length === 0 ? (
                  <div className={styles.empty}>
                    <div className={styles.emptyIcon}>💸</div>
                    <div className={styles.emptyTitle}>No transactions yet · لا توجد معاملات</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, maxWidth: 280 }}>Transactions appear here after your balance is topped up or an order is confirmed</div>
                  </div>
                ) : (
                  <table className={styles.table}>
                    <thead><tr><th>ID</th><th>Description</th><th>Date</th><th>Amount</th></tr></thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t.id}>
                          <td className={styles.tdMain}>{t.id}</td>
                          <td>{t.note}</td>
                          <td>{t.created_at?.split('T')[0]}</td>
                          <td style={{ color: t.amount > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                            {t.amount > 0 ? '+' : ''}{t.amount?.toLocaleString()} {t.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {page === 'admin-customers' && (
            <div className="fade-up">
              <div className={styles.pageHeader}>
                <div><div className={styles.pageHeading}>Customers · العملاء</div><div className={styles.pageSub}>Manage accounts and balances</div></div>
              </div>
              <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                {users.length === 0 ? (
                  <div className={styles.empty}><div className={styles.emptyIcon}>👥</div><div className={styles.emptyTitle}>No customers yet</div></div>
                ) : (
                  <table className={styles.table}>
                    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Balance</th><th>Joined</th><th>Actions</th></tr></thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className={styles.userAvatar} style={{ width: 30, height: 30, fontSize: 12 }}>{u.full_name?.[0]}</div>
                              <span className={styles.tdMain}>{u.full_name}</span>
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td>{u.phone || '—'}</td>
                          <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{u.balance?.toLocaleString()} IQD</td>
                          <td>{u.created_at?.split('T')[0]}</td>
                          <td><button className={styles.btnGhost} style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setTopUpUser(u)}>+ Balance</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {showNewOrder && profile && <SubmitOrderModal userId={profile.id} onClose={() => setShowNewOrder(false)} onDone={() => { fetchData(); toast('Order submitted! · تم إرسال الطلب') }} />}
      {selectedOrder && <OrderDetailModal order={selectedOrder} isAdmin={isAdmin} onClose={() => setSelectedOrder(null)} onRefresh={() => { fetchData(); toast('Order updated!') }} />}
      {topUpUser && <TopUpModal user={topUpUser} onClose={() => setTopUpUser(null)} onDone={() => { fetchData(); toast('Balance added! · تمت إضافة الرصيد') }} />}
      <Toast toasts={toasts} />
    </div>
  )
}
