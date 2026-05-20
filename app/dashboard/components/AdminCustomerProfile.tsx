'use client'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import {
  getUserOrders, getUserTransactions, getWishlist, getUserDeliveryRequests,
  topUpBalance, deductBalance, removeFromWishlist,
} from '@/lib/api'
import type { Profile, Order, Transaction, WishlistItem, DeliveryRequest, TierSettings } from '@/lib/types'
import TierBadge from './TierBadge'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const MapPicker = dynamic(() => import('./MapPicker'), { ssr: false })

// ── Constants ─────────────────────────────────────────────────────────────────

const IQD_PER_USD = 1540

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending:    { color: 'var(--orange)', bg: 'rgba(224,123,58,0.12)' },
  calculated: { color: 'var(--blue)',   bg: 'rgba(91,155,213,0.12)' },
  confirmed:  { color: 'var(--green)',  bg: 'rgba(76,175,122,0.12)' },
  ordered:    { color: '#d4960a',       bg: 'rgba(224,160,32,0.12)' },
  warehouse:  { color: '#9b59b6',       bg: 'rgba(155,89,182,0.12)' },
  transit:    { color: '#3b82f6',       bg: 'rgba(59,130,246,0.12)' },
  arrived:    { color: '#14b8a6',       bg: 'rgba(20,184,166,0.12)' },
  delivered:  { color: '#16a34a',       bg: 'rgba(34,197,94,0.12)' },
  rejected:   { color: 'var(--red)',    bg: 'rgba(217,83,79,0.12)' },
}

const QUICK_TOPUPS = [10000, 25000, 50000, 100000]
const TOPUP_REASONS = ['Manual top-up', 'Refund', 'Compensation', 'Promotional credit', 'Payment received', 'Error correction']
const CHART_COLORS = ['#c9a84c', '#e07b3a', '#5b9bd5', '#4caf7a', '#d9534f', '#9c6fe4', '#f5c518']
const AGENT_COUNTRIES = ['USA', 'Turkey', 'UAE', 'China'] as const

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomerProfile extends Profile {
  is_suspended?: boolean
  suspension_reason?: string
  last_seen_at?: string
}

interface AdminNote {
  id: string
  customer_id: string
  admin_id: string
  note: string
  created_at: string
}

interface Props {
  customer: CustomerProfile
  tierSettings: TierSettings[]
  onClose: () => void
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onRefresh?: () => void
  currentAdminId: string
}

// ── Shared style objects ──────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

const GHOST_BTN: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Spin() {
  return (
    <span style={{
      width: 14, height: 14, border: '2px solid rgba(255,255,255,0.25)',
      borderTopColor: 'currentColor', borderRadius: '50%',
      animation: 'spin 0.6s linear infinite', display: 'inline-block', verticalAlign: 'middle',
    }} />
  )
}

function Pill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
      color: s.color, background: s.bg, border: `1px solid ${s.color}40`,
    }}>
      {status}
    </span>
  )
}

