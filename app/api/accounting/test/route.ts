import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WAVE_GQL = 'https://gql.waveapps.com/graphql/public'
const ZOHO_BASE = 'https://books.zoho.com/api/v3'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_settings').select('key, value')
  if (!data) return {}
  return Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
}

async function testWave(settings: Record<string, string>): Promise<{ ok: boolean; msg: string }> {
  const token = settings.wave_access_token || process.env.WAVE_ACCESS_TOKEN || ''
  const businessId = settings.wave_business_id || process.env.WAVE_BUSINESS_ID || ''
  if (!token || !businessId) return { ok: false, msg: 'Wave access token and business ID required' }

  const res = await fetch(WAVE_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: '{ businesses { edges { node { id name } } } }' }),
  })
  const json = await res.json()
  if (json.errors?.length) return { ok: false, msg: json.errors[0].message }
  const names = (json.data?.businesses?.edges ?? [])
    .map((e: { node: { name: string } }) => e.node.name)
    .join(', ')
  return { ok: true, msg: `Connected · ${names || 'no businesses found'}` }
}

async function testZoho(settings: Record<string, string>): Promise<{ ok: boolean; msg: string }> {
  const token = settings.zoho_access_token || process.env.ZOHO_ACCESS_TOKEN || ''
  const orgId  = settings.zoho_org_id      || process.env.ZOHO_ORG_ID      || ''
  if (!token) return { ok: false, msg: 'Zoho access token required' }

  const url = `${ZOHO_BASE}/organizations${orgId ? `?organization_id=${orgId}` : ''}`
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
  })
  const json = await res.json()
  if (json.code !== 0 && res.status !== 200) {
    return { ok: false, msg: json.message ?? `HTTP ${res.status}` }
  }
  const orgs: { name: string }[] = json.organizations ?? []
  const names = orgs.map(o => o.name).join(', ')
  return { ok: true, msg: `Connected · ${names || 'no organizations found'}` }
}

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') ?? 'wave'

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ ok: false, msg: 'Server misconfigured' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const settings = await loadSettings(supabase)

  try {
    const result = provider === 'zoho' ? await testZoho(settings) : await testWave(settings)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ ok: false, msg: String(err) })
  }
}
