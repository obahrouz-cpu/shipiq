import { NextRequest, NextResponse } from 'next/server';
import { sendPush } from '@/lib/sendPush';

export const runtime = 'nodejs';

// Manual/test endpoint for sending a single push. Protected by the
// PUSH_API_SECRET shared secret so arbitrary callers can't trigger it.
// Intended for verification ("send one push to my tablet"). The order-expiry
// feature will import sendPush() directly rather than going through HTTP.
//
// Usage:
//   POST /api/push/test
//   Authorization: Bearer <PUSH_API_SECRET>
//   { "userId": "...", "title": "...", "body": "...", "data": { } }
export async function POST(req: NextRequest) {
    const secret = process.env.PUSH_API_SECRET;
    const provided = (req.headers.get('authorization') || '').replace(
        /^Bearer\s+/i,
        '',
    );
    if (!secret || provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.userId || !body?.title || !body?.body) {
        return NextResponse.json(
            { error: 'userId, title, and body are required' },
            { status: 400 },
        );
    }

    try {
        const result = await sendPush(
            body.userId,
            body.title,
            body.body,
            body.data,
        );
        return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    } catch (err) {
        console.error(
            '[api/push/test] unexpected error:',
            (err as Error).message,
        );
        return NextResponse.json(
            { error: 'Internal error', detail: (err as Error).message },
            { status: 500 },
        );
    }
}
