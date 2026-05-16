'use client'
import { useState, useEffect } from 'react'

const QUICK_AMOUNTS = [25, 50, 100, 200, 500]
const MIN_USD = 10
const FALLBACK_RATE = 1540

type Method = 'fib' | 'qicard'
type Step = 'method' | 'amount' | 'confirm' | 'done'

const METHODS = {
  fib: {
    id: 'fib' as Method,
    name: 'FIB',
    nameAr: 'بنك الفيبي',
    desc: 'First Iraqi Bank',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
    borderActive: 'rgba(34,197,94,0.7)',
  },
  qicard: {
    id: 'qicard' as Method,
    name: 'Qi Card',
    nameAr: 'كي كارد',
    desc: 'Iraqi Payment Network',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.25)',
    borderActive: 'rgba(249,115,22,0.7)',
  },
}

const ADMIN_WHATSAPP = '964XXXXXXXXXX'

interface Props {
  userId: string
  onSuccess?: () => void
  /** Controlled mode — pass open+onClose from parent instead of using the built-in button */
  open?: boolean
  onClose?: () => void
}

function Dot() {
  return (
    <span style={{
      display: 'inline-block', width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'currentColor',
      borderRadius: '50%', animation: 'spin 0.6s linear infinite', verticalAlign: 'middle',
    }} />
  )
}

