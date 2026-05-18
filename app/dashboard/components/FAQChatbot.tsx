'use client'
import { useState, useEffect, useRef } from 'react'
import styles from './FAQChatbot.module.css'

const WA_URL = 'https://wa.me/9647XXXXXXXXX'

type Action =
  | 'main'
  | 'how_it_works'
  | 'shipping_rates'
  | 'delivery_time'
  | 'contact_us'
  | 'which_sites'
  | 'uae_rates'
  | 'whatsapp'
  | 'calculator'

interface BubbleDef {
  label: string
  action: Action
}

interface NodeDef {
  answer: string
  bubbles: BubbleDef[]
}

const NODES: Record<string, NodeDef> = {
  how_it_works: {
    answer: "Simple! Submit a link → we calculate shipping → you confirm → we deliver to Iraq 📦",
    bubbles: [
      { label: "Which sites? 🛒", action: "which_sites" },
      { label: "How long? ⏱️", action: "delivery_time" },
      { label: "Main menu 🏠", action: "main" },
    ],
  },
  shipping_rates: {
    answer: "Rates vary by country and category. UAE: Cosmetics $7.25/kg, Supplements $35/kg, Clothing $3.50/kg. Other countries contact us for rates!",
    bubbles: [
      { label: "Calculate shipping ⚡", action: "calculator" },
      { label: "UAE rates 🇦🇪", action: "uae_rates" },
      { label: "Main menu 🏠", action: "main" },
    ],
  },
  delivery_time: {
    answer: "🇺🇸 USA: 10-20 days · 🇹🇷 Turkey: 7-14 days · 🇦🇪 UAE: 5-10 days · 🇨🇳 China: 14-30 days",
    bubbles: [
      { label: "How it works? 🤔", action: "how_it_works" },
      { label: "Contact us 📱", action: "contact_us" },
      { label: "Main menu 🏠", action: "main" },
    ],
  },
  contact_us: {
    answer: "Reach us on WhatsApp! Our team in Erbil & Baghdad is ready to help 🇮🇶",
    bubbles: [
      { label: "💬 Open WhatsApp", action: "whatsapp" },
      { label: "Main menu 🏠", action: "main" },
    ],
  },
  which_sites: {
    answer: "We support Amazon, eBay, Trendyol, Noon, AliExpress, Shein and 20+ more stores! ⚡ Auto-estimates available on Amazon, eBay, B&H, Best Buy and Newegg.",
    bubbles: [
      { label: "Shipping rates 💰", action: "shipping_rates" },
      { label: "Main menu 🏠", action: "main" },
    ],
  },
  uae_rates: {
    answer: "🇦🇪 UAE rates: Cosmetics $7.25/kg · Supplements $35/kg · Clothing $3.50/kg. All prices include door-to-door delivery to Iraq. Contact us for a custom quote!",
    bubbles: [
      { label: "Calculate shipping ⚡", action: "calculator" },
      { label: "Contact us 📱", action: "contact_us" },
      { label: "Main menu 🏠", action: "main" },
    ],
  },
}

const MAIN_BUBBLES: BubbleDef[] = [
  { label: "🤔 How does it work?", action: "how_it_works" },
  { label: "💰 Shipping rates", action: "shipping_rates" },
  { label: "⏱️ Delivery time", action: "delivery_time" },
  { label: "📱 Contact us", action: "contact_us" },
]

const GREETING = "Hi! I'm ShipIQ's assistant 👋 Tap a topic to get started:"

type ChatItem =
  | { type: 'message'; id: number; text: string }
  | { type: 'bubbles'; id: number; bubbles: BubbleDef[] }

function ChatBubbleIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  )
}

export default function FAQChatbot() {
  const [open, setOpen]           = useState(false)
  const [items, setItems]         = useState<ChatItem[]>([])
  const [showUnread, setShowUnread] = useState(true)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const idRef       = useRef(0)
  const initialized = useRef(false)

  const nextId = () => ++idRef.current

  useEffect(() => {
    if (!open) return
    setShowUnread(false)
    if (!initialized.current) {
      initialized.current = true
      setItems([
        { type: 'message', id: nextId(), text: GREETING },
        { type: 'bubbles', id: nextId(), bubbles: MAIN_BUBBLES },
      ])
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items])

  const handleBubble = (action: Action) => {
    if (action === 'whatsapp') {
      window.open(WA_URL, '_blank', 'noopener,noreferrer')
      return
    }
    if (action === 'calculator') {
      window.open('/calculator', '_blank', 'noopener,noreferrer')
      return
    }
    if (action === 'main') {
      setItems(prev => [...prev, { type: 'bubbles', id: nextId(), bubbles: MAIN_BUBBLES }])
      return
    }
    const node = NODES[action]
    if (!node) return
    setItems(prev => [
      ...prev,
      { type: 'message', id: nextId(), text: node.answer },
      { type: 'bubbles', id: nextId(), bubbles: node.bubbles },
    ])
  }

  return (
    <>
      {/* ── Chat window ── */}
      <div
        className={`${styles.window} ${open ? styles.windowOpen : ''}`}
        role="dialog"
        aria-label="ShipIQ Chat Assistant"
        aria-hidden={!open}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.headerAvatar}>🚀</div>
            <div>
              <div className={styles.headerName}>ShipIQ Assistant</div>
              <div className={styles.headerSub}>مساعد شيب آي كيو · Always here</div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close chat">
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div className={styles.messages}>
          {items.map(item => {
            if (item.type === 'message') {
              return (
                <div key={item.id} className={styles.msgRow}>
                  <div className={styles.botAvatar}>S</div>
                  <div className={`${styles.bubble} ${styles.bubbleBot}`}>{item.text}</div>
                </div>
              )
            }
            return (
              <div key={item.id} className={styles.bubblesRow}>
                {item.bubbles.map(b => (
                  <button
                    key={b.label}
                    className={styles.topicBubble}
                    onClick={() => handleBubble(b.action)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Floating button ── */}
      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-expanded={open}
      >
        {open ? <CloseIcon /> : <ChatBubbleIcon />}
        {showUnread && !open && <span className={styles.unreadDot} aria-hidden="true" />}
      </button>
    </>
  )
}
