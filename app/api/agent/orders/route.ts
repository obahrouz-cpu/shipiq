// FLUTTER: lib/services/agent_service.dart → getAgentOrders()
// Method: POST  Auth: access_token in body
// Body:   { access_token: string }
// Returns: { orders: Order[], country: string, error?: string }

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server misconfigured — SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  const { access_token } = await req.json()
  if (!access_token) {
    return NextResponse.json({ error: 'Missing access_token' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify the caller's JWT
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(access_token)
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch agent profile — verify role and get assigned_country
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, assigned_country')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (profile.role !== 'agent') {
    return NextResponse.json({ error: 'Forbidden — not an agent' }, { status: 403 })
  }

  if (!profile.assigned_country) {
    return NextResponse.json({ error: 'Agent has no assigned country' }, { status: 400 })
  }

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('*, profiles(full_name, email)')
    .eq('country_origin', profile.assigned_country)
    .in('status', ['confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'delivered'])
    .order('created_at', { ascending: false })

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  return NextResponse.json({ orders: orders || [], country: profile.assigned_country })
}
