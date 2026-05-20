// FLUTTER: lib/services/admin_service.dart → createAgent()
// Method: POST  Auth: access_token in body (must be admin role)
// Body:   { access_token: string, name: string, email: string, password: string, phone?: string, country: string }
// Returns: { success: boolean, error?: string }

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' },
      { status: 500 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, email, password, phone, country, access_token } = body as Record<string, string>

  // Verify caller is an admin
  if (!access_token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(access_token)
  if (callerErr || !callerData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 })
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, phone: phone || '' },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Failed to create user' }, { status: 400 })
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: authData.user.id,
    full_name: name,
    email,
    phone: phone || null,
    role: 'agent',
    assigned_country: country,
    balance: 0,
    tier: 'bronze',
  })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
