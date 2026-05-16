'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './FAQChatbot.module.css'

// ── Knowledge base ────────────────────────────────────────────────────────────

interface Topic {
  keywords: string[]
  response: string
}

const TOPICS: Topic[] = [
  {
    keywords: ['who', 'what', 'shipiq', 'about', 'company', 'service', 'من', 'ماذا', 'شيب', 'نحن'],
    response: "ShipIQ is a smart shipping service that helps you buy products from the US, Turkey, UAE and China and delivers them to Iraq. We handle everything — purchasing, shipping, and delivery. 🚀",
  },
  {
    keywords: ['how', 'works', 'process', 'steps', 'كيف', 'خطوات', 'يعمل', 'طريقة'],
    response: "It's simple! 1️⃣ Browse stores and find a product 2️⃣ Submit the link 3️⃣ We calculate the shipping price 4️⃣ You confirm and pay from your balance 5️⃣ We purchase and ship it to you 📦",
  },
  {
    keywords: ['time', 'long', 'days', 'weeks', 'delivery', 'arrive', 'وقت', 'كم', 'أيام', 'توصيل', 'يوم', 'أسبوع'],
    response: "Estimated delivery times: 🇺🇸 USA → 10-20 days · 🇹🇷 Turkey → 7-14 days · 🇦🇪 UAE → 5-10 days · 🇨🇳 China → 14-30 days. Times may vary depending on customs.",
  },
  {
    keywords: ['price', 'cost', 'rate', 'much', 'fee', 'charge', 'expensive', 'cheap', 'سعر', 'تكلفة', 'رسوم', 'شحن', 'كلفة', 'أسعار'],
    response: "Shipping rates vary by country and package weight. Submit your order link and we'll calculate the exact price for you automatically! 💰 Contact us on WhatsApp for current rates.",
  },
  {
    keywords: ['auto', 'calculate', 'estimate', 'automatic', 'instant', 'supported', 'sites', 'احسب', 'تلقائي', 'تقدير', 'حساب'],
    response: "We automatically calculate shipping estimates for: ✅ Amazon ✅ eBay ✅ B&H Photo ✅ Best Buy ✅ Newegg. More sites coming soon including Trendyol, Noon and AliExpress! ⚡",
  },
  {
    keywords: ['balance', 'credit', 'top', 'recharge', 'add', 'pay', 'payment', 'wallet', 'رصيد', 'شحن', 'دفع', 'محفظة', 'شحن الرصيد'],
    response: "Your balance is shown in the top right corner. To add balance, contact us on WhatsApp and we'll top it up manually within 24 hours. 💳",
  },
  {
    keywords: ['tax', 'customs', 'duty', 'extra', 'fees', 'hidden', 'ضريبة', 'جمرك', 'رسوم جمركية', 'عرف'],
    response: "Some items may be subject to Iraqi customs duties depending on the product type and value. We'll let you know if any customs fees apply to your order. 📋",
  },
  {
    keywords: ['cancel', 'cancellation', 'stop', 'remove', 'إلغاء', 'الغاء', 'إيقاف'],
    response: "To cancel an order, contact us as soon as possible on WhatsApp before we purchase the item. Once purchased, cancellation may not be possible. ⚠️",
  },
  {
    keywords: ['track', 'tracking', 'status', 'update', 'تتبع', 'أين', 'وين', 'حالة', 'متى'],
    response: "You can track your order status in the My Orders section. Status updates: ⏳ Pending → 💰 Calculated → ✅ Confirmed → 📦 Shipped. We'll notify you at each step!",
  },
  {
    keywords: ['contact', 'whatsapp', 'phone', 'call', 'reach', 'help', 'support', 'تواصل', 'واتساب', 'مساعدة', 'دعم', 'هاتف'],
    response: "You can reach us on WhatsApp for any questions or support. Our team is available to help you! 📱",
  },
  {
    keywords: ['country', 'countries', 'ship', 'from', 'available', 'دولة', 'دول', 'من أين', 'متوفر', 'يشحن'],
    response: "We currently ship from: 🇺🇸 United States · 🇹🇷 Turkey · 🇦🇪 UAE · 🇨🇳 China. More countries coming soon!",
  },
]

const DEFAULT_RESPONSE = "I'm not sure about that. Please contact us on WhatsApp for more help, or try asking about: shipping rates, delivery time, how it works, or supported sites 😊"

const QUICK_REPLIES = [
  "How does it work?",
  "Shipping rates 💰",
  "Delivery time ⏱️",
  "Contact us 📱",
  "كيف يعمل؟",
  "أسعار الشحن",
  "وقت التوصيل",
]

const GREETING = "Hi! I'm ShipIQ's virtual assistant 👋 How can I help you today? Ask me anything about shipping, rates, or supported stores."

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: number
  role: 'user' | 'bot'
  text: string
}

// ── Keyword matcher ───────────────────────────────────────────────────────────

function findResponse(input: string): string {
  const lower = input.toLowerCase()
  for (const topic of TOPICS) {
    if (topic.keywords.some(kw => lower.includes(kw))) {
      return topic.response
    }
  }
  return DEFAULT_RESPONSE
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FAQChatbot() {
  const [open, setOpen]                     = useState(false)
  const [messages, setMessages]             = useState<Message[]>([])
  const [input, setInput]                   = useState('')
  const [typing, setTyping]                 = useState(false)
  const [showUnread, setShowUnread]         = useState(true)
  const [showQuickReplies, setShowQuickReplies] = useState(true)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const idRef      = useRef(0)
  const greeted    = useRef(false)

  const nextId = () => ++idRef.current

  useEffect(() => {
    if (!open) return
    setShowUnread(false)
    if (!greeted.current) {
      greeted.current = true
      setMessages([{ id: nextId(), role: 'bot', text: GREETING }])
    }
    const t = setTimeout(() => inputRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages(prev => [...prev, { id: ++idRef.current, role: 'user', text: trimmed }])
    setInput('')
    setShowQuickReplies(false)
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages(prev => [...prev, { id: ++idRef.current, role: 'bot', text: findResponse(trimmed) }])
    }, 1000)
  }, [])

  const handleSend = () => sendMessage(input)
  const handleKey  = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
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
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`${styles.msgRow} ${msg.role === 'user' ? styles.msgRowUser : ''}`}
            >
              {msg.role === 'bot' && <div className={styles.botAvatar}>S</div>}
              <div className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot}`}>
                {msg.text}
              </div>
            </div>
          ))}

          {/* Quick reply chips — shown only until first user message */}
          {showQuickReplies && messages.length > 0 && (
            <div className={styles.quickReplies}>
              {QUICK_REPLIES.map(q => (
                <button key={q} className={styles.quickBtn} onClick={() => sendMessage(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Typing indicator */}
          {typing && (
            <div className={styles.msgRow}>
              <div className={styles.botAvatar}>S</div>
              <div className={`${styles.bubble} ${styles.bubbleBot} ${styles.typingBubble}`}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Ask me anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            aria-label="Chat message"
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!input.trim() || typing}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
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
