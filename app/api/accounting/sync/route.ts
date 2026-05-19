import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WAVE_GQL = 'https://gql.waveapps.com/graphql/public'
const ZOHO_BASE = 'https://books.zoho.com/api/v3'

// ── Shared types ──────────────────────────────────────────────────────────────

interface SyncBody {
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

interface LineItem { label: string; unitPrice: number }

// ── Settings helpers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_settings').select('key, value')
  if (!data) return {}
  return Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
}

async function getIqdRate(settings: Record<string, string>): Promise<number> {
  const rate = parseFloat(settings.iqd_rate_manual)
  return !isNaN(rate) && rate > 0 ? rate : 1540
}

// ── Wave sync ─────────────────────────────────────────────────────────────────

async function waveQuery(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(WAVE_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  })
  return res.json()
}

async function waveFindOrCreateCustomer(token: string, businessId: string, name: string, email: string): Promise<string> {
  const searchRes = await waveQuery(token, `
    query($businessId: ID!, $email: String) {
      business(id: $businessId) {
        customers(filters: { email: $email }) { edges { node { id } } }
      }
    }
  `, { businessId, email })
  const edges = searchRes.data?.business?.customers?.edges ?? []
  if (edges.length > 0) return edges[0].node.id

  const createRes = await waveQuery(token, `
    mutation($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer { id } didSucceed inputErrors { message }
      }
    }
  `, { input: { businessId, name, email } })
  if (!createRes.data?.customerCreate?.didSucceed) {
    throw new Error(createRes.data?.customerCreate?.inputErrors?.[0]?.message ?? 'Wave: failed to create customer')
  }
  return createRes.data.customerCreate.customer.id
}

async function waveSyncOrder(settings: Record<string, string>, body: SyncBody, lineItems: LineItem[], totalUsd: number): Promise<string> {
  const token = settings.wave_access_token || process.env.WAVE_ACCESS_TOKEN || ''
  const businessId = settings.wave_business_id || process.env.WAVE_BUSINESS_ID || ''
  if (!token || !businessId) throw new Error('Wave credentials not configured')

  const customerId = await waveFindOrCreateCustomer(token, businessId, body.customer_name, body.customer_email)
  const invoiceDate = new Date().toISOString().split('T')[0]

  const createRes = await waveQuery(token, `
    mutation($input: InvoiceCreateInput!) {
      invoiceCreate(input: $input) {
        invoice { id } didSucceed inputErrors { message }
      }
    }
  `, {
    input: {
      businessId, customerId,
      status: 'DRAFT',
      invoiceDate,
      memo: body.description,
      currency: 'USD',
      items: lineItems.map(li => ({ product: { name: li.label }, quantity: 1, unitPrice: li.unitPrice })),
    },
  })
  if (!createRes.data?.invoiceCreate?.didSucceed) {
    throw new Error(createRes.data?.invoiceCreate?.inputErrors?.[0]?.message ?? 'Wave: failed to create invoice')
  }
  const invoiceId = createRes.data.invoiceCreate.invoice.id

  // Mark sent
  await waveQuery(token, `
    mutation($input: InvoiceSendInput!) {
      invoiceSend(input: $input) { didSucceed }
    }
  `, { input: { invoiceId, sendMethod: 'MARK_SENT' } })

  // Record payment
  const payRes = await waveQuery(token, `
    mutation($input: MoneyTransactionCreateInput!) {
      moneyTransactionCreate(input: $input) { didSucceed inputErrors { message } }
    }
  `, {
    input: {
      businessId, externalId: invoiceId, date: invoiceDate,
      description: `Payment: ${body.description}`,
      anchor: { direction: 'CREDIT', amount: totalUsd, accountType: 'INCOME' },
      lineItems: [{ accountType: 'ASSET', amount: totalUsd, balance: 'DEBIT', description: 'Payment received' }],
    },
  })
  if (!payRes.data?.moneyTransactionCreate?.didSucceed) {
    console.warn('Wave: payment recording failed', payRes.data?.moneyTransactionCreate?.inputErrors)
  }
  return invoiceId
}

// ── Zoho sync ─────────────────────────────────────────────────────────────────

async function zohoGet(token: string, orgId: string, path: string) {
  const url = `${ZOHO_BASE}${path}${path.includes('?') ? '&' : '?'}organization_id=${orgId}`
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
  })
  return res.json()
}

