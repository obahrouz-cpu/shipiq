import type { Session } from '@supabase/supabase-js'
import { createClient } from './supabase'
import type { Order, OrderForm, Profile, Transaction } from './types'

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

export async function createOrder(
  userId: string,
  form: OrderForm,
  photo: File | null
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
    photo_url: photoUrl,
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

export async function confirmOrder(order: Order): Promise<void> {
  const supabase = createClient()
  await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id)
  if (order.shipping_price) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('balance, id')
      .eq('id', order.user_id)
      .single()
    if (profile) {
      await supabase
        .from('profiles')
        .update({ balance: profile.balance - order.shipping_price })
        .eq('id', profile.id)
      await supabase.from('transactions').insert({
        user_id: order.user_id,
        amount: -order.shipping_price,
        currency: order.shipping_currency,
        note: `Shipping confirmed for ${order.id}`,
        order_id: order.id,
      })
    }
  }
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
