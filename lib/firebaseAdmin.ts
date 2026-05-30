import 'server-only';
import {
    initializeApp,
    getApps,
    getApp,
    cert,
    type App,
} from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

// Server-side Firebase Admin app, initialized once per serverless instance.
// Authenticates with a service-account credential supplied via the
// FIREBASE_SERVICE_ACCOUNT env var (the full JSON key as a single string).
// NEVER import this into a client component.

let _app: App | null = null;

function firebaseAdminApp(): App {
    if (_app) return _app;

    // Reuse an already-initialized app on warm invocations / repeated imports.
    if (getApps().length) {
        return (_app = getApp());
    }

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
        throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env var');
    }

    let serviceAccount: Record<string, unknown>;
    try {
        serviceAccount = JSON.parse(raw);
    } catch (e) {
        throw new Error(
            `FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${(e as Error).message}`,
        );
    }

    // Some dashboards escape the private_key newlines as the two characters
    // "\n". Normalize them back to real newlines so the PEM parses. Harmless
    // if they're already real newlines.
    if (typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = (serviceAccount.private_key as string).replace(
            /\\n/g,
            '\n',
        );
    }

    _app = initializeApp({
        credential: cert(serviceAccount as Parameters<typeof cert>[0]),
    });
    return _app;
}

export function messaging(): Messaging {
    return getMessaging(firebaseAdminApp());
}
