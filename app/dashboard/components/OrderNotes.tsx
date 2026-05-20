'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { OrderNote } from '@/lib/types'
import { getOrderNotes, addOrderNote, markOrderNotesRead } from '@/lib/api'

interface Props {
  orderId: string
  isAdmin: boolean
  currentUserId: string
  currentUserName: string
  orderUserId: string
  orderUserName?: string
  onMarkRead?: () => void
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  return isToday ? time : `${date} · ${time}`
}

export default function OrderNotes({
  orderId, isAdmin, currentUserId, currentUserName,
  orderUserId, orderUserName, onMarkRead,
}: Props) {
  const [notes, setNotes] = useState<OrderNote[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  const load = useCallback(async (initial = false) => {
    const data = await getOrderNotes(orderId)
    setNotes(data)
    if (initial) setLoading(false)
    scrollToBottom()
  }, [orderId, scrollToBottom])

  useEffect(() => {
    load(true)
    markOrderNotesRead(orderId, isAdmin).then(() => onMarkRead?.())
    const timer = setInterval(() => load(false), 30000)
    return () => clearInterval(timer)
  }, [load, orderId, isAdmin, onMarkRead])

  const send = async () => {
    const msg = message.trim()
    if (!msg || sending) return
    setSending(true)
    const notifyUserId = isAdmin ? orderUserId : undefined
    const { error } = await addOrderNote(orderId, currentUserId, msg, isAdmin, notifyUserId)
    if (!error) {
      setMessage('')
      await load(false)
    }
    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const getSenderLabel = (note: OrderNote) => {
    if (note.user_id === currentUserId) return null // "You" — no label needed above own bubble
    return note.is_admin ? 'ShipIQ' : (orderUserName || 'Customer')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '16px', display: 'flex',
          flexDirection: 'column', gap: 12,
          background: 'var(--bg)',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, marginTop: 60 }}>
            Loading messages…
          </div>
        ) : notes.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, marginTop: 60 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
            <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>No messages yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {isAdmin ? 'Send a message to the customer about this order.' : 'Ask a question about your order.'}
            </div>
          </div>
        ) : (
          notes.map(note => {
            const isMine = note.user_id === currentUserId
            const senderLabel = getSenderLabel(note)

            return (
              <div
                key={note.id}
                style={{
                  display: 'flex',
                  flexDirection: isMine ? 'row-reverse' : 'row',
                  gap: 8,
                  alignItems: 'flex-end',
                }}
              >
                {/* Avatar — only for other party */}
                {!isMine && (
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: note.is_admin ? 'var(--gold)' : 'var(--surface2)',
                    color: note.is_admin ? '#0f0e0c' : 'var(--text-muted)',
                    border: note.is_admin ? 'none' : '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {note.is_admin ? 'S' : (orderUserName?.[0] || 'C').toUpperCase()}
                  </div>
                )}

                <div style={{ maxWidth: '75%', minWidth: 60 }}>
                  {/* Sender label */}
                  {senderLabel && (
                    <div style={{
                      fontSize: 10, fontWeight: 600, color: 'var(--text-dim)',
                      marginBottom: 3, paddingLeft: 4,
                    }}>
                      {senderLabel}
                    </div>
                  )}

                  {/* Bubble */}
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: isMine ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    background: isMine ? 'var(--gold)' : 'var(--surface2)',
                    color: isMine ? '#0f0e0c' : 'var(--text)',
                    border: isMine ? 'none' : '1px solid var(--border)',
                    fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word',
                  }}>
                    {note.message}
                  </div>

                  {/* Timestamp */}
                  <div style={{
                    fontSize: 10, color: 'var(--text-dim)', marginTop: 3,
                    textAlign: isMine ? 'right' : 'left',
                    paddingLeft: isMine ? 0 : 4, paddingRight: isMine ? 4 : 0,
                  }}>
                    {formatTime(note.created_at)}
                    {isMine && note.is_admin && !note.is_read_by_customer && (
                      <span style={{ marginLeft: 4, color: 'var(--text-dim)' }}>·</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={inputRef}
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, 500))}
            onKeyDown={handleKey}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={2}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', fontSize: 13, resize: 'none', outline: 'none',
              fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: message.length > 450 ? 'var(--orange)' : 'var(--text-dim)' }}>
            {message.length}/500
          </span>
          <button
            onClick={send}
            disabled={!message.trim() || sending}
            style={{
              background: message.trim() && !sending ? 'var(--gold)' : 'var(--surface2)',
              color: message.trim() && !sending ? '#0f0e0c' : 'var(--text-dim)',
              border: '1px solid ' + (message.trim() && !sending ? 'var(--gold)' : 'var(--border)'),
              borderRadius: 10, padding: '9px 18px',
              fontSize: 13, fontWeight: 700, cursor: message.trim() && !sending ? 'pointer' : 'default',
              fontFamily: 'inherit', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {sending ? '…' : 'Send ↑'}
          </button>
        </div>
      </div>
    </div>
  )
}
