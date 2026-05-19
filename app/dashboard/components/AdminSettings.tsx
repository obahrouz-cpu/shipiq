'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type Settings = Record<string, string>

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadSettings(): Promise<Settings> {
  const supabase = createClient()
  const { data } = await supabase.from('app_settings').select('key, value')
  if (!data) return {}
  return Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
}

async function saveKeys(keys: string[], values: Settings): Promise<{ error: string | null }> {
  const supabase = createClient()
  const rows = keys.map(k => ({ key: k, value: values[k] ?? '', updated_at: new Date().toISOString() }))
  const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' })
  return { error: error?.message ?? null }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.6px',
      }}>
        {title}
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>{hint}</div>}
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

const taStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', lineHeight: 1.5, minHeight: 80,
}

function SaveBtn({ loading, onClick, saved }: { loading: boolean; onClick: () => void; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '9px 20px', fontSize: 13, fontWeight: 700,
        background: saved ? '#16a34a' : 'var(--gold)',
        color: saved ? '#fff' : 'var(--bg)',
        border: 'none', borderRadius: 8,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'background 0.2s',
      }}
    >
      {loading ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
    </button>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 38, height: 22, borderRadius: 11, flexShrink: 0,
          background: checked ? 'var(--gold)' : 'var(--border)',
          position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 19 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>
    </label>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const MSG_KEYS = [
  { key: 'msg_order_received',   icon: '📋', label: 'Order Received',    vars: ['{orderId}', '{customerName}'] },
  { key: 'msg_price_calculated', icon: '💰', label: 'Price Calculated',  vars: ['{orderId}', '{customerName}'] },
  { key: 'msg_order_confirmed',  icon: '✅', label: 'Order Confirmed',   vars: ['{orderId}', '{customerName}'] },
  { key: 'msg_item_ordered',     icon: '🛒', label: 'Item Ordered',      vars: ['{orderId}', '{customerName}'] },
  { key: 'msg_at_warehouse',     icon: '🏭', label: 'At Warehouse',      vars: ['{orderId}', '{customerName}'] },
  { key: 'msg_in_transit',       icon: '✈️', label: 'In Transit',        vars: ['{orderId}', '{customerName}'] },
  { key: 'msg_arrived_city',     icon: '🏙️', label: 'Arrived in City',   vars: ['{orderId}', '{customerName}', '{city}'] },
  { key: 'msg_out_for_delivery', icon: '🚚', label: 'Out for Delivery',  vars: ['{orderId}', '{customerName}'] },
  { key: 'msg_delivered',        icon: '📬', label: 'Delivered',         vars: ['{orderId}', '{customerName}'] },
  { key: 'msg_rejected',         icon: '❌', label: 'Rejected',          vars: ['{orderId}', '{customerName}', '{reason}'] },
  { key: 'msg_balance_added',    icon: '💳', label: 'Balance Added',     vars: ['{amount}', '{balance}', '{customerName}'] },
]

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({})
  const [loaded, setLoaded] = useState(false)

  // Per-section save state
  const [contactSaving, setContactSaving] = useState(false)
  const [contactSaved,  setContactSaved]  = useState(false)
  const [msgSaving,     setMsgSaving]     = useState(false)
  const [msgSaved,      setMsgSaved]      = useState(false)
  const [bizSaving,     setBizSaving]     = useState(false)
  const [bizSaved,      setBizSaved]      = useState(false)
  const [feeSaving,     setFeeSaving]     = useState(false)
  const [feeSaved,      setFeeSaved]      = useState(false)
  const [fxSaving,      setFxSaving]      = useState(false)
  const [fxSaved,       setFxSaved]       = useState(false)
  const [waveSaving,    setWaveSaving]    = useState(false)
  const [waveSaved,     setWaveSaved]     = useState(false)
  const [waveTestLoading, setWaveTestLoading] = useState(false)
  const [waveTestResult,  setWaveTestResult]  = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    loadSettings().then(s => { setSettings(s); setLoaded(true) })
  }, [])

  const set = useCallback((key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  async function save(
    keys: string[],
    setSaving: (v: boolean) => void,
    setSaved: (v: boolean) => void
  ) {
    setSaving(true)
    await saveKeys(keys, settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!loaded) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)', fontSize: 13 }}>
        Loading settings...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>

      {/* ── SECTION 1: Contact & Notifications ── */}
      <Section title="Contact & Notifications">
        <Field label="Admin WhatsApp (your number for notifications)" hint="You will receive order alerts here · +964 7XX XXX XXXX">
          <input
            style={inputStyle}
            placeholder="+964 770 000 0000"
            value={settings.admin_whatsapp ?? ''}
            onChange={e => set('admin_whatsapp', e.target.value)}
          />
        </Field>
        <Field label="Business WhatsApp (customers message this number)" hint="The number shown to customers for support">
          <input
            style={inputStyle}
            placeholder="+964 770 000 0000"
            value={settings.business_whatsapp ?? ''}
            onChange={e => set('business_whatsapp', e.target.value)}
          />
        </Field>
        <Field label="Notification Triggers">
          {[
            { key: 'notif_new_order',      label: 'Notify me when a new order is submitted' },
            { key: 'notif_confirmed',      label: 'Notify me when a customer confirms an order' },
            { key: 'notif_agent_ordered',  label: 'Notify me when agent marks as ordered' },
            { key: 'notif_agent_warehouse',label: 'Notify me when agent marks as at warehouse' },
          ].map(n => (
            <Toggle
              key={n.key}
              checked={settings[n.key] !== 'false'}
              onChange={v => set(n.key, v ? 'true' : 'false')}
              label={n.label}
            />
          ))}
        </Field>
        <SaveBtn
          loading={contactSaving}
          saved={contactSaved}
          onClick={() => save(
            ['admin_whatsapp', 'business_whatsapp', 'notif_new_order', 'notif_confirmed', 'notif_agent_ordered', 'notif_agent_warehouse'],
            setContactSaving, setContactSaved
          )}
        />
      </Section>

      {/* ── SECTION 2: Message Templates ── */}
      <Section title="WhatsApp Message Templates">
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14, padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
          Available variables: <code style={{ color: 'var(--gold)' }}>{'{orderId}'}</code> · <code style={{ color: 'var(--gold)' }}>{'{customerName}'}</code> · <code style={{ color: 'var(--gold)' }}>{'{amount}'}</code> · <code style={{ color: 'var(--gold)' }}>{'{balance}'}</code> · <code style={{ color: 'var(--gold)' }}>{'{reason}'}</code> · <code style={{ color: 'var(--gold)' }}>{'{city}'}</code>
        </div>
        {MSG_KEYS.map(m => (
          <Field
            key={m.key}
            label={`${m.icon} ${m.label}`}
            hint={`Variables: ${m.vars.join(', ')}`}
          >
            <textarea
              style={taStyle}
              value={settings[m.key] ?? ''}
              onChange={e => set(m.key, e.target.value)}
            />
          </Field>
        ))}
        <SaveBtn
          loading={msgSaving}
          saved={msgSaved}
          onClick={() => save(MSG_KEYS.map(m => m.key), setMsgSaving, setMsgSaved)}
        />
      </Section>

      {/* ── SECTION 3: Business Settings ── */}
      <Section title="Business Information">
        <Field label="Business Name">
          <input style={inputStyle} value={settings.business_name ?? ''} onChange={e => set('business_name', e.target.value)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Erbil Office Address">
            <textarea style={{ ...taStyle, minHeight: 64 }} value={settings.erbil_address ?? ''} onChange={e => set('erbil_address', e.target.value)} placeholder="Street, district..." />
          </Field>
          <Field label="Baghdad Office Address">
            <textarea style={{ ...taStyle, minHeight: 64 }} value={settings.baghdad_address ?? ''} onChange={e => set('baghdad_address', e.target.value)} placeholder="Street, district..." />
          </Field>
        </div>
        <Field label="Pickup Hours">
          <input style={inputStyle} value={settings.pickup_hours ?? ''} onChange={e => set('pickup_hours', e.target.value)} placeholder="e.g. 9AM – 6PM, Sat–Thu" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Website URL">
            <input style={inputStyle} value={settings.website_url ?? ''} onChange={e => set('website_url', e.target.value)} placeholder="https://shipiq1.vercel.app" />
          </Field>
          <Field label="Instagram Handle">
            <input style={inputStyle} value={settings.instagram ?? ''} onChange={e => set('instagram', e.target.value)} placeholder="@shipiq" />
          </Field>
        </div>
        <SaveBtn
          loading={bizSaving}
          saved={bizSaved}
          onClick={() => save(
            ['business_name', 'erbil_address', 'baghdad_address', 'pickup_hours', 'website_url', 'instagram'],
            setBizSaving, setBizSaved
          )}
        />
      </Section>

      {/* ── SECTION 4: Delivery Fees ── */}
      <Section title="Delivery Fees (IQD)">
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
          These fees are used in shipping estimates and order quotes automatically.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Erbil Home Delivery">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                type="number"
                value={settings.delivery_fee_erbil ?? '3000'}
                onChange={e => set('delivery_fee_erbil', e.target.value)}
              />
              <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>IQD</span>
            </div>
          </Field>
          <Field label="Baghdad Home Delivery">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                type="number"
                value={settings.delivery_fee_baghdad ?? '5000'}
                onChange={e => set('delivery_fee_baghdad', e.target.value)}
              />
              <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>IQD</span>
            </div>
          </Field>
        </div>
        <Field label="Other Cities">
          <input
            style={inputStyle}
            value={settings.delivery_fee_other ?? 'Contact us'}
            onChange={e => set('delivery_fee_other', e.target.value)}
            placeholder="Contact us"
          />
        </Field>
        <SaveBtn
          loading={feeSaving}
          saved={feeSaved}
          onClick={() => save(
            ['delivery_fee_erbil', 'delivery_fee_baghdad', 'delivery_fee_other'],
            setFeeSaving, setFeeSaved
          )}
        />
      </Section>

      {/* ── SECTION 5: Wave Accounting ── */}
      <Section title="Wave Accounting Integration">
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14, padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
          When enabled, charging a customer automatically creates a paid invoice in Wave. Get your credentials from{' '}
          <a href="https://developer.waveapps.com/hc/en-us/articles/360019762711" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)' }}>Wave Developer Settings</a>.
        </div>
        <Field label="Enable Wave Sync">
          <Toggle
            checked={settings.wave_enabled !== 'false'}
            onChange={v => set('wave_enabled', v ? 'true' : 'false')}
            label="Automatically create invoices in Wave after charging"
          />
        </Field>
        <Field label="Wave Access Token" hint="Full Access token from Wave → Settings → Developer → Tokens">
          <input
            style={inputStyle}
            type="password"
            placeholder="Full Access token..."
            value={settings.wave_access_token ?? ''}
            onChange={e => set('wave_access_token', e.target.value)}
          />
        </Field>
        <Field label="Wave Business ID" hint="Found in the Wave URL: app.waveapps.com/businesses/{ID}/...">
          <input
            style={inputStyle}
            placeholder="QnVzaW5lc3M6..."
            value={settings.wave_business_id ?? ''}
            onChange={e => set('wave_business_id', e.target.value)}
          />
        </Field>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SaveBtn
            loading={waveSaving}
            saved={waveSaved}
            onClick={() => save(['wave_enabled', 'wave_access_token', 'wave_business_id'], setWaveSaving, setWaveSaved)}
          />
          <button
            onClick={async () => {
              setWaveTestLoading(true)
              setWaveTestResult(null)
              try {
                const res = await fetch('/api/wave')
                const data = await res.json()
                if (data.ok) {
                  const names = data.businesses?.map((b: { name: string }) => b.name).join(', ') ?? ''
                  setWaveTestResult({ ok: true, msg: `Connected · ${names}` })
                } else {
                  setWaveTestResult({ ok: false, msg: data.error ?? 'Connection failed' })
                }
              } catch (e) {
                setWaveTestResult({ ok: false, msg: String(e) })
              }
              setWaveTestLoading(false)
            }}
            disabled={waveTestLoading}
            style={{
              padding: '9px 20px', fontSize: 13, fontWeight: 700,
              background: 'var(--surface)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 8,
              cursor: waveTestLoading ? 'not-allowed' : 'pointer',
              opacity: waveTestLoading ? 0.7 : 1,
            }}
          >
            {waveTestLoading ? 'Testing...' : '🔌 Test Connection'}
          </button>
          {waveTestResult && (
            <span style={{ fontSize: 13, color: waveTestResult.ok ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
              {waveTestResult.ok ? '✅' : '❌'} {waveTestResult.msg}
            </span>
          )}
        </div>
      </Section>

      {/* ── SECTION 6: Exchange Rate ── */}
      <Section title="IQD Exchange Rate">
        <Field label="Rate Mode">
          <Toggle
            checked={settings.iqd_rate_mode !== 'manual'}
            onChange={v => set('iqd_rate_mode', v ? 'live' : 'manual')}
            label="Use live rate (scraped automatically)"
          />
        </Field>
        {settings.iqd_rate_mode === 'manual' && (
          <Field label="Manual IQD / USD Rate" hint="Used when live scraping is unavailable or you want to override">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                type="number"
                value={settings.iqd_rate_manual ?? '1540'}
                onChange={e => set('iqd_rate_manual', e.target.value)}
                placeholder="1540"
              />
              <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>IQD / USD</span>
            </div>
          </Field>
        )}
        {settings.iqd_rate_mode !== 'manual' && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14 }}>
            Live rate is fetched from iraqborsa.com. Manual override ({settings.iqd_rate_manual ?? '1540'} IQD/USD) is used as fallback.
          </div>
        )}
        <SaveBtn
          loading={fxSaving}
          saved={fxSaved}
          onClick={() => save(['iqd_rate_mode', 'iqd_rate_manual'], setFxSaving, setFxSaved)}
        />
      </Section>

    </div>
  )
}
