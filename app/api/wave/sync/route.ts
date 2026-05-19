import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WAVE_GQL = 'https://gql.waveapps.com/graphql/public'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waveQuery(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(WAVE_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  })
  return res.json()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getWaveCredentials(supabase: any): Promise<{ token: string; businessId: string } | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['wave_access_token', 'wave_business_id', 'wave_enabled'])
  if (data) {
    const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
    if (map.wave_enabled === 'false') return null
    const token = map.wave_access_token || process.env.WAVE_ACCESS_TOKEN || ''
    const businessId = map.wave_business_id || process.env.WAVE_BUSINESS_ID || ''
    if (token && businessId) return { token, businessId }
  }
  const token = process.env.WAVE_ACCESS_TOKEN || ''
  const businessId = process.env.WAVE_BUSINESS_ID || ''
  if (!token || !businessId) return null
  return { token, businessId }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getIqdRate(supabase: any): Promise<number> {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['iqd_rate_manual'])
  if (data) {
    const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
    const rate = parseFloat(map.iqd_rate_manual)
    if (!isNaN(rate) && rate > 0) return rate
  }
  return 1540
}

// ── Find or create Wave customer ──────────────────────────────────────────────

async function findOrCreateCustomer(token: string, businessId: string, name: string, email: string): Promise<string> {
  // Search by email
  const searchQ = `
    query($businessId: ID!, $email: String) {
      business(id: $businessId) {
        customers(filters: { email: $email }) {
          edges { node { id } }
        }
      }
    }
  `
  const searchRes = await waveQuery(token, searchQ, { businessId, email })
  const edges = searchRes.data?.business?.customers?.edges ?? []
  if (edges.length > 0) return edges[0].node.id

  // Create customer
  const createQ = `
    mutation($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer { id }
        didSucceed
        inputErrors { message }
      }
    }
  `
  const createRes = await waveQuery(token, createQ, {
    input: { businessId, name, email },
  })
  if (!createRes.data?.customerCreate?.didSucceed) {
    throw new Error(createRes.data?.customerCreate?.inputErrors?.[0]?.message ?? 'Failed to create customer')
  }
  return createRes.data.customerCreate.customer.id
}

// ── Create invoice and record payment ────────────────────────────────────────

async function createInvoiceAndMarkPaid(
  token: string,
  businessId: string,
  customerId: string,
  description: string,
  lineItems: { label: string; unitPrice: number }[],
  totalUsd: number,
  invoiceDate: string,
): Promise<string> {
  const createInvQ = `
    mutation($input: InvoiceCreateInput!) {
      invoiceCreate(input: $input) {
        invoice { id invoiceNumber }
        didSucceed
        inputErrors { message }
      }
    }
  `
  const items = lineItems.map(li => ({
    product: { name: li.label },
    quantity: 1,
    unitPrice: li.unitPrice,
  }))

  const createRes = await waveQuery(token, createInvQ, {
    input: {
      businessId,
      customerId,
      status: 'DRAFT',
      invoiceDate,
      memo: description,
      currency: 'USD',
      items,
    },
  })
  if (!createRes.data?.invoiceCreate?.didSucceed) {
    throw new Error(createRes.data?.invoiceCreate?.inputErrors?.[0]?.message ?? 'Failed to create invoice')
  }
  const invoiceId = createRes.data.invoiceCreate.invoice.id

  // Send invoice (required before marking paid)
  const sendQ = `
    mutation($input: InvoiceSendInput!) {
      invoiceSend(input: $input) { didSucceed inputErrors { message } }
    }
  `
  await waveQuery(token, sendQ, { input: { invoiceId, sendMethod: 'MARK_SENT' } })

  // Mark as paid
  const payQ = `
    mutation($input: MoneyTransactionCreateInput!) {
      moneyTransactionCreate(input: $input) { didSucceed inputErrors { message } }
    }
  `
  const payRes = await waveQuery(token, payQ, {
    input: {
      businessId,
      externalId: invoiceId,
      date: invoiceDate,
      description: `Payment: ${description}`,
      anchor: {
        direction: 'CREDIT',
        amount: totalUsd,
        accountType: 'INCOME',
      },
      lineItems: [
        {
          accountType: 'ASSET',
          amount: totalUsd,
          balance: 'DEBIT',
          description: 'Payment received',
        },
      ],
    },
  })

  if (!payRes.data?.moneyTransactionCreate?.didSucceed) {
    // Payment recording failed but invoice exists — still return invoice ID
    console.warn('Wave payment recording failed:', payRes.data?.moneyTransactionCreate?.inputErrors)
  }

  return invoiceId
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  let body: {
    order_id: string
    customer_name: string
    customer_email: string
    description: string
    shipping_iqd: number
    service_fee_iqd: number
    customs_fee_iqd: number
    delivery_fee_iqd: number
    total_iqd: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const creds = await getWaveCredentials(supabase)
  if (!creds) {
    console.log('Wave not configured — skipping sync')
    return NextResponse.json({ ok: false, error: 'Wave not configured' }, { status: 200 })
  }

  const rate = await getIqdRate(supabase)
  const toUsd = (iqd: number) => Math.round((iqd / rate) * 100) / 100

  const lineItems: { label: string; unitPrice: number }[] = []
  if (body.shipping_iqd > 0)     lineItems.push({ label: 'Shipping Fee',      unitPrice: toUsd(body.shipping_iqd) })
  if (body.service_fee_iqd > 0)  lineItems.push({ label: 'Service Fee',       unitPrice: toUsd(body.service_fee_iqd) })
  if (body.customs_fee_iqd > 0)  lineItems.push({ label: 'Customs / Tax',     unitPrice: toUsd(body.customs_fee_iqd) })
  if (body.delivery_fee_iqd > 0) lineItems.push({ label: 'Iraq Delivery Fee', unitPrice: toUsd(body.delivery_fee_iqd) })

  if (lineItems.length === 0) {
    return NextResponse.json({ ok: false, error: 'No line items to invoice' }, { status: 400 })
  }

  const totalUsd = toUsd(body.total_iqd)
  const invoiceDate = new Date().toISOString().split('T')[0]

  try {
    const customerId = await findOrCreateCustomer(
      creds.token, creds.businessId,
      body.customer_name, body.customer_email,
    )
    const invoiceId = await createInvoiceAndMarkPaid(
      creds.token, creds.businessId,
      customerId, body.description,
      lineItems, totalUsd, invoiceDate,
    )

    const now = new Date().toISOString()
    await supabase.from('orders').update({
      wave_invoice_id: invoiceId,
      wave_synced_at: now,
      wave_sync_status: 'synced',
    }).eq('id', body.order_id)

    return NextResponse.json({ ok: true, invoiceId })
  } catch (err) {
    console.error('Wave sync error:', err)
    await supabase.from('orders').update({
      wave_sync_status: 'failed',
    }).eq('id', body.order_id)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 })
  }
}
