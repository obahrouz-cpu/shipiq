import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SITE_URL = 'https://shipiq1.vercel.app'

const VALID_EVENTS = [
  'order_received', 'price_calculated', 'order_confirmed', 'item_ordered',
  'at_warehouse', 'in_transit', 'arrived_city', 'out_for_delivery',
  'delivered', 'rejected', 'balance_added',
] as const
type WhatsappEvent = typeof VALID_EVENTS[number]

interface NotifyBody {
  orderId?: string
  userId?: string
  event: WhatsappEvent
  amount?: number | string
  balance?: number | string
  reason?: string
  city?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_settings').select('key, value')
  if (!data) return {}
  return Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
}

function fmt(v: number | string | undefined): string {
  if (v === undefined || v === null || v === '') return ''
  const n = typeof v === 'number' ? v : parseFloat(v)
  if (!isNaN(n)) return n.toLocaleString()
  return String(v)
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  let out = tpl
  for (const [k, val] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, val)
  }
  return out
}

async function dispatch(origin: string, phone: string, message: string, orderId: string) {
  // Fire the send route — it never throws / never fails loudly.
  await fetch(`${origin}/api/whatsapp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message, orderId }),
  }).catch(err => console.error('WhatsApp notify dispatch error', err))
}

export async function POST(req: NextRequest) {
  let body: NotifyBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: true, skipped: true })
  }

  const { event } = body
  if (!event || !VALID_EVENTS.includes(event)) {
    return NextResponse.json({ success: true, skipped: true, reason: 'invalid event' })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    console.log('WhatsApp notify: Supabase not configured — skipping')
    return NextResponse.json({ success: true, skipped: true })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const settings = await loadSettings(supabase)

    // Customer-facing notifications can be toggled off per event (default ON).
    const customerEnabled = settings[`notify_${event}`] !== 'false'

    // Resolve the order + customer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let order: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let customer: any = null

    if (body.orderId) {
      const { data } = await supabase
        .from('orders')
        .select('*, profiles(full_name, phone)')
        .eq('id', body.orderId)
        .single()
      order = data
      customer = data?.profiles ?? null
    }

    if (!customer && body.userId) {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', body.userId)
        .single()
      customer = data
    }

    const vars: Record<string, string> = {
      orderId: body.orderId ?? order?.id ?? '',
      customerName: customer?.full_name ?? '',
      amount: fmt(body.amount),
      balance: fmt(body.balance ?? order?.balance),
      reason: body.reason ?? order?.reject_reason ?? '',
      city: body.city ?? order?.delivery_city ?? '',
    }

    const origin = req.nextUrl.origin

    // ── Customer notification ──
    if (customerEnabled && customer?.phone) {
      const template = settings[`msg_${event}`]
      if (template && template.trim()) {
        let message = fillTemplate(template, vars)
        if (event === 'price_calculated' && vars.orderId) {
          message += `\n\nConfirm your order here: ${SITE_URL}/confirm/${vars.orderId}`
        }
        await dispatch(origin, customer.phone, message, vars.orderId)
      }
    }

    // ── Admin notifications ──
    const adminPhone = settings.admin_whatsapp
    if (adminPhone) {
      let adminMessage = ''
      if (event === 'order_received' && settings.notif_new_order !== 'false') {
        adminMessage = `🆕 New order ${vars.orderId} from ${vars.customerName || 'a customer'}.`
      } else if (event === 'order_confirmed' && settings.notif_confirmed !== 'false') {
        adminMessage = `✅ Order ${vars.orderId} confirmed by ${vars.customerName || 'the customer'}.`
      }
      if (adminMessage) {
        await dispatch(origin, adminPhone, adminMessage, vars.orderId)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('WhatsApp notify error', err)
    // Silent-fail: order operations must never break.
    return NextResponse.json({ success: true, sent: false })
  }
}
