import { NextResponse } from 'next/server'

const FALLBACK_RATE = 1540
const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour

const QAMAR_RATES_URL = 'https://qamaralfajr.com/production/exchange_rates.php'
const QAMAR_HOME_URL = 'https://qamaralfajr.com'
const IRAQBORSA_URL =
  'https://iraqborsa.com/%D8%B3%D8%B9%D8%B1-%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1-%D9%81%D9%8A-%D8%A7%D9%84%D8%B3%D9%88%D9%82/'

const QAMAR_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ar-IQ,ar;q=0.9,en;q=0.8',
  Referer: 'https://qamaralfajr.com/',
  'Cache-Control': 'no-cache',
}

let cached: { rate: number; source: string; updated: string; ts: number } | null = null

// Extract the highest IQD/USD rate (1400–1700) from an HTML page.
function extractHighestRate(html: string): number | null {
  const matches = html.match(/\b1[4-7]\d{2}\b/g)
  if (!matches || matches.length === 0) return null
  return Math.max(...matches.map(Number))
}

// Parse Set-Cookie headers into a single Cookie request header value.
function collectCookies(res: Response): string {
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) return ''
  return setCookie
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

async function fetchQamarRates(extraHeaders: Record<string, string> = {}): Promise<Response> {
  return fetch(QAMAR_RATES_URL, {
    headers: { ...QAMAR_HEADERS, ...extraHeaders },
    next: { revalidate: 0 },
  })
}

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_DURATION_MS) {
    return NextResponse.json({ rate: cached.rate, source: cached.source, updated: cached.updated })
  }

  // 1. Primary source: qamaralfajr.com exchange_rates.php
  try {
    let res = await fetchQamarRates()
    let html = await res.text()
    console.log('[exchange-rate] qamaralfajr direct status:', res.status)
    console.log('[exchange-rate] qamaralfajr direct body:', html)

    // 2. If blocked, fetch the home page to obtain cookies, then retry.
    if (!res.ok) {
      console.log('[exchange-rate] qamaralfajr direct failed, fetching home page for cookies')
      const home = await fetch(QAMAR_HOME_URL, { headers: QAMAR_HEADERS, next: { revalidate: 0 } })
      const homeBody = await home.text()
      console.log('[exchange-rate] qamaralfajr home status:', home.status)
      console.log('[exchange-rate] qamaralfajr home body:', homeBody)

      const cookies = collectCookies(home)
      console.log('[exchange-rate] qamaralfajr cookies:', cookies)

      res = await fetchQamarRates(cookies ? { Cookie: cookies } : {})
      html = await res.text()
      console.log('[exchange-rate] qamaralfajr retry status:', res.status)
      console.log('[exchange-rate] qamaralfajr retry body:', html)
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const rate = extractHighestRate(html)
    if (rate === null) throw new Error('No rates found in qamaralfajr page')

    const now = new Date().toISOString()
    cached = { rate, source: 'qamaralfajr.com', updated: now, ts: Date.now() }
    return NextResponse.json({ rate, source: 'qamaralfajr.com', updated: now })
  } catch (err) {
    console.log('[exchange-rate] qamaralfajr failed:', err)
  }

  // 3. Backup source: iraqborsa.com
  try {
    const res = await fetch(IRAQBORSA_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ar-IQ,ar;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      next: { revalidate: 0 },
    })

    const html = await res.text()
    console.log('[exchange-rate] iraqborsa status:', res.status)
    console.log('[exchange-rate] iraqborsa body:', html)

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const rate = extractHighestRate(html)
    if (rate === null) throw new Error('No rates found in iraqborsa page')

    const now = new Date().toISOString()
    cached = { rate, source: 'iraqborsa.com', updated: now, ts: Date.now() }
    return NextResponse.json({ rate, source: 'iraqborsa.com', updated: now })
  } catch (err) {
    console.log('[exchange-rate] iraqborsa failed:', err)
  }

  // 4. Final fallback: hardcoded rate.
  const now = new Date().toISOString()
  return NextResponse.json({ rate: FALLBACK_RATE, source: 'fallback', updated: now })
}
