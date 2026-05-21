'use client'
import { useState, useEffect } from 'react'
import { useIqdRate } from '@/lib/hooks/useIqdRate'

const QUICK_AMOUNTS = [25, 50, 100, 200, 500]
const MIN_USD = 10
const FALLBACK_WHATSAPP = '964XXXXXXXXXX'

type Method = 'fib' | 'qicard' | 'zaincash' | 'asiapay'
type Step = 'amount' | 'method' | 'pay' | 'done'

interface MethodConfig {
  id: Method
  name: string
  nameAr: string
  openLabel: string
  url: string
  short: string
  color: string
  bg: string
  border: string
  borderActive: string
}

const METHODS: Record<Method, MethodConfig> = {
  fib: {
    id: 'fib',
    name: 'FIB',
    nameAr: 'البنك العراقي الأول',
    openLabel: 'Open FIB App · فتح تطبيق FIB',
    url: 'https://fib.iq',
    short: 'FIB',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
    borderActive: 'rgba(34,197,94,0.7)',
  },
  qicard: {
    id: 'qicard',
    name: 'Qi Card',
    nameAr: 'كي كارد',
    openLabel: 'Open Qi Card · فتح كي كارد',
    url: 'https://qicard.iq',
    short: 'QI',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.25)',
    borderActive: 'rgba(249,115,22,0.7)',
  },
  zaincash: {
    id: 'zaincash',
    name: 'ZainCash',
    nameAr: 'زين كاش',
    openLabel: 'Open ZainCash · فتح زين كاش',
    url: 'https://zaincash.iq',
    short: 'ZC',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    borderActive: 'rgba(59,130,246,0.7)',
  },
  asiapay: {
    id: 'asiapay',
    name: 'Asia Pay',
    nameAr: 'آسيا باي',
    openLabel: 'Open Asia Pay · فتح آسيا باي',
    url: 'https://asiahawala.com',
    short: 'AP',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    borderActive: 'rgba(239,68,68,0.7)',
  },
}

interface Props {
  userId: string
  onSuccess?: () => void
  /** Controlled mode — pass open+onClose from parent instead of using the built-in button */
  open?: boolean
  onClose?: () => void
}