async function zohoPost(token: string, orgId: string, path: string, body: unknown) {
  const url = `${ZOHO_BASE}${path}${path.includes('?') ? '&' : '?'}organization_id=${orgId}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function zohoFindOrCreateCustomer(token: string, orgId: string, name: string): Promise<string> {
  const searchRes = await zohoGet(token, orgId, `/contacts?contact_name=${encodeURIComponent(name)}&contact_type=customer`)
  const contacts: { contact_id: string }[] = searchRes.contacts ?? []
  if (contacts.length > 0) return contacts[0].contact_id

  const createRes = await zohoPost(token, orgId, '/contacts', {
    contact_name: name,
    contact_type: 'customer',
  })
  if (!createRes.contact?.contact_id) {
    throw new Error(createRes.message ?? 'Zoho: failed to create contact')
  }
  return createRes.contact.contact_id
}

async function zohoSyncOrder(settings: Record<string, string>, body: SyncBody, lineItems: LineItem[], totalUsd: number): Promise<string> {
  const token = settings.zoho_access_token || process.env.ZOHO_ACCESS_TOKEN || ''
  const orgId  = settings.zoho_org_id      || process.env.ZOHO_ORG_ID      || ''
  if (!token || !orgId) throw new Error('Zoho credentials not configured')

  const customerId = await zohoFindOrCreateCustomer(token, orgId, body.customer_name)
  const today = new Date().toISOString().split('T')[0]

  const createRes = await zohoPost(token, orgId, '/invoices', {
    customer_id: customerId,
    reference_number: body.order_id,
    date: today,
    line_items: lineItems.map(li => ({
      description: li.label,
      rate: li.unitPrice,
      quantity: 1,
    })),
  })
  if (!createRes.invoice?.invoice_id) {
    throw new Error(createRes.message ?? 'Zoho: failed to create invoice')
  }
  const invoiceId: string = createRes.invoice.invoice_id

  // Record payment
  const payRes = await zohoPost(token, orgId, `/invoices/${invoiceId}/payments`, {
    amount: totalUsd,
    date: today,
    payment_mode: 'cash',
  })
  if (payRes.code !== 0 && payRes.code !== undefined) {
    console.warn('Zoho: payment recording failed', payRes.message)
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

  let body: SyncBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const settings = await loadSettings(supabase)
  const provider = settings.accounting_provider || 'none'

  if (provider === 'none' || !provider) {
    console.log('Accounting sync skipped — no provider configured')
    return NextResponse.json({ ok: true, skipped: true })
  }

  const rate = await getIqdRate(settings)
  const toUsd = (iqd: number) => Math.round((iqd / rate) * 100) / 100

  const lineItems: LineItem[] = []
  if (body.shipping_iqd > 0)     lineItems.push({ label: 'Shipping Fee',      unitPrice: toUsd(body.shipping_iqd) })
  if (body.service_fee_iqd > 0)  lineItems.push({ label: 'Service Fee',       unitPrice: toUsd(body.service_fee_iqd) })
  if (body.customs_fee_iqd > 0)  lineItems.push({ label: 'Customs / Tax',     unitPrice: toUsd(body.customs_fee_iqd) })
  if (body.delivery_fee_iqd > 0) lineItems.push({ label: 'Iraq Delivery Fee', unitPrice: toUsd(body.delivery_fee_iqd) })

  if (lineItems.length === 0) {
    return NextResponse.json({ ok: false, error: 'No line items to invoice' }, { status: 400 })
  }

  const totalUsd = toUsd(body.total_iqd)
  const now = new Date().toISOString()

  try {
    let invoiceId: string
    if (provider === 'wave') {
      invoiceId = await waveSyncOrder(settings, body, lineItems, totalUsd)
    } else if (provider === 'zoho') {
      invoiceId = await zohoSyncOrder(settings, body, lineItems, totalUsd)
    } else {
      return NextResponse.json({ ok: false, error: `Unknown provider: ${provider}` }, { status: 400 })
    }

    await supabase.from('orders').update({
      wave_invoice_id: invoiceId,
      wave_synced_at: now,
      wave_sync_status: 'synced',
    }).eq('id', body.order_id)

    return NextResponse.json({ ok: true, invoiceId, provider })
  } catch (err) {
    console.error(`${provider} sync error:`, err)
    await supabase.from('orders').update({ wave_sync_status: 'failed' }).eq('id', body.order_id)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 })
  }
}