function Section({
  title, icon, count, open, onToggle, children,
}: {
  title: string; icon: string; count?: number; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '13px 18px',
          background: 'var(--surface2)', border: 'none', cursor: 'pointer',
          color: 'var(--text)', fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
          {count !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: 'rgba(201,168,76,0.15)', color: 'var(--gold)' }}>
              {count}
            </span>
          )}
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: 18, background: 'var(--surface)', animation: 'fadeUp 0.18s ease' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminCustomerProfile({
  customer, tierSettings, onClose, onToast, onRefresh, currentAdminId,
}: Props) {
  const [cust, setCust] = useState<CustomerProfile>(customer)

  // Data
  const [orders, setOrders] = useState<Order[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([])
  const [adminNotes, setAdminNotes] = useState<AdminNote[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Sections
  const [open, setOpen] = useState({
    finance: true, orders: false, delivery: false, wishlist: false,
    comm: false, settings: false, analytics: false, agents: false,
  })
  const toggle = (k: keyof typeof open) => setOpen(p => ({ ...p, [k]: !p[k] }))

  // Inline edit
  const [editName, setEditName] = useState(false)
  const [nameVal, setNameVal] = useState(customer.full_name)
  const [editPhone, setEditPhone] = useState(false)
  const [phoneVal, setPhoneVal] = useState(customer.phone || '')
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editName) nameRef.current?.focus() }, [editName])
  useEffect(() => { if (editPhone) phoneRef.current?.focus() }, [editPhone])

  // Balance
  const [balAction, setBalAction] = useState<'add' | 'deduct' | null>(null)
  const [balAmt, setBalAmt] = useState('')
  const [balCur, setBalCur] = useState('IQD')
  const [balNote, setBalNote] = useState(TOPUP_REASONS[0])
  const [balLoading, setBalLoading] = useState(false)

  // Orders filter
  const [orderFilter, setOrderFilter] = useState('all')

  // Notes
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  // Notify
  const [showNotify, setShowNotify] = useState(false)
  const [notifTitle, setNotifTitle] = useState('')
  const [notifMsg, setNotifMsg] = useState('')
  const [notifLoading, setNotifLoading] = useState(false)

  // Settings
  const [tierOverride, setTierOverride] = useState(customer.tier || tierSettings[0]?.tier || 'bronze')
  const [suspendReason, setSuspendReason] = useState(customer.suspension_reason || '')
  const [suspending, setSuspending] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [resetPwdLoading, setResetPwdLoading] = useState(false)
  const [tierSaving, setTierSaving] = useState(false)

  // ── Load all data ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true)
    const [ords, t, wl, dels] = await Promise.all([
      getUserOrders(customer.id),
      getUserTransactions(customer.id),
      getWishlist(customer.id),
      getUserDeliveryRequests(customer.id),
    ])
    setOrders(ords)
    setTxns(t)
    setWishlist(wl)
    setDeliveries(dels)
    const supabase = createClient()
    const { data: notes } = await supabase
      .from('customer_admin_notes')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
    setAdminNotes(notes || [])
    setDataLoading(false)
  }, [customer.id])

  useEffect(() => { loadData() }, [loadData])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const statusCounts: Record<string, number> = {}
    for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1
    const charged = orders.filter(o => o.is_charged && o.total_charged)
    const totalChargedIqd = charged.reduce((s, o) => s + (o.total_charged || 0), 0)
    const avgOrderIqd = charged.length > 0 ? totalChargedIqd / charged.length : 0
    const pendingIqd = orders.filter(o => o.status === 'confirmed' && !o.is_charged).reduce((s, o) => s + (o.total_cost || 0), 0)
    return { statusCounts, totalChargedIqd, avgOrderIqd, pendingIqd }
  }, [orders])

  // ── Chart data ──────────────────────────────────────────────────────────────
  const charts = useMemo(() => {
    const mOrders: Record<string, number> = {}
    const mSpend: Record<string, number> = {}
    for (const o of orders) {
      const m = o.created_at.slice(0, 7)
      mOrders[m] = (mOrders[m] || 0) + 1
      if (o.total_charged) mSpend[m] = (mSpend[m] || 0) + o.total_charged
    }
    const ordersChart = Object.entries(mOrders).sort(([a],[b]) => a.localeCompare(b)).slice(-6).map(([m, v]) => ({ m: m.slice(5), v }))
    const spendChart  = Object.entries(mSpend).sort(([a],[b]) => a.localeCompare(b)).slice(-6).map(([m, v]) => ({ m: m.slice(5), v: Math.round(v / 1000) }))
    const catMap: Record<string, number> = {}
    for (const o of orders) catMap[o.category] = (catMap[o.category] || 0) + 1
    const catChart = Object.entries(catMap).sort(([,a],[,b]) => b - a).slice(0, 6).map(([name, value]) => ({ name, value }))
    const storeMap: Record<string, number> = {}
    for (const o of orders) {
      try { const h = new URL(o.url).hostname.replace('www.', ''); storeMap[h] = (storeMap[h] || 0) + 1 } catch {}
    }
    const topStores = Object.entries(storeMap).sort(([,a],[,b]) => b - a).slice(0, 5)
    return { ordersChart, spendChart, catChart, topStores }
  }, [orders])

  const filteredOrders = useMemo(() =>
    orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter),
    [orders, orderFilter]
  )
  const firstOrder = orders.length > 0 ? orders[orders.length - 1] : null
  const lastOrder  = orders.length > 0 ? orders[0] : null
  const isSuspended = !!cust.is_suspended

  // ── Actions ──────────────────────────────────────────────────────────────────

  const saveName = async () => {
    if (!nameVal.trim()) return
    const supabase = createClient()
    await supabase.from('profiles').update({ full_name: nameVal.trim() }).eq('id', cust.id)
    setCust(p => ({ ...p, full_name: nameVal.trim() }))
    setEditName(false)
    onToast('Name updated', 'success')
  }

  const savePhone = async () => {
    const supabase = createClient()
    await supabase.from('profiles').update({ phone: phoneVal.trim() }).eq('id', cust.id)
    setCust(p => ({ ...p, phone: phoneVal.trim() }))
    setEditPhone(false)
    onToast('Phone updated', 'success')
  }

  const handleBalance = async () => {
    if (!balAmt || !balAction) return
    setBalLoading(true)
    const raw = parseInt(balAmt)
    const iqd = balCur === 'USD' ? Math.round(raw * IQD_PER_USD) : raw
    if (balAction === 'add') {
      await topUpBalance(cust.id, cust.balance, iqd, 'IQD', balNote)
      setCust(p => ({ ...p, balance: p.balance + iqd }))
      onToast(`+${iqd.toLocaleString()} IQD added`, 'success')
    } else {
      const { error } = await deductBalance(cust.id, cust.balance, iqd, 'IQD', balNote)
      if (error) { onToast(error, 'error'); setBalLoading(false); return }
      setCust(p => ({ ...p, balance: p.balance - iqd }))
      onToast(`−${iqd.toLocaleString()} IQD deducted`, 'success')
    }
    setBalLoading(false)
    setBalAmt('')
    setBalAction(null)
    const updated = await getUserTransactions(customer.id)
    setTxns(updated)
  }

  const quickTopUp = async (amount: number) => {
    await topUpBalance(cust.id, cust.balance, amount, 'IQD', 'Quick top-up')
    setCust(p => ({ ...p, balance: p.balance + amount }))
    onToast(`+${amount.toLocaleString()} IQD`, 'success')
    const updated = await getUserTransactions(customer.id)
    setTxns(updated)
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setNoteSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('customer_admin_notes').insert({
      customer_id: customer.id,
      admin_id: currentAdminId,
      note: noteText.trim(),
    })
    if (error) { onToast('Failed to save note', 'error'); setNoteSaving(false); return }
    setNoteText('')
    const { data } = await supabase.from('customer_admin_notes').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false })
    setAdminNotes(data || [])
    setNoteSaving(false)
    onToast('Note saved', 'success')
  }

  const deleteNote = async (id: string) => {
    const supabase = createClient()
    await supabase.from('customer_admin_notes').delete().eq('id', id)
    setAdminNotes(p => p.filter(n => n.id !== id))
  }

  const toggleSuspend = async () => {
    setSuspending(true)
    const nowSuspended = !isSuspended
    const supabase = createClient()
    await supabase.from('profiles').update({
      is_suspended: nowSuspended,
      suspension_reason: nowSuspended ? (suspendReason || null) : null,
    }).eq('id', cust.id)
    setCust(p => ({ ...p, is_suspended: nowSuspended, suspension_reason: nowSuspended ? suspendReason : undefined }))
    setSuspending(false)
    onToast(nowSuspended ? 'Account suspended' : 'Account reinstated', nowSuspended ? 'error' : 'success')
    onRefresh?.()
  }

  const saveTier = async () => {
    setTierSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ tier: tierOverride }).eq('id', cust.id)
    setCust(p => ({ ...p, tier: tierOverride }))
    setTierSaving(false)
    onToast('Tier updated', 'success')
  }

  const resetPassword = async () => {
    setResetPwdLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(cust.email)
    setResetPwdLoading(false)
    onToast('Reset email sent to ' + cust.email, 'success')
  }

  const deleteAccount = async () => {
    if (deleteConfirm !== cust.full_name) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('profiles').update({
      is_suspended: true,
      suspension_reason: 'Account deactivated by admin',
    }).eq('id', cust.id)
    setDeleting(false)
    onToast('Account deactivated. Remove from Supabase Auth for full deletion.', 'info')
    onRefresh?.()
    onClose()
  }

  const sendNotification = async () => {
    if (!notifMsg.trim()) return
    setNotifLoading(true)
    const supabase = createClient()
    await supabase.from('notifications').insert({
      user_id: cust.id,
      title: notifTitle.trim() || 'Message from ShipIQ',
      message: notifMsg.trim(),
      type: 'info',
    })
    setNotifLoading(false)
    setNotifTitle('')
    setNotifMsg('')
    setShowNotify(false)
    onToast('Notification sent', 'success')
  }

  const exportCSV = () => {
    const rows = [
      ['Date', 'Type', 'Amount', 'Currency', 'Note', 'Order ID'],
      ...txns.map(t => [
        t.created_at.split('T')[0],
        t.amount > 0 ? 'Credit' : 'Debit',
        Math.abs(t.amount).toString(),
        t.currency,
        t.note,
        t.order_id || '',
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${cust.full_name.replace(/\s+/g, '-')}-transactions.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          zIndex: 1100, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Slide-in panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(680px, 100vw)',
        background: 'var(--bg)',
        zIndex: 1101,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 64px rgba(0,0,0,0.55)',
        animation: 'slideInRight 0.3s cubic-bezier(0.32,0.72,0,1)',
        overflow: 'hidden',
      }}>

        {/* Sticky header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', flexShrink: 0, gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{cust.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Customer Profile · Admin View</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 90 }}>

          {/* ── SECTION 1: Profile Header (always visible) ─────────────────── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 10 }}>

            {/* Avatar + name row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
              {/* Avatar */}
              <div style={{
                width: 68, height: 68, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 800, color: 'var(--bg)',
                border: isSuspended ? '2px solid var(--red)' : '2px solid rgba(201,168,76,0.35)',
                position: 'relative',
              }}>
                {cust.full_name?.[0]?.toUpperCase() || '?'}
                {isSuspended && (
                  <span style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: '50%', background: 'var(--red)', border: '2px solid var(--bg)', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>✕</span>
                )}
              </div>

              {/* Info block */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name (editable) */}
                <div style={{ marginBottom: 5 }}>
                  {editName ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input ref={nameRef} value={nameVal} onChange={e => setNameVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditName(false) }} style={{ ...INPUT, fontSize: 16, fontWeight: 700, padding: '5px 10px', flex: 1 }} />
                      <button onClick={saveName} style={{ padding: '5px 12px', background: 'var(--gold)', color: 'var(--bg)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>✓</button>
                      <button onClick={() => setEditName(false)} style={GHOST_BTN}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{cust.full_name}</span>
                      <button onClick={() => { setEditName(true); setNameVal(cust.full_name) }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, padding: 2, lineHeight: 1 }} title="Edit name">✎</button>
                    </div>
                  )}
                </div>

                {/* Email (read-only) */}
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 5 }}>✉️ {cust.email}</div>

                {/* Phone (editable) */}
                <div style={{ marginBottom: 8 }}>
                  {editPhone ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input ref={phoneRef} type="tel" value={phoneVal} onChange={e => setPhoneVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') savePhone(); if (e.key === 'Escape') setEditPhone(false) }} placeholder="Phone number" style={{ ...INPUT, fontSize: 13, padding: '5px 10px', flex: 1 }} />
                      <button onClick={savePhone} style={{ padding: '5px 12px', background: 'var(--gold)', color: 'var(--bg)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>✓</button>
                      <button onClick={() => setEditPhone(false)} style={GHOST_BTN}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>📞 {cust.phone || 'No phone'}</span>
                      <button onClick={() => { setEditPhone(true); setPhoneVal(cust.phone || '') }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, padding: 2 }} title="Edit phone">✎</button>
                    </div>
                  )}
                </div>

                {/* Status chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--surface2)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    📅 {cust.created_at?.split('T')[0]}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, color: isSuspended ? 'var(--red)' : 'var(--green)', background: isSuspended ? 'rgba(217,83,79,0.1)' : 'rgba(76,175,122,0.1)', border: `1px solid ${isSuspended ? 'rgba(217,83,79,0.25)' : 'rgba(76,175,122,0.25)'}` }}>
                    {isSuspended ? '🚫 Suspended' : '✓ Active'}
                  </span>
                  {cust.last_seen_at && (
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--surface2)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      👁 {new Date(cust.last_seen_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tier badge */}
            {tierSettings.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <TierBadge tier={cust.tier || 'bronze'} totalSpent={cust.total_spent || 0} tiers={tierSettings} />
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {[
                { label: '💳 Add Balance', color: 'var(--green)',      act: () => { setBalAction('add'); setOpen(p => ({ ...p, finance: true })) } },
                { label: '💸 Deduct',      color: 'var(--red)',        act: () => { setBalAction('deduct'); setOpen(p => ({ ...p, finance: true })) } },
                { label: isSuspended ? '✓ Reinstate' : '🚫 Suspend', color: isSuspended ? 'var(--green)' : 'var(--orange)', act: toggleSuspend },
                { label: '💬 Notify',      color: 'var(--blue)',       act: () => { setShowNotify(true); setOpen(p => ({ ...p, comm: true })) } },
                { label: '🔑 Reset Pwd',   color: 'var(--text-muted)', act: resetPassword },
              ].map(({ label, color, act }) => (
                <button key={label} onClick={act} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${color}35`, background: `${color}12`, color, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {dataLoading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13 }}>
              <Spin /> Loading customer data...
            </div>
          )}

          {!dataLoading && (
            <>
              {/* ── SECTION 2: Balance & Finance ──────────────────────────────── */}
              <Section title="Balance & Finance" icon="💰" open={open.finance} onToggle={() => toggle('finance')}>
                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: 'Current Balance', val: `${cust.balance.toLocaleString()} IQD`, sub: `≈ $${(cust.balance / IQD_PER_USD).toFixed(2)}`, color: 'var(--gold)' },
                    { label: 'Total Spent',      val: `$${(cust.total_spent || 0).toFixed(2)}`, sub: 'USD lifetime', color: 'var(--text)' },
                    { label: 'Total Orders',     val: orders.length.toString(), sub: 'all time', color: 'var(--blue)' },
                    { label: 'Avg Order',        val: `${Math.round(stats.avgOrderIqd / 1000)}k IQD`, sub: stats.pendingIqd > 0 ? `${Math.round(stats.pendingIqd/1000)}k pending` : 'no pending', color: 'var(--orange)' },
                  ].map(({ label, val, sub, color }) => (
                    <div key={label} style={{ padding: 12, background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Quick top-up */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Quick Top-up (IQD)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {QUICK_TOPUPS.map(amt => (
                      <button key={amt} onClick={() => quickTopUp(amt)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--gold)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                        +{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Balance action form */}
                {balAction && (
                  <div style={{ background: balAction === 'add' ? 'rgba(76,175,122,0.06)' : 'rgba(217,83,79,0.06)', border: `1px solid ${balAction === 'add' ? 'rgba(76,175,122,0.2)' : 'rgba(217,83,79,0.2)'}`, borderRadius: 10, padding: 14, marginBottom: 14, animation: 'fadeUp 0.15s ease' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {(['add', 'deduct'] as const).map(a => (
                        <button key={a} onClick={() => setBalAction(a)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', background: balAction === a ? (a === 'add' ? 'var(--green)' : 'var(--red)') : 'var(--surface3)', color: balAction === a ? '#fff' : 'var(--text-muted)' }}>
                          {a === 'add' ? '💳 Add' : '💸 Deduct'}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input type="number" placeholder="Amount" value={balAmt} onChange={e => setBalAmt(e.target.value)} style={{ ...INPUT, flex: 2 }} />
                      <select value={balCur} onChange={e => setBalCur(e.target.value)} style={{ ...INPUT, flex: 1, padding: '9px 8px' }}>
                        <option value="IQD">IQD</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                    <select value={balNote} onChange={e => setBalNote(e.target.value)} style={{ ...INPUT, marginBottom: 8 }}>
                      {TOPUP_REASONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleBalance} disabled={balLoading || !balAmt} style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', background: balAction === 'add' ? 'var(--green)' : 'var(--red)', color: '#fff', opacity: !balAmt ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {balLoading ? <Spin /> : `${balAction === 'add' ? 'Add' : 'Deduct'} ${balAmt ? parseInt(balAmt).toLocaleString() : '—'} ${balCur}`}
                      </button>
                      <button onClick={() => { setBalAction(null); setBalAmt('') }} style={GHOST_BTN}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Transaction history */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>History ({txns.length})</div>
                  <button onClick={exportCSV} style={{ ...GHOST_BTN, padding: '4px 10px', fontSize: 11 }}>📥 Export CSV</button>
                </div>
                {txns.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--text-dim)', fontSize: 13 }}>No transactions yet</div>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)' }}>
                          {['Date', 'Type', 'Amount', 'Note', 'Order'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.7, borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {txns.slice(0, 50).map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px solid rgba(58,56,53,0.35)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--text-dim)' }}>{t.created_at.split('T')[0]}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ color: t.amount > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: 11 }}>{t.amount > 0 ? '↑ Credit' : '↓ Debit'}</span>
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: t.amount > 0 ? 'var(--green)' : 'var(--red)' }}>{t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note}</td>
                            <td style={{ padding: '8px 10px' }}>{t.order_id ? <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--gold)' }}>{t.order_id}</span> : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* ── SECTION 3: Orders ──────────────────────────────────────────── */}
              <Section title="Orders" icon="📦" count={orders.length} open={open.orders} onToggle={() => toggle('orders')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  <button onClick={() => setOrderFilter('all')} style={{ padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', background: orderFilter === 'all' ? 'var(--surface3)' : 'var(--surface2)', color: orderFilter === 'all' ? 'var(--text)' : 'var(--text-dim)' }}>
                    All ({orders.length})
                  </button>
                  {Object.entries(stats.statusCounts).map(([status, count]) => {
                    const s = STATUS_STYLE[status] || STATUS_STYLE.pending
                    return (
                      <button key={status} onClick={() => setOrderFilter(orderFilter === status ? 'all' : status)} style={{ padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', color: s.color, background: orderFilter === status ? s.bg : 'var(--surface2)', outline: orderFilter === status ? `2px solid ${s.color}50` : 'none' }}>
                        {status} {count}
                      </button>
                    )
                  })}
                </div>

                {filteredOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--text-dim)', fontSize: 13 }}>No orders</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredOrders.slice(0, 30).map(o => (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        {o.photo_url ? (
                          <img src={o.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--surface3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📦</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{o.description}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-dim)' }}>{o.id}</span>
                            <Pill status={o.status} />
                          </div>
                        </div>
                        {o.total_cost != null && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', flexShrink: 0 }}>{o.total_cost.toLocaleString()}</div>
                        )}
                      </div>
                    ))}
                    {filteredOrders.length > 30 && (
                      <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--text-dim)' }}>Showing 30 of {filteredOrders.length}</div>
                    )}
                  </div>
                )}
              </Section>

              {/* ── SECTION 4: Delivery & Address ─────────────────────────────── */}
              <Section title="Delivery & Address" icon="📍" open={open.delivery} onToggle={() => toggle('delivery')}>
                {cust.delivery_address ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Address</div>
                        <div style={{ fontSize: 13, color: 'var(--text)' }}>{cust.delivery_address}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>City</div>
                        <div style={{ fontSize: 13, color: 'var(--text)' }}>{cust.delivery_city || '—'}</div>
                      </div>
                      {cust.delivery_notes && (
                        <div style={{ gridColumn: '1/-1' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Notes</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{cust.delivery_notes}</div>
                        </div>
                      )}
                    </div>
                    {cust.delivery_lat && cust.delivery_lng && (
                      <MapPicker lat={cust.delivery_lat} lng={cust.delivery_lng} height={200} readOnly />
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--text-dim)', fontSize: 13 }}>No delivery address saved</div>
                )}

                {deliveries.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Delivery History</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {deliveries.map(d => (
                        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{d.created_at.split('T')[0]} · {d.delivery_preference}</span>
                          <Pill status={d.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* ── SECTION 5: Wishlist ────────────────────────────────────────── */}
              <Section title="Wishlist" icon="❤️" count={wishlist.length} open={open.wishlist} onToggle={() => toggle('wishlist')}>
                {wishlist.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--text-dim)', fontSize: 13 }}>Empty wishlist</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {wishlist.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        {item.photo_url && <img src={item.photo_url} alt="" style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || item.url}</div>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{item.url}</a>
                        </div>
                        <button onClick={async () => { await removeFromWishlist(item.id); setWishlist(p => p.filter(w => w.id !== item.id)) }} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(217,83,79,0.25)', background: 'rgba(217,83,79,0.08)', color: 'var(--red)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* ── SECTION 6: Communication ───────────────────────────────────── */}
              <Section title="Communication" icon="💬" open={open.comm} onToggle={() => toggle('comm')}>
                {/* Send notification */}
                {showNotify ? (
                  <div style={{ background: 'rgba(91,155,213,0.06)', border: '1px solid rgba(91,155,213,0.2)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 10 }}>Send In-App Notification</div>
                    <input placeholder="Title (optional)" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} style={{ ...INPUT, marginBottom: 8 }} />
                    <textarea placeholder="Message..." value={notifMsg} onChange={e => setNotifMsg(e.target.value)} rows={3} style={{ ...INPUT, resize: 'vertical', minHeight: 70, marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={sendNotification} disabled={notifLoading || !notifMsg.trim()} style={{ flex: 2, padding: '9px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {notifLoading ? <Spin /> : '💬 Send'}
                      </button>
                      <button onClick={() => setShowNotify(false)} style={GHOST_BTN}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowNotify(true)} style={{ ...GHOST_BTN, width: '100%', padding: '10px', marginBottom: 14 }}>💬 Send In-App Notification</button>
                )}

                {/* Admin notes */}
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Internal Notes (admin only)</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <textarea placeholder="Add note... (customer won't see this)" value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} style={{ ...INPUT, flex: 1, resize: 'none', minHeight: 58 }} />
                  <button onClick={addNote} disabled={noteSaving || !noteText.trim()} style={{ padding: '0 14px', background: 'var(--gold)', color: 'var(--bg)', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', opacity: !noteText.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {noteSaving ? <Spin /> : 'Add'}
                  </button>
                </div>

                {adminNotes.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>No notes yet</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {adminNotes.map(n => (
                      <div key={n.id} style={{ padding: '10px 12px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{n.note}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
                        </div>
                        <button onClick={() => deleteNote(n.id)} style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* ── SECTION 7: Account Settings ───────────────────────────────── */}
              <Section title="Account Settings" icon="⚙️" open={open.settings} onToggle={() => toggle('settings')}>
                {/* Language */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Language</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Customer preference (read-only)</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface2)', padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    {cust.language === 'ar' ? '🇮🇶 Arabic' : '🇬🇧 English'}
                  </span>
                </div>

                {/* Tier override */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Tier Override</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Force tier regardless of spending</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select value={tierOverride} onChange={e => setTierOverride(e.target.value)} style={{ ...INPUT, width: 'auto', padding: '7px 10px', fontSize: 12 }}>
                      {tierSettings.map(t => <option key={t.tier} value={t.tier}>{t.icon} {t.name_en}</option>)}
                    </select>
                    <button onClick={saveTier} disabled={tierSaving} style={{ padding: '7px 14px', background: 'var(--gold)', color: 'var(--bg)', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      {tierSaving ? '...' : 'Apply'}
                    </button>
                  </div>
                </div>

                {/* Suspension */}
                <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Account Suspension</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{isSuspended ? 'Currently suspended' : 'Account is active'}</div>
                    </div>
                    <button onClick={toggleSuspend} disabled={suspending} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', background: isSuspended ? 'rgba(76,175,122,0.12)' : 'rgba(217,83,79,0.1)', color: isSuspended ? 'var(--green)' : 'var(--red)' }}>
                      {suspending ? '...' : isSuspended ? '✓ Reinstate' : '🚫 Suspend'}
                    </button>
                  </div>
                  {!isSuspended && (
                    <input placeholder="Suspension reason (optional)" value={suspendReason} onChange={e => setSuspendReason(e.target.value)} style={{ ...INPUT, marginTop: 10, fontSize: 12 }} />
                  )}
                  {isSuspended && cust.suspension_reason && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', fontStyle: 'italic' }}>Reason: {cust.suspension_reason}</div>
                  )}
                </div>

                {/* Reset password */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Reset Password</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Send reset link to {cust.email}</div>
                  </div>
                  <button onClick={resetPassword} disabled={resetPwdLoading} style={{ ...GHOST_BTN, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {resetPwdLoading ? <Spin /> : '🔑 Send Reset Email'}
                  </button>
                </div>

                {/* Delete / deactivate */}
                <div style={{ paddingTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>⚠️ Deactivate Account</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.5 }}>
                    Type <strong style={{ color: 'var(--text)' }}>{cust.full_name}</strong> to confirm permanent suspension.
                    For full auth deletion use the Supabase dashboard.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input placeholder={`Type "${cust.full_name}"`} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} style={{ ...INPUT, flex: 1, fontSize: 12 }} />
                    <button onClick={deleteAccount} disabled={deleting || deleteConfirm !== cust.full_name} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(217,83,79,0.3)', background: 'rgba(217,83,79,0.1)', color: 'var(--red)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', opacity: deleteConfirm !== cust.full_name ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {deleting ? <Spin /> : 'Deactivate'}
                    </button>
                  </div>
                </div>
              </Section>

              {/* ── SECTION 8: Analytics ──────────────────────────────────────── */}
              <Section title="Analytics" icon="📊" open={open.analytics} onToggle={() => toggle('analytics')}>
                {orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--text-dim)', fontSize: 13 }}>No order data yet</div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 20 }}>
                      {[
                        { label: 'First Order', val: firstOrder?.created_at.split('T')[0] || '—', color: 'var(--text)' },
                        { label: 'Latest Order', val: lastOrder?.created_at.split('T')[0] || '—', color: 'var(--text)' },
                        { label: 'Customer LTV', val: `${Math.round(stats.totalChargedIqd/1000)}k IQD`, color: 'var(--gold)' },
                        { label: 'Avg Freq', val: orders.length >= 2 && firstOrder && lastOrder ? `${Math.round((new Date(lastOrder.created_at).getTime() - new Date(firstOrder.created_at).getTime()) / (Math.max(orders.length-1,1) * 86400000))}d` : '—', color: 'var(--blue)' },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ padding: 12, background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {charts.ordersChart.length > 1 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Orders per Month</div>
                        <ResponsiveContainer width="100%" height={110}>
                          <BarChart data={charts.ordersChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="m" stroke="var(--text-dim)" fontSize={9} />
                            <YAxis stroke="var(--text-dim)" fontSize={9} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                            <Bar dataKey="v" fill="var(--gold)" radius={[3,3,0,0]} name="Orders" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {charts.spendChart.length > 1 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Spending (000s IQD)</div>
                        <ResponsiveContainer width="100%" height={110}>
                          <LineChart data={charts.spendChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="m" stroke="var(--text-dim)" fontSize={9} />
                            <YAxis stroke="var(--text-dim)" fontSize={9} />
                            <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                            <Line type="monotone" dataKey="v" stroke="var(--blue)" strokeWidth={2} dot={false} name="Spent (k IQD)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {charts.catChart.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Order Categories</div>
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie data={charts.catChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55}>
                              {charts.catChart.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {charts.topStores.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Most Used Stores</div>
                        {charts.topStores.map(([store, count]) => (
                          <div key={store} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(58,56,53,0.35)', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>{store}</span>
                            <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{count} orders</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Section>

              {/* ── SECTION 9: Agent Interactions ──────────────────────────────── */}
              <Section title="Agent Interactions" icon="🤝" open={open.agents} onToggle={() => toggle('agents')}>
                {orders.filter(o => o.country_origin).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--text-dim)', fontSize: 13 }}>No agent-handled orders</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {AGENT_COUNTRIES.map(country => {
                      const co = orders.filter(o => o.country_origin === country)
                      if (co.length === 0) return null
                      const receipts  = co.filter(o => o.agent_receipt_url).length
                      const warehoused = co.filter(o => o.agent_warehouse_photo_url).length
                      const rejected  = co.filter(o => o.status === 'rejected')
                      return (
                        <div key={country} style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>{country}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--text-muted)', marginBottom: rejected.length > 0 ? 8 : 0 }}>
                            <span>📦 {co.length} orders</span>
                            {receipts > 0 && <span>🧾 {receipts} receipts</span>}
                            {warehoused > 0 && <span>🏭 {warehoused} at warehouse</span>}
                          </div>
                          {rejected.length > 0 && (
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>⚠️ Rejected</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {rejected.map(o => <span key={o.id} style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 7px', background: 'rgba(217,83,79,0.1)', color: 'var(--red)', borderRadius: 4 }}>{o.id}</span>)}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>

        {/* Sticky bottom action bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          padding: '10px 16px', display: 'flex', gap: 8,
        }}>
          <button onClick={() => { setBalAction('add'); setOpen(p => ({ ...p, finance: true })) }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(76,175,122,0.3)', background: 'rgba(76,175,122,0.1)', color: 'var(--green)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
            💳 Add Balance
          </button>
          <button onClick={() => { setShowNotify(true); setOpen(p => ({ ...p, comm: true })) }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(91,155,213,0.3)', background: 'rgba(91,155,213,0.1)', color: 'var(--blue)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
            💬 Notify
          </button>
          <button onClick={toggleSuspend} disabled={suspending} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${isSuspended ? 'rgba(76,175,122,0.3)' : 'rgba(217,83,79,0.25)'}`, background: isSuspended ? 'rgba(76,175,122,0.1)' : 'rgba(217,83,79,0.08)', color: isSuspended ? 'var(--green)' : 'var(--red)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
            {isSuspended ? '✓ Reinstate' : '🚫 Suspend'}
          </button>
        </div>
      </div>
    </>
  )
}
