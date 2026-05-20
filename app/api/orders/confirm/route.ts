// FLUTTER: lib/services/orders_service.dart → confirmOrder()
// Method: POST  Auth: access_token in body
// Body:   { order_id: string, access_token: string }
// Returns: { success: boolean, error?: string }

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server misconfigured — SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  const body = await req.json()
  const { order_id, access_token } = body

  if (!order_id || !access_token) {
    return NextResponse.json({ error: 'Missing order_id or access_token' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(access_token)
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = userData.user.id

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, status')
    .eq('id', order_id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (order.status !== 'calculated') {
    return NextResponse.json({ error: 'Order already confirmed' }, { status: 400 })
  }

  // Second status check in WHERE prevents races
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'confirmed' })
    .eq('id', order_id)
    .eq('status', 'calculated')

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
