import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WAVE_GQL = 'https://gql.waveapps.com/graphql/public'

async function getWaveCredentials(): Promise<{ token: string; businessId: string } | null> {
  // Try app_settings first
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (serviceKey && supabaseUrl) {
    const supabase = createClient(supabaseUrl, serviceKey)
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
  }
  // Fall back to env vars
  const token = process.env.WAVE_ACCESS_TOKEN || ''
  const businessId = process.env.WAVE_BUSINESS_ID || ''
  if (!token || !businessId) return null
  return { token, businessId }
}

export async function GET() {
  const creds = await getWaveCredentials()
  if (!creds) {
    return NextResponse.json({ ok: false, error: 'Wave not configured' }, { status: 200 })
  }

  const query = `
    query { businesses { edges { node { id name } } } }
  `
  try {
    const res = await fetch(WAVE_GQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.token}`,
      },
      body: JSON.stringify({ query }),
    })
    const json = await res.json()
    if (json.errors?.length) {
      return NextResponse.json({ ok: false, error: json.errors[0].message }, { status: 200 })
    }
    const businesses = json.data?.businesses?.edges?.map((e: { node: { id: string; name: string } }) => e.node) ?? []
    return NextResponse.json({ ok: true, businesses })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 })
  }
}
