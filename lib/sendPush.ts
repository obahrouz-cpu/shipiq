import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { messaging } from '@/lib/firebaseAdmin';

// Service-role Supabase client (bypasses RLS) — same pattern as the other
// server routes (see app/api/broadcast/route.ts). Server-only.
function serviceClient() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var');
    }
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// FCM error codes that mean the token is dead and should be cleared so we
// stop trying it on every future send.
const DEAD_TOKEN_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
]);

export type SendPushResult =
    | { ok: true; messageId: string }
    | {
          ok: false;
          reason:
              | 'missing-user-id'
              | 'lookup-failed'
              | 'no-token'
              | 'dead-token-cleared'
              | 'send-failed';
          code?: string;
          error?: string;
      };

/**
 * Send a push notification to a single user by their stored FCM token.
 *
 * Reusable building block — other features (e.g. order-expiry) call this; it
 * does NOT schedule anything itself.
 *
 * @param userId profiles.id of the recipient.
 * @param title  notification title.
 * @param body   notification body.
 * @param data   optional data payload; values are coerced to strings (FCM
 *               requires string values in the data map).
 */
export async function sendPush(
    userId: string,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
): Promise<SendPushResult> {
    if (!userId) {
        console.warn('[sendPush] called without userId; skipping.');
        return { ok: false, reason: 'missing-user-id' };
    }

    const supabase = serviceClient();

    // 1. Look up the user's FCM token.
    const { data: profile, error: lookupError } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', userId)
        .maybeSingle();

    if (lookupError) {
        console.error(
            `[sendPush] token lookup failed for user ${userId}: ${lookupError.message}`,
        );
        return { ok: false, reason: 'lookup-failed', error: lookupError.message };
    }

    const token = (profile as { fcm_token?: string | null } | null)?.fcm_token;
    if (!token) {
        console.warn(`[sendPush] no fcm_token for user ${userId}; nothing to send.`);
        return { ok: false, reason: 'no-token' };
    }

    // 2. FCM data values must be strings — stringify anything that isn't.
    const stringData: Record<string, string> = {};
    for (const [k, v] of Object.entries(data ?? {})) {
        stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }

    // 3. Send, and handle a dead/expired token by clearing it.
    try {
        const messageId = await messaging().send({
            token,
            notification: { title, body },
            data: stringData,
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default' } } },
        });
        console.log(
            `[sendPush] delivered to user ${userId} (message ${messageId}).`,
        );
        return { ok: true, messageId };
    } catch (err) {
        const e = err as {
            errorInfo?: { code?: string };
            code?: string;
            message?: string;
        };
        const code = e.errorInfo?.code || e.code || 'unknown';
        console.error(
            `[sendPush] send failed for user ${userId} (${code}): ${e.message}`,
        );

        if (DEAD_TOKEN_CODES.has(code)) {
            // Only clear if the token hasn't changed since we read it, so we
            // don't wipe a fresh token the app may have just written.
            const { error: clearError } = await supabase
                .from('profiles')
                .update({ fcm_token: null })
                .eq('id', userId)
                .eq('fcm_token', token);

            if (clearError) {
                console.error(
                    `[sendPush] failed to clear dead token for user ${userId}: ${clearError.message}`,
                );
            } else {
                console.log(`[sendPush] cleared dead token for user ${userId}.`);
            }
            return { ok: false, reason: 'dead-token-cleared', code };
        }

        return { ok: false, reason: 'send-failed', code, error: e.message };
    }
}
