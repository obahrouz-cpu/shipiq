// FLUTTER: lib/services/broadcast_service.dart → sendBroadcast()
// Method: POST  Auth: access_token in body  Admin only
// Body:   { title, body, type, access_token }
// Returns: { success, recipientCount }

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const NOTIF_TYPE: Record<string, string> = {
  announcement: 'info',
  promotion:    'success',
  alert:        'warning',
  info:         'info',
}

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  let body: { title?: string; body?: string; type?: string; access_token?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, body: msgBody, type = 'info', access_token } = body
  if (!title || !msgBody || !access_token) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify sender
  const { data: userData, error: userError } = await supabase.auth.getUser(access_token)
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single()

  if (!adminProfile || adminProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  // Fetch all customer IDs
  const { data: customers, error: customersErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'customer')

  if (customersErr) {
    return NextResponse.json({ error: customersErr.message }, { status: 500 })
  }

  const recipientCount = customers?.length ?? 0

  if (recipientCount > 0) {
    const notifType = NOTIF_TYPE[type] ?? 'info'
    const notifications = customers!.map(c => ({
      user_id: c.id,
      title,
      message: msgBody,
      type: notifType,
    }))

    // Chunk inserts to avoid payload limits
    const CHUNK = 500
    for (let i = 0; i < notifications.length; i += CHUNK) {
      const { error: insertErr } = await supabase
        .from('notifications')
        .insert(notifications.slice(i, i + CHUNK))
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
    }
  }

  // Record the broadcast
  await supabase.from('broadcast_messages').insert({
    title,
    body: msgBody,
    type,
    sent_by: adminProfile.id,
    recipient_count: recipientCount,
  })

  return NextResponse.json({ success: true, recipientCount })
}