export default function WalletTopUp({ onSuccess, open: controlledOpen, onClose: controlledOnClose }: Props) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen! : internalOpen

  const [step, setStep] = useState<Step>('amount')
  const [method, setMethod] = useState<Method | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [opened, setOpened] = useState(false)

  const { rate: iqdRate, whatsapp } = useIqdRate()

  // Reset wizard state when modal closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('amount'); setMethod(null); setAmountInput(''); setOpened(false)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [open])

  const close = () => {
    if (isControlled) controlledOnClose?.()
    else setInternalOpen(false)
  }

  const usd = parseFloat(amountInput) || 0
  const iqd = Math.round(usd * iqdRate)
  const valid = usd >= MIN_USD
  const cfg = method ? METHODS[method] : null
  const waNumber = whatsapp || FALLBACK_WHATSAPP

  const fmtIqd = (n: number) => n.toLocaleString()

  const stepLabels: Record<Step, string> = {
    amount: 'Step 1 of 3 — Choose amount',
    method: 'Step 2 of 3 — Choose payment method',
    pay: 'Step 3 of 3 — Complete payment',
    done: '',
  }

  return (
    <>
      {/* Built-in trigger — only rendered in uncontrolled mode */}
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', marginTop: 20, padding: '12px 20px',
            background: 'var(--gold)', color: 'var(--bg)',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          💳 Add Balance · شحن الرصيد
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          onClick={e => e.target === e.currentTarget && close()}
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 480,
            boxShadow: 'var(--shadow-lg)', animation: 'fadeUp 0.3s ease',
            maxHeight: '90vh', overflowY: 'auto',
          }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                  Add Balance · شحن الرصيد
                </div>
                {step !== 'done' && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
                    {stepLabels[step]}
                  </div>
                )}
              </div>
              <button onClick={close} style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                flexShrink: 0, marginLeft: 12,
              }}>✕</button>
            </div>

            {/* Progress bar */}
            {step !== 'done' && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
                {(['amount', 'method', 'pay'] as Step[]).map((s, i) => {
                  const order: Step[] = ['amount', 'method', 'pay']
                  const filled = order.indexOf(s) <= order.indexOf(step)
                  return (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 2,
                      background: filled ? 'var(--gold)' : 'var(--border)',
                      transition: 'background 0.3s',
                    }} />
                  )
                })}
              </div>
            )}

            {/* ── Step 1: Choose amount (USD) ── */}
            {step === 'amount' && (
              <div style={{ animation: 'fadeUp 0.25s ease' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  How much would you like to add? <span style={{ color: 'var(--text-dim)' }}>(minimum ${MIN_USD})</span>
                </div>

                {/* Quick amount chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {QUICK_AMOUNTS.map(amt => {
                    const active = amountInput === String(amt)
                    return (
                      <button
                        key={amt}
                        onClick={() => setAmountInput(String(amt))}
                        style={{
                          padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                          background: active ? 'var(--gold)' : 'var(--surface2)',
                          color: active ? 'var(--bg)' : 'var(--text)',
                          border: `2px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                        }}
                      >
                        ${amt}
                      </button>
                    )
                  })}
                </div>

                {/* Custom input */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 600,
                    color: 'var(--text-muted)', marginBottom: 7,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    Enter amount in USD
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 20, fontWeight: 700, color: 'var(--text-dim)',
                    }}>$</span>
                    <input
                      type="number"
                      min={MIN_USD}
                      step="5"
                      placeholder="0"
                      value={amountInput}
                      onChange={e => setAmountInput(e.target.value)}
                      style={{
                        width: '100%', background: 'var(--surface2)',
                        border: '1px solid var(--border)', borderRadius: 8,
                        padding: '12px 14px 12px 30px',
                        fontSize: 20, fontWeight: 700, color: 'var(--text)',
                        fontFamily: 'inherit', outline: 'none',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.1)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  </div>
                </div>

                {/* Live IQD conversion */}
                {usd > 0 && (
                  <div style={{
                    padding: '10px 14px', marginBottom: 12,
                    background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)',
                    borderRadius: 8, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>=</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{fmtIqd(iqd)}</span>
                    <span style={{ fontSize: 12, color: 'var(--gold-dim)' }}>IQD</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>
                      (at {fmtIqd(iqdRate)} IQD/USD)
                    </span>
                  </div>
                )}

                {/* Minimum warning */}
                {usd > 0 && usd < MIN_USD && (
                  <div style={{
                    padding: '9px 13px', marginBottom: 12,
                    background: 'rgba(217,83,79,0.1)', border: '1px solid rgba(217,83,79,0.3)',
                    borderRadius: 8, fontSize: 12, color: 'var(--red)',
                  }}>
                    Minimum top-up amount is ${MIN_USD}
                  </div>
                )}

                <button
                  onClick={() => setStep('method')}
                  disabled={!valid}
                  style={{
                    width: '100%', padding: '12px 20px', borderRadius: 8,
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit', marginTop: 4,
                    border: 'none', cursor: valid ? 'pointer' : 'not-allowed',
                    background: valid ? 'var(--gold)' : 'var(--surface3)',
                    color: valid ? 'var(--bg)' : 'var(--text-dim)',
                    transition: 'all 0.15s',
                  }}
                >Continue →</button>
              </div>
            )}

            {/* ── Step 2: Choose payment method ── */}
            {step === 'method' && (
              <div style={{ animation: 'fadeUp 0.25s ease' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Choose how you&apos;d like to pay <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{fmtIqd(iqd)} IQD</span> <span style={{ color: 'var(--text-dim)' }}>(${usd.toFixed(2)})</span>
                </div>
                {(Object.values(METHODS)).map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setMethod(m.id); setOpened(false); setStep('pay') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      width: '100%', padding: '14px 18px', marginBottom: 10,
                      borderRadius: 14, background: m.bg,
                      border: `2px solid ${m.border}`,
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'all 0.18s',
                    }}
                    onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = m.borderActive; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
                    onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = m.border; (e.currentTarget as HTMLButtonElement).style.transform = 'none' }}
                  >
                    {/* Logo */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: m.color, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0,
                      fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: -0.5,
                    }}>
                      {m.short}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>
                        {m.name}{' '}
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
                          · {m.nameAr}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
                        Tap to pay {fmtIqd(iqd)} IQD
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-dim)', fontSize: 20, flexShrink: 0 }}>›</span>
                  </button>
                ))}

                <button
                  onClick={() => setStep('amount')}
                  style={{
                    width: '100%', padding: '10px 16px', borderRadius: 8, marginTop: 4,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border)', fontFamily: 'inherit',
                  }}
                >← Back</button>
              </div>
            )}

            {/* ── Step 3: Pay ── */}
            {step === 'pay' && cfg && (
              <div style={{ animation: 'fadeUp 0.25s ease' }}>
                {/* Amount to pay — prominent */}
                <div style={{
                  textAlign: 'center', padding: '20px 16px', marginBottom: 18,
                  background: cfg.bg, border: `2px solid ${cfg.border}`, borderRadius: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9, background: cfg.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 900, color: '#fff', letterSpacing: -0.5,
                    }}>{cfg.short}</div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: cfg.color }}>
                      {cfg.name} · {cfg.nameAr}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Amount to pay
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2, marginTop: 4 }}>
                    {fmtIqd(iqd)} <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>IQD</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                    = ${usd.toFixed(2)} USD (at {fmtIqd(iqdRate)} IQD/USD)
                  </div>
                </div>

                {/* Open payment app */}
                <button
                  onClick={() => { window.open(cfg.url, '_blank', 'noopener,noreferrer'); setOpened(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', padding: '13px 20px', borderRadius: 10, marginBottom: 10,
                    background: cfg.color, color: '#fff',
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                    border: 'none', cursor: 'pointer', transition: 'opacity 0.15s',
                  }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9' }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                >
                  ↗ {cfg.openLabel}
                </button>

                {/* Completed payment */}
                <button
                  onClick={() => { setStep('done'); onSuccess?.() }}
                  style={{
                    width: '100%', padding: '12px 20px', borderRadius: 10, marginBottom: 10,
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                    background: opened ? 'var(--gold)' : 'var(--surface2)',
                    color: opened ? 'var(--bg)' : 'var(--text)',
                    border: `1px solid ${opened ? 'var(--gold)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  ✓ I&apos;ve completed the payment
                </button>

                <button
                  onClick={() => setStep('method')}
                  style={{
                    width: '100%', padding: '10px 16px', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border)', fontFamily: 'inherit',
                  }}
                >← Back</button>
              </div>
            )}

            {/* ── Done: pending verification ── */}
            {step === 'done' && cfg && (
              <div style={{ textAlign: 'center', animation: 'fadeUp 0.25s ease' }}>
                <div style={{ fontSize: 44, marginBottom: 16, lineHeight: 1 }}>⏳</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                  Payment pending verification
                </div>
                <div style={{
                  fontSize: 13, color: 'var(--text-muted)', marginBottom: 20,
                  lineHeight: 1.7, maxWidth: 380, margin: '0 auto 20px',
                }}>
                  Our team will confirm and add your balance within a few hours. Contact us on WhatsApp if you need help.
                </div>

                {/* Request summary */}
                <div style={{
                  background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)',
                  borderRadius: 10, padding: '14px 18px', marginBottom: 20, textAlign: 'left',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Your request
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>
                    ${usd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gold-dim)' }}>= {fmtIqd(iqd)} IQD</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    via {cfg.name} · {cfg.nameAr}
                  </div>
                </div>

                <a
                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(
                    `Hi ShipIQ! I've paid $${usd.toFixed(2)} (${fmtIqd(iqd)} IQD) via ${cfg.name} to top up my wallet. Please verify and add my balance.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '13px 20px', borderRadius: 8, marginBottom: 10,
                    background: '#25D366', color: '#fff',
                    fontSize: 14, fontWeight: 700, textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.1 21.9l4.837-1.316A9.956 9.956 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.956 7.956 0 0 1-4.099-1.132l-.293-.174-3.044.828.852-3.004-.192-.31A7.953 7.953 0 0 1 4 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/>
                  </svg>
                  Contact on WhatsApp · تواصل معنا
                </a>

                <button
                  onClick={close}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border)', fontFamily: 'inherit',
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
