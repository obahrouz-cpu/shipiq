import type { Session } from '@supabase/supabase-js'
import { createClient } from './supabase'
import type { Order, OrderForm, Profile, Transaction, TierSettings } from './types'

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function getSession(): Promise<Session | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function googleSignIn(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://shipiq1.vercel.app/dashboard' },
  })
}

export async function emailSignIn(
  email: string,
  password: string
): Promise<{ session: Session | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { session: data.session, error: error?.message ?? null }
}

export async function emailSignUp(
  email: string,
  password: string,
  name: string,
  phone: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, phone } },
  })
  return { error: error?.message ?? null }
}

export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient()
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export async function getCustomers(): Promise<Profile[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
  return data || []
}

export async function topUpBalance(
  userId: string,
  currentBalance: number,
  amount: number,
  currency: string,
  note = 'Balance top-up by admin'
): Promise<void> {
  const supabase = createClient()
  await supabase.from('profiles').update({ balance: currentBalance + amount }).eq('id', userId)
  await supabase.from('transactions').insert({ user_id: userId, amount, currency, note })
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function getAdminOrders(): Promise<Order[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('orders')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false })
  return data || []
}

export async function getUserOrders(userId: string): Promise<Order[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data || []
}

function detectCountryFromUrl(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('amazon.ae')) return 'UAE'
  if (['amazon.', 'ebay.', 'bestbuy.', 'newegg.', 'bhphotovideo.', 'walmart.', 'target.'].some(d => u.includes(d))) return 'USA'
  if (['trendyol.', 'hepsiburada.', 'n11.', 'lcwaikiki.'].some(d => u.includes(d))) return 'Turkey'
  if (['noon.', 'namshi.', 'boutiqaat.', 'ounass.', 'sivvi.'].some(d => u.includes(d))) return 'UAE'
  if (['aliexpress.', 'shein.', 'banggood.', 'dhgate.', 'alibaba.', 'taobao.', '1688.'].some(d => u.includes(d))) return 'China'
  return ''
}

export async function createOrder(
  userId: string,
  form: OrderForm,
  photo: File | null,
  autoImageUrl?: string | null
): Promise<{ error: string | null }> {
  const supabase = createClient()
  let photoUrl: string | null = null

  if (photo) {
    const ext = photo.name.split('.').pop()
    const fileName = `${userId}/${Date.now()}.${ext}`
    const { data, error: uploadError } = await supabase.storage
      .from('order-photos')
      .upload(fileName, photo)
    if (!uploadError && data) {
      const { data: urlData } = supabase.storage.from('order-photos').getPublicUrl(fileName)
      photoUrl = urlData.publicUrl
    }
  }

  const { error } = await supabase.from('orders').insert({
    user_id: userId,
    url: form.url,
    description: form.description,
    category: form.category,
    qty: form.qty,
    item_price: form.itemPrice ? parseFloat(form.itemPrice) : null,
    item_price_currency: form.itemPriceCurrency,
    note: form.note,
    urgency: form.urgency,
    photo_url: photoUrl ?? autoImageUrl ?? null,
    country_origin: detectCountryFromUrl(form.url),
    delivery_preference: form.deliveryPreference || 'pickup',
    delivery_city: form.deliveryCity || null,
    status: 'pending',
  })

  return { error: error?.message ?? null }
}

export async function updateOrder(
  orderId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const supabase = createClient()
  await supabase.from('orders').update(updates).eq('id', orderId)
}

export async function confirmOrder(order: Order): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { data: fresh } = await supabase
    .from('orders')
    .select('status')
    .eq('id', order.id)
    .single()
  if (!fresh || fresh.status !== 'calculated') {
    return { error: null }
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'confirmed' })
    .eq('id', order.id)
  if (updateError) return { error: updateError.message }

  return { error: null }
}

export async function deductBalance(
  userId: string,
  currentBalance: number,
  amount: number,
  currency: string,
  note: string,
  orderId?: string
): Promise<{ error: string | null }> {
  if (amount > currentBalance) {
    return { error: 'Amount exceeds current balance' }
  }
  const supabase = createClient()
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ balance: currentBalance - amount })
    .eq('id', userId)
  if (profileError) return { error: profileError.message }

  const { error: txnError } = await supabase.from('transactions').insert({
    user_id: userId,
    amount: -amount,
    currency,
    note,
    order_id: orderId,
  })
  if (txnError) return { error: txnError.message }

  return { error: null }
}

export async function updateLanguage(userId: string, language: 'en' | 'ar'): Promise<void> {
  const supabase = createClient()
  await supabase.from('profiles').update({ language }).eq('id', userId)
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function getUserTransactions(userId: string): Promise<Transaction[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data || []
}

// ── Tier settings ──────────────────────────────────────────────────────────────

export async function getTierSettings(): Promise<TierSettings[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('tier_settings')
    .select('*')
    .order('min_spend', { ascending: true })
  return (data as TierSettings[]) || []
}

export async function updateTierSettings(settings: TierSettings[]): Promise<void> {
  const supabase = createClient()
  for (const s of settings) {
    await supabase.from('tier_settings').upsert(s, { onConflict: 'tier' })
  }
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export async function getAgentOrders(country: string): Promise<Order[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('orders')
    .select('*, profiles(full_name, email)')
    .eq('country_origin', country)
    .in('status', ['confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'delivered'])
    .order('created_at', { ascending: false })
  return data || []
}

export async function agentMarkOrdered(
  orderId: string,
  receiptFile: File,
  agentId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const ext = receiptFile.name.split('.').pop() || 'jpg'
  const fileName = `receipts/${agentId}/${orderId}-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('agent-uploads')
    .upload(fileName, receiptFile)
  if (uploadError) return { error: uploadError.message }
  const { data: urlData } = supabase.storage.from('agent-uploads').getPublicUrl(fileName)
  const { error } = await supabase.from('orders').update({
    agent_receipt_url: urlData.publicUrl,
    status: 'ordered',
    ordered_at: new Date().toISOString(),
  }).eq('id', orderId)
  return { error: error?.message ?? null }
}

export async function agentMarkWarehouse(
  orderId: string,
  warehousePhotoFile: File,
  agentId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const ext = warehousePhotoFile.name.split('.').pop() || 'jpg'
  const fileName = `warehouse/${agentId}/${orderId}-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('agent-uploads')
    .upload(fileName, warehousePhotoFile)
  if (uploadError) return { error: uploadError.message }
  const { data: urlData } = supabase.storage.from('agent-uploads').getPublicUrl(fileName)
  const { error } = await supabase.from('orders').update({
    agent_warehouse_photo_url: urlData.publicUrl,
    status: 'warehouse',
    warehoused_at: new Date().toISOString(),
  }).eq('id', orderId)
  return { error: error?.message ?? null }
}

export async function getAgents(): Promise<Profile[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'agent')
    .order('created_at', { ascending: false })
  return data || []
}
