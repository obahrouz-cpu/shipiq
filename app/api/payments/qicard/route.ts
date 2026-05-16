import { NextRequest, NextResponse } from 'next/server'

// TODO: Add Qi Card API credentials and implement payment flow
// Required env vars: QICARD_API_KEY, QICARD_MERCHANT_ID, QICARD_SECRET

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Qi Card payment integration not yet configured' },
    { status: 501 }
  )
}
