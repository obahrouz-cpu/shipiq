import { NextRequest, NextResponse } from 'next/server'

// ── Helpers ─────────────────────────────────────────────────────────────────

// WhatsApp APIs want a bare international number (digits only, no "+" or spaces).
function normalizePhone(raw: string): string {
  return (raw || '').replace(/[^\d]/g, '')
}

interface UltramsgConfig { instanceId: string; token: string }
interface TwilioConfig { accountSid: string; authToken: string; from: string }

function ultramsgConfig(): UltramsgConfig | null {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID || ''
  const token = process.env.ULTRAMSG_TOKEN || ''
  if (!instanceId || !token) return null
  return { instanceId, token }
}

function twilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
  const authToken = process.env.TWILIO_AUTH_TOKEN || ''
  const from = process.env.TWILIO_WHATSAPP_NUMBER || ''
  if (!accountSid || !authToken || !from) return null
  return { accountSid, authToken, from }
}

async function sendUltramsg(cfg: UltramsgConfig, phone: string, message: string) {
  const res = await fetch(`https://api.ultramsg.com/${cfg.instanceId}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: cfg.token, to: normalizePhone(phone), body: message }),
  })
  return res
}

async function sendTwilio(cfg: TwilioConfig, phone: string, message: string) {
  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64')
  const params = new URLSearchParams({
    From: `whatsapp:${cfg.from}`,
    To: `whatsapp:+${normalizePhone(phone)}`,
    Body: message,
  })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: params.toString(),
  })
  return res
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let phone = ''
  let message = ''
  let orderId = ''
  try {
    const body = await req.json()
    phone = body.phone
    message = body.message
    orderId = body.orderId
  } catch {
    return NextResponse.json({ success: true, skipped: true })
  }

  if (!phone || !message) {
    // Nothing to send — never fail loudly.
    return NextResponse.json({ success: true, skipped: true })
  }

  // Choose provider: honour WHATSAPP_PROVIDER, otherwise auto-detect by creds.
  const preferred = (process.env.WHATSAPP_PROVIDER || 'ultramsg').toLowerCase()
  const ultra = ultramsgConfig()
  const twilio = twilioConfig()

  let provider: 'ultramsg' | 'twilio' | null = null
  if (preferred === 'twilio' && twilio) provider = 'twilio'
  else if (preferred === 'ultramsg' && ultra) provider = 'ultramsg'
  else if (ultra) provider = 'ultramsg'
  else if (twilio) provider = 'twilio'

  if (!provider) {
    console.log('WhatsApp not configured — skipping message', { orderId })
    return NextResponse.json({ success: true, skipped: true })
  }

  try {
    const res = provider === 'twilio'
      ? await sendTwilio(twilio!, phone, message)
      : await sendUltramsg(ultra!, phone, message)

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`WhatsApp send failed (${provider})`, res.status, detail)
      // Never fail loudly — the order operation must still succeed.
      return NextResponse.json({ success: true, sent: false, provider })
    }
    return NextResponse.json({ success: true, sent: true, provider })
  } catch (err) {
    console.error(`WhatsApp send error (${provider})`, err)
    return NextResponse.json({ success: true, sent: false, provider })
  }
}
