import { NextRequest, NextResponse } from 'next/server'

// TODO: Add FIB API credentials and implement payment flow
// FIB API base URL: https://fib.iq/api/v1 (replace with real URL when available)
// Required env vars: FIB_API_KEY, FIB_MERCHANT_ID, FIB_SECRET

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'FIB payment integration not yet configured' },
    { status: 501 }
  )
}
