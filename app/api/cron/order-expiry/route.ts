// Order auto-expiry + batched push notifications. Vercel Cron, hourly.
//
// Runs (in order): (a) auto-void calculated orders past the window, (b) one
// urgent push per customer per entry into the urgent window, (c) one daily
// digest per customer at the digest hour (Asia/Baghdad).
//
// Node.js runtime — sendPush() pulls in firebase-admin, which is not
// Edge-compatible. Protected by CRON_SECRET: Vercel Cron automatically sends
// `Authorization: Bearer <CRON_SECRET>` when that env var is set.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPush } from '@/lib/sendPush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HOUR_MS = 60 * 60 * 1000;

// ── Config (admin-editable via app_settings, with safe defaults) ─────────────
const DEFAULTS = {
  windowHours: 48,
  digestHour: 10, // 10:00 Asia/Baghdad
  urgentHours: 4,
};

function serviceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Supa = ReturnType<typeof serviceClient>;

// Current wall-clock hour + calendar date in Asia/Baghdad (UTC+3, no DST).
function baghdadParts(now: Date): { hour: number; date: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  // 'en-CA' gives YYYY-MM-DD; hour can come back as '24' at midnight — normalize.
  const hour = parseInt(parts.hour, 10) % 24;
  return { hour, date: `${parts.year}-${parts.month}-${parts.day}` };
}

