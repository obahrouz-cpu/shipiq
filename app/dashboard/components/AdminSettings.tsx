'use client'
import { useState, useEffect, useCallback } from 'react'
import { getAppSettings, saveAppSettings } from '@/lib/api'
import AdminPricing from './AdminPricing'

// ── Types ─────────────────────────────────────────────────────────────────────

type Settings = Record<string, string>

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

const pillBtnStyle: React.CSSProperties = {
  padding: '5px 14px', fontSize: 12, fontWeight: 700,
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer',
}

function SaveBtn({ loading, onClick, saved, label = 'Save' }: { loading: boolean; onClick: () => void; saved: boolean; label?: string }) {
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
      {loading ? 'Saving...' : saved ? '✓ Saved' : label}
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

// Each template's customer-notification toggle lives at notify_{event} (msg_x → notify_x).
const notifyKeyOf = (msgKey: string) => msgKey.replace('msg_', 'notify_')

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({})
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState(0)

  // Per-section save state
  const [waOpen,   setWaOpen]   = useState(false)
  const [waSaving, setWaSaving] = useState(false)
  const [waSaved,  setWaSaved]  = useState(false)
  const [bizSaving,     setBizSaving]     = useState(false)
  const [bizSaved,      setBizSaved]      = useState(false)
  const [feeSaving,     setFeeSaving]     = useState(false)
  const [feeSaved,      setFeeSaved]      = useState(false)
  const [fxSaving,      setFxSaving]      = useState(false)
  const [fxSaved,       setFxSaved]       = useState(false)
  const [acctSaving,     setAcctSaving]     = useState(false)
  const [acctSaved,      setAcctSaved]      = useState(false)
  const [acctTestLoading, setAcctTestLoading] = useState(false)
  const [acctTestResult,  setAcctTestResult]  = useState<{ ok: boolean; msg: string } | null>(null)
  const [affSaving,      setAffSaving]      = useState(false)
  const [affSaved,       setAffSaved]       = useState(false)

  // Fetch once on mount — runs regardless of whether the WhatsApp section is collapsed.
  useEffect(() => {
    getAppSettings().then(({ settings, error, count }) => {
      setSettings(settings)
      setLoadError(error)
      setRowCount(count)
      setLoaded(true)
    })
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
    await saveAppSettings(keys, settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // WhatsApp section helpers
  const enabledCount = MSG_KEYS.filter(m => settings[notifyKeyOf(m.key)] !== 'false').length
  const setAllNotify = (on: boolean) => {
    setSettings(prev => {
      const next = { ...prev }
      for (const m of MSG_KEYS) next[notifyKeyOf(m.key)] = on ? 'true' : 'false'
      return next
    })
  }
  const WA_KEYS = [
    'admin_whatsapp', 'business_whatsapp',
    ...MSG_KEYS.map(m => m.key),
    ...MSG_KEYS.map(m => notifyKeyOf(m.key)),
  ]

  if (!loaded) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)', fontSize: 13 }}>
        ⏳ Loading settings from Supabase...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>

      {/* ── Pricing Engine (configurable rates, shared with Flutter app) ── */}
      <AdminPricing />

      {/* ── SECTION 1+2: WhatsApp Notifications (collapsible) ── */}
      <div style={{
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden', marginBottom: 16,
      }}>
        {/* Header — always visible */}
        <div
          onClick={() => setWaOpen(o => !o)}
          style={{
            padding: '14px 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', cursor: 'pointer',
            borderBottom: waOpen ? '1px solid var(--border)' : 'none',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>📱 WhatsApp Notifications</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--gold)',
              background: 'rgba(201,168,76,0.12)', padding: '3px 10px', borderRadius: 20,
            }}>
              {enabledCount}/{MSG_KEYS.length} enabled
            </span>
            <span style={{
              fontSize: 12, color: 'var(--text-muted)',
              transform: waOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
            }}>▼</span>
          </div>
        </div>

        {/* Body — only when expanded */}
        {waOpen && (
          <div style={{ padding: '16px' }}>
            {/* Load status — confirms the fetch ran and how many rows came back */}
            {loadError ? (
              <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)' }}>
                ⚠️ Failed to load settings: {loadError}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
                Loaded {rowCount} setting{rowCount === 1 ? '' : 's'} from Supabase.
              </div>
            )}
            {/* WhatsApp number fields */}
            <Field label="Admin WhatsApp (your number for notifications)" hint="You will receive order alerts here · +964 7XX XXX XXXX">
              <input
                className="phone-number"
                dir="ltr"
                style={inputStyle}
                placeholder="+964 770 000 0000"
                value={settings.admin_whatsapp ?? ''}
                onChange={e => set('admin_whatsapp', e.target.value)}
              />
            </Field>
            <Field label="Business WhatsApp (customers message this number)" hint="The number shown to customers for support">
              <input
                className="phone-number"
                dir="ltr"
                style={inputStyle}
                placeholder="+964 770 000 0000"
                value={settings.business_whatsapp ?? ''}
                onChange={e => set('business_whatsapp', e.target.value)}
              />
            </Field>

            {/* Templates list header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 8, marginTop: 18, paddingTop: 14, marginBottom: 12,
              borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {enabledCount}/{MSG_KEYS.length} enabled
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setAllNotify(true)} style={pillBtnStyle}>Enable All</button>
                <button onClick={() => setAllNotify(false)} style={pillBtnStyle}>Disable All</button>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14, padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
              Available variables: <code style={{ color: 'var(--gold)' }}>{'{orderId}'}</code> · <code style={{ color: 'var(--gold)' }}>{'{customerName}'}</code> · <code style={{ color: 'var(--gold)' }}>{'{amount}'}</code> · <code style={{ color: 'var(--gold)' }}>{'{balance}'}</code> · <code style={{ color: 'var(--gold)' }}>{'{reason}'}</code> · <code style={{ color: 'var(--gold)' }}>{'{city}'}</code>
            </div>

            {/* Template rows */}
            {MSG_KEYS.map(m => {
              const nk = notifyKeyOf(m.key)
              const on = settings[nk] !== 'false'
              return (
                <div key={m.key} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', opacity: on ? 1 : 0.5 }}>
                    <Toggle
                      checked={on}
                      onChange={v => set(nk, v ? 'true' : 'false')}
                      label={`${m.icon} ${m.label}`}
                    />
                  </div>
                  {on && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', margin: '2px 0 5px' }}>
                        Variables: {m.vars.join(', ')}
                      </div>
                      <textarea
                        style={taStyle}
                        value={settings[m.key] ?? ''}
                        onChange={e => set(m.key, e.target.value)}
                      />
                    </>
                  )}
                </div>
              )
            })}

            {/* Single Save All button */}
            <div style={{ marginTop: 16 }}>
              <SaveBtn
                loading={waSaving}
                saved={waSaved}
                label="💾 Save All"
                onClick={() => save(WA_KEYS, setWaSaving, setWaSaved)}
              />
            </div>
          </div>
        )}
      </div>

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

      {/* ── SECTION 5: Accounting Integration ── */}
      <Section title="Accounting Integration">
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
          When a customer is charged, ShipIQ can automatically create a paid invoice in your accounting software.
          Save your credentials first, then use Test Connection to verify.
        </div>

        {/* Provider selector */}
        <Field label="Accounting Provider">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { id: 'none', label: 'None — no automatic sync' },
              { id: 'wave', label: 'Wave Accounting' },
              { id: 'zoho', label: 'Zoho Books' },
            ] as { id: string; label: string }[]).map(opt => (
              <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="accounting_provider"
                  value={opt.id}
                  checked={(settings.accounting_provider ?? 'none') === opt.id}
                  onChange={() => { set('accounting_provider', opt.id); setAcctTestResult(null) }}
                  style={{ accentColor: 'var(--gold)', width: 15, height: 15 }}
                />
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{opt.label}</span>
              </label>
            ))}
          </div>
        </Field>

        {/* Wave credentials */}
        {(settings.accounting_provider ?? 'none') === 'wave' && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
              Get your credentials from Wave → Settings → Developer → Tokens.
              The Business ID is in the URL: <code style={{ color: 'var(--gold)' }}>app.waveapps.com/businesses/{'<ID>'}/...</code>
            </div>
            <Field label="Wave Access Token">
              <input
                style={inputStyle}
                type="password"
                placeholder="Full Access token..."
                value={settings.wave_access_token ?? ''}
                onChange={e => set('wave_access_token', e.target.value)}
              />
            </Field>
            <Field label="Wave Business ID">
              <input
                style={inputStyle}
                placeholder="QnVzaW5lc3M6..."
                value={settings.wave_business_id ?? ''}
                onChange={e => set('wave_business_id', e.target.value)}
              />
            </Field>
          </>
        )}

        {/* Zoho credentials */}
        {(settings.accounting_provider ?? 'none') === 'zoho' && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
              Get credentials from Zoho Books → Settings → Developer Space → Self Client.
              The Organization ID is under Settings → Organization → Organization Profile.
            </div>
            <Field label="Zoho Access Token">
              <input
                style={inputStyle}
                type="password"
                placeholder="1000.xxxxx..."
                value={settings.zoho_access_token ?? ''}
                onChange={e => set('zoho_access_token', e.target.value)}
              />
            </Field>
            <Field label="Zoho Organization ID">
              <input
                style={inputStyle}
                placeholder="123456789"
                value={settings.zoho_org_id ?? ''}
                onChange={e => set('zoho_org_id', e.target.value)}
              />
            </Field>
          </>
        )}

        {/* Save + test */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <SaveBtn
            loading={acctSaving}
            saved={acctSaved}
            onClick={() => save(
              ['accounting_provider', 'wave_access_token', 'wave_business_id', 'zoho_access_token', 'zoho_org_id'],
              setAcctSaving, setAcctSaved
            )}
          />
          {(settings.accounting_provider === 'wave' || settings.accounting_provider === 'zoho') && (
            <button
              onClick={async () => {
                setAcctTestLoading(true)
                setAcctTestResult(null)
                try {
                  const res = await fetch(`/api/accounting/test?provider=${settings.accounting_provider}`)
                  const data = await res.json()
                  setAcctTestResult({ ok: data.ok, msg: data.msg ?? (data.ok ? 'Connected' : 'Failed') })
                } catch (e) {
                  setAcctTestResult({ ok: false, msg: String(e) })
                }
                setAcctTestLoading(false)
              }}
              disabled={acctTestLoading}
              style={{
                padding: '9px 20px', fontSize: 13, fontWeight: 700,
                background: 'var(--surface)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 8,
                cursor: acctTestLoading ? 'not-allowed' : 'pointer',
                opacity: acctTestLoading ? 0.7 : 1,
              }}
            >
              {acctTestLoading ? 'Testing...' : '🔌 Test Connection'}
            </button>
          )}
          {acctTestResult && (
            <span style={{ fontSize: 13, color: acctTestResult.ok ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
              {acctTestResult.ok ? '✅' : '❌'} {acctTestResult.msg}
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

      {/* ── SECTION: Affiliate Links ── */}
      <Section title="🔗 Affiliate Links · روابط الإحالة">
        <Toggle
          checked={settings.affiliate_enabled !== 'false'}
          onChange={v => set('affiliate_enabled', v ? 'true' : 'false')}
          label="Enable affiliate links"
        />
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, padding: '8px 10px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
          Affiliate tags are automatically added to order URLs when agents purchase items.
        </div>
        {([
          { key: 'affiliate_amazon',    label: 'Amazon US',   param: 'tag=' },
          { key: 'affiliate_amazon_ae', label: 'Amazon UAE',  param: 'tag=' },
          { key: 'affiliate_ebay',      label: 'eBay',        param: 'campid=' },
          { key: 'affiliate_trendyol',  label: 'Trendyol',    param: 'boutiqueId=' },
          { key: 'affiliate_noon',      label: 'Noon',        param: 'affiliate=' },
          { key: 'affiliate_aliexpress',label: 'AliExpress',  param: 'aff_fcid=' },
          { key: 'affiliate_bhphoto',   label: 'B&H Photo',   param: 'BI=' },
          { key: 'affiliate_bestbuy',   label: 'Best Buy',    param: 'ref=' },
          { key: 'affiliate_newegg',    label: 'Newegg',      param: 'cm_mmc=' },
        ] as { key: string; label: string; param: string }[]).map(({ key, label, param }) => (
          <Field key={key} label={label} hint={param}>
            <input
              style={inputStyle}
              type="text"
              value={settings[key] ?? ''}
              onChange={e => set(key, e.target.value)}
              placeholder={`e.g. shipiq-20`}
            />
          </Field>
        ))}
        <SaveBtn
          loading={affSaving}
          saved={affSaved}
          onClick={() => save([
            'affiliate_enabled',
            'affiliate_amazon', 'affiliate_amazon_ae', 'affiliate_ebay',
            'affiliate_trendyol', 'affiliate_noon', 'affiliate_aliexpress',
            'affiliate_bhphoto', 'affiliate_bestbuy', 'affiliate_newegg',
          ], setAffSaving, setAffSaved)}
        />
      </Section>

    </div>
  )
}
