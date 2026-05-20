'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getSession } from '@/lib/api'

type MsgType = 'announcement' | 'promotion' | 'alert' | 'info'

interface BroadcastRecord {
  id: string
  title: string
  body: string
  type: string
  sent_at: string
  recipient_count: number
  profiles?: { full_name: string } | null
}

const TYPE_CONFIG: Record<MsgType, { icon: string; label: string; accent: string }> = {
  announcement: { icon: '📢', label: 'Announcement', accent: 'var(--blue)' },
  promotion:    { icon: '🎉', label: 'Promotion',    accent: 'var(--green)' },
  alert:        { icon: '⚠️', label: 'Alert',        accent: 'var(--gold)' },
  info:         { icon: 'ℹ️', label: 'Info',         accent: 'var(--text-muted)' },
}

function field(label: React.ReactNode): React.CSSProperties {
  return { fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }
}

export default function AdminBroadcast() {
  const [msgType, setMsgType] = useState<MsgType>('announcement')
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [customerCount, setCustomerCount] = useState(0)
  const [history, setHistory]   = useState<BroadcastRecord[]>([])
  const [histLoading, setHistLoading] = useState(true)
  const [sending, setSending]   = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [viewRecord, setViewRecord]   = useState<BroadcastRecord | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  async function loadHistory() {
    const supabase = createClient()
    const { data } = await supabase
      .from('broadcast_messages')
      .select('*, profiles(full_name)')
      .order('sent_at', { ascending: false })
      .limit(20)
    setHistory(data ?? [])
    setHistLoading(false)
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer')
      setCustomerCount(count ?? 0)
      await loadHistory()
    }
    init()
  }, [])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSend() {
    if (sending) return
    setSending(true)
    setConfirmOpen(false)
    try {
      const session = await getSession()
      if (!session) { showToast('Session expired — please refresh', false); setSending(false); return }
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, type: msgType, access_token: session.access_token }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast(`Sent to ${data.recipientCount.toLocaleString()} customers!`)
        setTitle('')
        setBody('')
        setMsgType('announcement')
        await loadHistory()
      } else {
        showToast(data.error || 'Failed to send', false)
      }
    } catch {
      showToast('Network error', false)
    }
    setSending(false)
  }

  const cfg = TYPE_CONFIG[msgType]
  const canSend = title.trim().length > 0 && body.trim().length > 0

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
          background: toast.ok ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${toast.ok ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: toast.ok ? '#16a34a' : '#ef4444',
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        }}>
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {confirmOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500 }}
            onClick={() => setConfirmOpen(false)}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
            padding: '28px 28px 24px', width: 380, maxWidth: '92vw', zIndex: 501,
            textAlign: 'center', boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>📢</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Confirm Broadcast</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
              Send <strong style={{ color: 'var(--text)' }}>"{title}"</strong> to
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)', marginBottom: 22 }}>
              {customerCount.toLocaleString()} customers
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >Cancel</button>
              <button
                onClick={handleSend}
                style={{ flex: 1, padding: '12px', borderRadius: 9, border: 'none', background: 'var(--gold)', color: 'var(--bg)', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
              >📤 Send Now</button>
            </div>
          </div>
        </>
      )}

      {/* ── View record dialog ── */}
      {viewRecord && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500 }}
            onClick={() => setViewRecord(null)}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
            padding: 28, width: 440, maxWidth: '92vw', zIndex: 501,
            boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  {TYPE_CONFIG[viewRecord.type as MsgType]?.icon || 'ℹ️'} {viewRecord.type}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{viewRecord.title}</div>
              </div>
              <button onClick={() => setViewRecord(null)} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 18, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
              {viewRecord.body}
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
              <span>👥 {viewRecord.recipient_count.toLocaleString()} recipients</span>
              <span>📅 {new Date(viewRecord.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {viewRecord.profiles?.full_name && <span>👤 {viewRecord.profiles.full_name}</span>}
            </div>
          </div>
        </>
      )}

      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>📢 Broadcast Messages</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>رسائل إذاعية · Send announcements to all customers</div>
      </div>

      {/* ── Compose card ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>✍️ Compose Message</div>

        {/* Type selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...field(null), display: 'block', marginBottom: 8 }}>Message Type</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.entries(TYPE_CONFIG) as [MsgType, typeof TYPE_CONFIG[MsgType]][]).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setMsgType(key)}
                style={{
                  padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                  border: msgType === key ? 'none' : '1px solid var(--border)',
                  background: msgType === key ? 'var(--gold)' : 'transparent',
                  color: msgType === key ? 'var(--bg)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {val.icon} {val.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={field(null)}>Title</label>
            <span style={{ fontSize: 11, color: title.length > 55 ? 'var(--orange)' : 'var(--text-dim)' }}>{title.length}/60</span>
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 60))}
            placeholder="e.g. New stores added! 🎉"
            style={{
              width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 9,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={field(null)}>Message Body</label>
            <span style={{ fontSize: 11, color: body.length > 280 ? 'var(--orange)' : 'var(--text-dim)' }}>{body.length}/300</span>
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value.slice(0, 300))}
            placeholder="Write your announcement here..."
            rows={4}
            style={{
              width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 9,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', outline: 'none', resize: 'vertical',
              boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.55,
            }}
          />
        </div>

        {/* Preview */}
        {(title || body) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...field(null), display: 'block', marginBottom: 8 }}>Preview — customer notification bell</div>
            <div style={{
              background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '14px 16px', borderLeft: `3px solid ${cfg.accent}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title || 'Title here…'}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, paddingLeft: 22 }}>{body || 'Message body…'}</div>
            </div>
          </div>
        )}

        {/* Target + send */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, paddingTop: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            🎯 Target: <strong style={{ color: 'var(--text)' }}>All Customers ({customerCount.toLocaleString()})</strong>
          </div>
          <button
            onClick={() => canSend && setConfirmOpen(true)}
            disabled={!canSend || sending}
            style={{
              padding: '12px 24px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700,
              background: canSend && !sending ? 'var(--gold)' : 'var(--surface2)',
              color: canSend && !sending ? 'var(--bg)' : 'var(--text-dim)',
              cursor: canSend && !sending ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
              boxShadow: canSend && !sending ? '0 0 16px rgba(201,168,76,0.4)' : 'none',
            }}
          >
            {sending ? '⏳ Sending…' : `📤 Send to ${customerCount.toLocaleString()} customers`}
          </button>
        </div>
      </div>

      {/* ── Broadcast history ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>📋 Broadcast History</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Last 20 broadcasts · click to view full message</div>
          </div>
        </div>

        {histLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
            <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>No broadcasts sent yet</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Date', 'Type', 'Title', 'Recipients', 'Sent By'].map(h => (
                    <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((rec, i) => {
                  const typeCfg = TYPE_CONFIG[rec.type as MsgType]
                  return (
                    <tr
                      key={rec.id}
                      onClick={() => setViewRecord(rec)}
                      style={{ borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '13px 18px', color: 'var(--text-dim)', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {new Date(rec.sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                        <div style={{ fontSize: 11, marginTop: 1 }}>
                          {new Date(rec.sent_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td style={{ padding: '13px 18px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }}>
                          {typeCfg?.icon || 'ℹ️'} {rec.type}
                        </span>
                      </td>
                      <td style={{ padding: '13px 18px', color: 'var(--text)', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rec.title}
                      </td>
                      <td style={{ padding: '13px 18px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        👥 {rec.recipient_count.toLocaleString()}
                      </td>
                      <td style={{ padding: '13px 18px', color: 'var(--text-dim)', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {rec.profiles?.full_name || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