export default function WalletTopUp({ userId, onSuccess, open: controlledOpen, onClose: controlledOnClose }: Props) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen! : internalOpen

  const [step, setStep] = useState<Step>('method')
  const [method, setMethod] = useState<Method | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [iqdRate, setIqdRate] = useState(FALLBACK_RATE)

  useEffect(() => {
    if (!open) return
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(d => { if (d.rate && d.rate > 1000) setIqdRate(d.rate) })
      .catch(() => {})
  }, [open])

  // Reset wizard state when modal closes
  useEffect(() => {
    if (!open) setTimeout(() => { setStep('method'); setMethod(null); setAmountInput(''); setProcessing(false) }, 300)
  }, [open])

  const close = () => {
    if (isControlled) { controlledOnClose?.() }
    else { setInternalOpen(false) }
  }

  const usd = parseFloat(amountInput) || 0
  const iqd = Math.round(usd * iqdRate)
  const valid = usd >= MIN_USD

  const handleProceed = async () => {
    setProcessing(true)
    await new Promise(r => setTimeout(r, 1200))
    setProcessing(false)
    setStep('done')
    onSuccess?.()
  }

  const cfg = method ? METHODS[method] : null

  const stepLabels: Record<Step, string> = {
    method: 'Step 1 of 3 — Choose payment method',
    amount: 'Step 2 of 3 — Enter amount',
    confirm: 'Step 3 of 3 — Confirm & pay',
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
          onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold-light)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
          onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.transform = 'none' }}
        >
          💳 Top Up · شحن الرصيد
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
                  Top Up Wallet · شحن المحفظة
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
                {(['method', 'amount', 'confirm'] as Step[]).map((s, i) => {
                  const order: Step[] = ['method', 'amount', 'confirm']
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

            {/* ── Step 1: Choose method ── */}
            {step === 'method' && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Select your preferred payment method:
                </div>
                {(Object.values(METHODS) as typeof METHODS[Method][]).map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setMethod(m.id); setStep('amount') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      width: '100%', padding: '16px 20px', marginBottom: 12,
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
                      width: 52, height: 52, borderRadius: 12,
                      background: m.color, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0,
                      fontSize: m.id === 'fib' ? 12 : 11, fontWeight: 900,
                      color: '#fff', letterSpacing: -0.5,
                    }}>
                      {m.id === 'fib' ? 'FIB' : 'QI'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>
                        {m.name}{' '}
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
                          · {m.nameAr}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>{m.desc}</div>
                    </div>
                    <span style={{ color: 'var(--text-dim)', fontSize: 20, flexShrink: 0 }}>›</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Step 2: Enter amount ── */}
            {step === 'amount' && method && cfg && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  How much would you like to add? <span style={{ color: 'var(--text-dim)' }}>(minimum $10)</span>
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
                          padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
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
                    Custom Amount (USD)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-dim)', fontWeight: 700, fontSize: 17, pointerEvents: 'none',
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
                        padding: '12px 14px 12px 34px',
                        fontSize: 20, fontWeight: 700, color: 'var(--text)',
                        fontFamily: 'inherit', outline: 'none',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.1)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  </div>
                </div>

                {/* IQD equivalent */}
                {usd > 0 && (
                  <div style={{
                    padding: '10px 14px', marginBottom: 12,
                    background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)',
                    borderRadius: 8, display: 'flex', alignItems: 'baseline', gap: 6,
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>=</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{iqd.toLocaleString()}</span>
                    <span style={{ fontSize: 12, color: 'var(--gold-dim)' }}>IQD</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>
                      @ {iqdRate.toLocaleString()} IQD/USD
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
                    Minimum top-up amount is $10
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={() => setStep('method')}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      background: 'transparent', color: 'var(--text-muted)',
                      border: '1px solid var(--border)', fontFamily: 'inherit',
                    }}
                  >← Back</button>
                  <button
                    onClick={() => setStep('confirm')}
                    disabled={!valid}
                    style={{
                      flex: 2, padding: '11px 20px', borderRadius: 8,
                      fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                      border: 'none', cursor: valid ? 'pointer' : 'not-allowed',
                      background: valid ? 'var(--gold)' : 'var(--surface3)',
                      color: valid ? 'var(--bg)' : 'var(--text-dim)',
                      transition: 'all 0.15s',
                    }}
                  >Continue →</button>
                </div>
              </div>
            )}

            {/* ── Step 3: Confirm ── */}
            {step === 'confirm' && method && cfg && (
              <div>
                {/* Summary card */}
                <div style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '16px 20px', marginBottom: 20,
                }}>
                  {[
                    ['Payment Method', `${cfg.name} · ${cfg.nameAr}`],
                    ['Amount (USD)', `$${usd.toFixed(2)}`],
                    ['Amount (IQD)', `${iqd.toLocaleString()} IQD`],
                    ['Rate', `1 USD = ${iqdRate.toLocaleString()} IQD`],
                  ].map(([label, value]) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: '1px solid rgba(58,56,53,0.5)',
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</span>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: 12,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Total to Add</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>
                      {iqd.toLocaleString()} <span style={{ fontSize: 13, color: 'var(--gold-dim)' }}>IQD</span>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setStep('amount')}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      background: 'transparent', color: 'var(--text-muted)',
                      border: '1px solid var(--border)', fontFamily: 'inherit',
                    }}
                  >← Back</button>
                  <button
                    onClick={handleProceed}
                    disabled={processing}
                    style={{
                      flex: 2, padding: '11px 20px', borderRadius: 8,
                      fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                      border: 'none', cursor: processing ? 'default' : 'pointer',
                      background: 'var(--gold)', color: 'var(--bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: processing ? 0.7 : 1, transition: 'opacity 0.15s',
                    }}
                  >
                    {processing ? <><Dot /> Processing...</> : 'Proceed to Payment →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Done: Gateway coming soon ── */}
            {step === 'done' && cfg && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 16, lineHeight: 1 }}>🚧</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                  Payment Gateway Coming Soon
                </div>
                <div style={{
                  fontSize: 13, color: 'var(--text-muted)', marginBottom: 20,
                  lineHeight: 1.7, maxWidth: 360, margin: '0 auto 20px',
                }}>
                  Online {cfg.name} payment is being set up. To top up right now, contact us on WhatsApp and we&apos;ll process it manually within minutes.
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
                    ${usd.toFixed(2)} USD — {iqd.toLocaleString()} IQD
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    via {cfg.name} · {cfg.nameAr}
                  </div>
                </div>

                <a
                  href={`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(
                    `Hi ShipIQ! I'd like to top up my wallet with $${usd.toFixed(2)} USD (${iqd.toLocaleString()} IQD) via ${cfg.name}.`
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
