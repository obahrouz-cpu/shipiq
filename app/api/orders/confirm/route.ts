import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'vip']

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

  // Verify the caller's identity via their JWT
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(access_token)
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = userData.user.id

  // Fetch fresh order state
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, status, shipping_price, shipping_currency')
    .eq('id', order_id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Verify ownership
  if (order.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Idempotency guard — must be exactly 'calculated'
  if (order.status !== 'calculated') {
    return NextResponse.json({ error: 'Order already confirmed' }, { status: 400 })
  }

  // Fetch customer profile for balance check
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('balance, tier, total_spent')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // BUG 3 — insufficient balance check
  if (order.shipping_price && profile.balance < order.shipping_price) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
  }

  // Update order status — second status check in the WHERE clause prevents races
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'confirmed' })
    .eq('id', order_id)
    .eq('status', 'calculated')

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Deduct balance and insert transaction
  if (order.shipping_price) {
    await supabaseAdmin
      .from('profiles')
      .update({ balance: profile.balance - order.shipping_price })
      .eq('id', userId)

    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      amount: -order.shipping_price,
      currency: order.shipping_currency,
      note: `Shipping confirmed for ${order_id}`,
      order_id,
    })

    // Update total_spent and recalculate tier
    const spendUSD = order.shipping_currency === 'USD'
      ? order.shipping_price
      : order.shipping_price / 1450
    const newTotalSpent = ((profile.total_spent as number | null) || 0) + spendUSD

    const { data: tierRows } = await supabaseAdmin
      .from('tier_settings')
      .select('tier, name_en, min_spend')
      .eq('is_active', true)
      .order('min_spend', { ascending: false })

    let newTier = 'bronze'
    for (const t of (tierRows || []) as { tier: string; name_en: string; min_spend: number }[]) {
      if (newTotalSpent >= t.min_spend) { newTier = t.tier; break }
    }

    await supabaseAdmin
      .from('profiles')
      .update({ total_spent: newTotalSpent, tier: newTier })
      .eq('id', userId)

    // Tier upgrade notification
    const oldTier = (profile.tier as string | null) || 'bronze'
    if (TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(oldTier)) {
      const tierInfo = (tierRows || [] as { tier: string; name_en: string; min_spend: number }[]).find(
        (t: { tier: string; name_en: string; min_spend: number }) => t.tier === newTier
      )
      await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        amount: 0,
        currency: 'IQD',
        note: `🎉 Congratulations! You've been upgraded to ${tierInfo?.name_en || newTier} tier!`,
        order_id,
      })
    }
  }

  return NextResponse.json({ success: true })
}
