import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendPush } from '@/lib/sendPush';

// firebase-admin (via sendPush) needs Node, not Edge.
export const runtime = 'nodejs';
// Allow time to fan out pushes to many customers.
export const maxDuration = 60;

// ── Config defaults (overridable via app_settings rows) ───────────────────────
const DEFAULTS = {
  windowHours: 48,
  digestHour: 10, // Asia/Baghdad
  urgentThresholdHours: 4,
};

function serviceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadConfig(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', [
      'expiry_window_hours',
      'expiry_digest_hour',
      'expiry_urgent_threshold_hours',
    ]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => {
    const v = parseFloat(String(map.get(k) ?? ''));
    return Number.isFinite(v) ? v : d;
  };
  return {
    windowHours: num('expiry_window_hours', DEFAULTS.windowHours),
    digestHour: num('expiry_digest_hour', DEFAULTS.digestHour),
    urgentThresholdHours: num(
      'expiry_urgent_threshold_hours',
      DEFAULTS.urgentThresholdHours,
    ),
  };
}

// Current hour (0-23) and YYYY-MM-DD date in Asia/Baghdad, for digest gating.
function baghdadParts(now: Date): { hour: number; date: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  // hour can come back as "24" at midnight in some runtimes — normalize.
  const hour = parseInt(parts.hour, 10) % 24;
  return { hour, date: `${parts.year}-${parts.month}-${parts.day}` };
}

function baghdadDateOf(iso: string | null): string | null {
  if (!iso) return null;
  return baghdadParts(new Date(iso)).date;
}

export async function POST(req: NextRequest) {
  return run(req);
}
// Vercel Cron issues GET requests; support both.
export async function GET(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  // ── Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` ───────────
  const secret = process.env.CRON_SECRET;
  const provided = (req.headers.get('authorization') || '').replace(
    /^Bearer\s+/i,
    '',
  );
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = serviceClient();
  const cfg = await loadConfig(supabase);
  const now = new Date();
  const nowMs = now.getTime();
  const windowMs = cfg.windowHours * 3600_000;
  const urgentMs = cfg.urgentThresholdHours * 3600_000;

  const summary = {
    voided: 0,
    urgentCustomers: 0,
    digestCustomers: 0,
    errors: [] as string[],
  };

  // ── (a) AUTO-VOID: calculated orders older than the window → 'expired' ───────
  // Per-order independent clocks (each compared to its own calculated_at).
  const voidCutoff = new Date(nowMs - windowMs).toISOString();
  const { data: voided, error: voidErr } = await supabase
    .from('orders')
    .update({ status: 'expired' })
    .eq('status', 'calculated')
    .lte('calculated_at', voidCutoff)
    .select('id');
  if (voidErr) summary.errors.push(`void: ${voidErr.message}`);
  else summary.voided = voided?.length ?? 0;
  // No notification on void — by design.

  // ── Load remaining in-window calculated orders (post-void) ──────────────────
  const { data: liveOrders, error: liveErr } = await supabase
    .from('orders')
    .select('id, user_id, calculated_at')
    .eq('status', 'calculated')
    .not('calculated_at', 'is', null);
  if (liveErr) {
    summary.errors.push(`load: ${liveErr.message}`);
    return NextResponse.json(summary, { status: 500 });
  }

  // Group orders by customer.
  type LiveOrder = { id: string; calcMs: number };
  const byUser = new Map<string, LiveOrder[]>();
  for (const o of liveOrders ?? []) {
    const calcMs = new Date(o.calculated_at as string).getTime();
    if (!Number.isFinite(calcMs)) continue;
    const arr = byUser.get(o.user_id) ?? [];
    arr.push({ id: o.id, calcMs });
    byUser.set(o.user_id, arr);
  }

  if (byUser.size === 0) return NextResponse.json(summary);

  // Pull the two dedupe markers for all affected customers at once.
  const userIds = Array.from(byUser.keys());
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, last_expiry_digest_at, last_expiry_urgent_at')
    .in('id', userIds);
  const markers = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        digestAt: p.last_expiry_digest_at as string | null,
        urgentAt: p.last_expiry_urgent_at as string | null,
      },
    ]),
  );

  // ── (b) URGENT PUSH: customers with >=1 order with <= threshold left ─────────
  // An order entered the urgent zone at calculated_at + (window - threshold).
  // We fire only if a NEW order has entered that zone since our last urgent
  // ping (last_expiry_urgent_at < newest urgent-entry). That gives exactly one
  // ping per window-entry per customer — it does NOT re-fire every hour, but a
  // genuinely new soon-to-expire order does trigger a fresh ping.
  for (const [userId, orders] of Array.from(byUser.entries())) {
    const urgent = orders.filter((o: LiveOrder) => {
      const left = o.calcMs + windowMs - nowMs;
      return left > 0 && left <= urgentMs;
    });
    if (urgent.length === 0) continue;

    const newestEntryMs = Math.max(
      ...urgent.map((o: LiveOrder) => o.calcMs + windowMs - urgentMs),
    );
    const lastUrgent = markers.get(userId)?.urgentAt;
    const alreadyPinged =
      lastUrgent != null && new Date(lastUrgent).getTime() >= newestEntryMs;
    if (alreadyPinged) continue;

    const n = urgent.length;
    const res = await sendPush(
      userId,
      'Action required',
      `${n} order${n > 1 ? 's' : ''} expiring within hours — confirm now or ${n > 1 ? 'they' : 'it'}'ll be cancelled.`,
      { type: 'order_expiry_urgent', count: n },
    );
    // Mark as sent regardless of delivery outcome (no-token etc.) so a
    // tokenless customer doesn't get retried every single hour.
    await supabase
      .from('profiles')
      .update({ last_expiry_urgent_at: now.toISOString() })
      .eq('id', userId);
    summary.urgentCustomers += 1;
    if (!res.ok && res.reason !== 'no-token') {
      summary.errors.push(`urgent ${userId}: ${res.reason}`);
    }
  }

  // ── (c) DAILY DIGEST: once per day at the digest hour (Asia/Baghdad) ─────────
  const { hour: bgHour, date: bgToday } = baghdadParts(now);
  if (bgHour === Math.floor(cfg.digestHour)) {
    for (const [userId, orders] of Array.from(byUser.entries())) {
      if (orders.length === 0) continue;
      const lastDigest = markers.get(userId)?.digestAt ?? null;
      if (baghdadDateOf(lastDigest) === bgToday) continue; // already today

      const n = orders.length;
      const res = await sendPush(
        userId,
        'ShipIQ',
        `You have ${n} order${n > 1 ? 's' : ''} awaiting confirmation — review before ${n > 1 ? 'they' : 'it'} expire${n > 1 ? '' : 's'}.`,
        { type: 'order_expiry_digest', count: n },
      );
      await supabase
        .from('profiles')
        .update({ last_expiry_digest_at: now.toISOString() })
        .eq('id', userId);
      summary.digestCustomers += 1;
      if (!res.ok && res.reason !== 'no-token') {
        summary.errors.push(`digest ${userId}: ${res.reason}`);
      }
    }
  }

  return NextResponse.json(summary);
}