async function loadConfig(supabase: Supa) {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['expiry_window_hours', 'expiry_digest_hour', 'expiry_urgent_hours']);
  const map = new Map((data ?? []).map((r) => [r.key, r.value] as const));
  const num = (k: string, def: number) => {
    const v = Number(map.get(k));
    return Number.isFinite(v) && v > 0 ? v : def;
  };
  return {
    windowHours: num('expiry_window_hours', DEFAULTS.windowHours),
    digestHour: Math.max(0, Math.min(23, num('expiry_digest_hour', DEFAULTS.digestHour))),
    urgentHours: num('expiry_urgent_hours', DEFAULTS.urgentHours),
  };
}

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = serviceClient();
  const cfg = await loadConfig(supabase);
  const now = new Date();
  const nowMs = now.getTime();
  const windowMs = cfg.windowHours * HOUR_MS;
  const urgentMs = cfg.urgentHours * HOUR_MS;

  const summary = {
    config: cfg,
    voided: 0,
    urgentSent: 0,
    digestSent: 0,
    errors: [] as string[],
  };

  // ── (a) AUTO-VOID ───────────────────────────────────────────────────────────
  // calculated orders whose clock has run out: now - calculated_at >= window.
  // Per-order, independent clocks. No notification on void.
  const voidCutoff = new Date(nowMs - windowMs).toISOString();
  const { data: voided, error: voidErr } = await supabase
    .from('orders')
    .update({ status: 'expired' })
    .eq('status', 'calculated')
    .not('calculated_at', 'is', null)
    .lte('calculated_at', voidCutoff)
    .select('id');
  if (voidErr) summary.errors.push(`void: ${voidErr.message}`);
  summary.voided = voided?.length ?? 0;

  // ── Remaining in-window calculated orders ─────────────────────────────────
  // After voiding, every calculated order with a calculated_at is in-window.
  const { data: pending, error: pendErr } = await supabase
    .from('orders')
    .select('id, user_id, calculated_at')
    .eq('status', 'calculated')
    .not('calculated_at', 'is', null);
  if (pendErr) {
    summary.errors.push(`fetch: ${pendErr.message}`);
    return NextResponse.json({ ok: false, ...summary }, { status: 500 });
  }

  // Group orders by customer, tracking the urgent-window entry time of each.
  // An order "enters the urgent window" at calculated_at + (window - urgent).
  type PerUser = { count: number; urgentCount: number; latestUrgentEntryMs: number };
  const byUser = new Map<string, PerUser>();
  for (const o of pending ?? []) {
    const calcMs = new Date(o.calculated_at as string).getTime();
    if (!Number.isFinite(calcMs)) continue;
    const urgentEntryMs = calcMs + (windowMs - urgentMs);
    const u = byUser.get(o.user_id) ?? { count: 0, urgentCount: 0, latestUrgentEntryMs: -Infinity };
    u.count += 1;
    if (nowMs >= urgentEntryMs) {
      // Order is currently within `urgentHours` of expiring.
      u.urgentCount += 1;
      if (urgentEntryMs > u.latestUrgentEntryMs) u.latestUrgentEntryMs = urgentEntryMs;
    }
    byUser.set(o.user_id, u);
  }

  const userEntries = Array.from(byUser.entries());
  const userIds = userEntries.map(([id]) => id);
  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, ...summary });
  }

  // Load dedupe markers for exactly the customers with pending orders.
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, last_expiry_digest_at, last_expiry_urgent_at')
    .in('id', userIds);
  if (profErr) {
    summary.errors.push(`profiles: ${profErr.message}`);
    return NextResponse.json({ ok: false, ...summary }, { status: 500 });
  }
  const markerOf = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        digest: p.last_expiry_digest_at ? new Date(p.last_expiry_digest_at).getTime() : 0,
        urgent: p.last_expiry_urgent_at ? new Date(p.last_expiry_urgent_at).getTime() : 0,
      },
    ] as const),
  );

  // ── (b) URGENT PUSH ─────────────────────────────────────────────────────────
  // Fire once per entry into the urgent window. We send only when the customer
  // has at least one urgent order whose urgent-entry time is NEWER than the last
  // urgent push we sent — so the same order never re-fires, but a different order
  // crossing the threshold later does.
  for (const [userId, u] of userEntries) {
    if (u.urgentCount === 0) continue;
    const marker = markerOf.get(userId)?.urgent ?? 0;
    if (u.latestUrgentEntryMs <= marker) continue; // already notified for these.

    const n = u.urgentCount;
    const res = await sendPush(
      userId,
      'Action required',
      `${n} order${n === 1 ? '' : 's'} expiring within ${cfg.urgentHours} hours — confirm now or they'll be cancelled.`,
      { type: 'order_expiry_urgent', count: n },
    );
    if (res.ok) {
      const { error } = await supabase
        .from('profiles')
        .update({ last_expiry_urgent_at: now.toISOString() })
        .eq('id', userId);
      if (error) summary.errors.push(`urgent-marker ${userId}: ${error.message}`);
      summary.urgentSent += 1;
    } else if (res.reason !== 'no-token') {
      summary.errors.push(`urgent-send ${userId}: ${res.reason}`);
    }
  }

  // ── (c) DAILY DIGEST ─────────────────────────────────────────────────────────
  // Hourly cron, so gate the whole block to the digest hour. Then send once per
  // customer per Baghdad calendar day (marker's Baghdad date != today).
  const bag = baghdadParts(now);
  if (bag.hour === cfg.digestHour) {
    for (const [userId, u] of userEntries) {
      if (u.count === 0) continue;
      const marker = markerOf.get(userId)?.digest ?? 0;
      if (marker) {
        const lastDate = baghdadParts(new Date(marker)).date;
        if (lastDate === bag.date) continue; // already digested today.
      }
      const n = u.count;
      const res = await sendPush(
        userId,
        'ShipIQ',
        `You have ${n} order${n === 1 ? '' : 's'} awaiting confirmation — review before they expire.`,
        { type: 'order_expiry_digest', count: n },
      );
      if (res.ok) {
        const { error } = await supabase
          .from('profiles')
          .update({ last_expiry_digest_at: now.toISOString() })
          .eq('id', userId);
        if (error) summary.errors.push(`digest-marker ${userId}: ${error.message}`);
        summary.digestSent += 1;
      } else if (res.reason !== 'no-token') {
        summary.errors.push(`digest-send ${userId}: ${res.reason}`);
      }
    }
  }

  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}
