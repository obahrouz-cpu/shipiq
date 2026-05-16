import { NextResponse } from 'next/server'

const FALLBACK_RATE = 1540
const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour

let cached: { rate: number; updated: string; ts: number } | null = null

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_DURATION_MS) {
    return NextResponse.json({ rate: cached.rate, source: 'iraqborsa.com', updated: cached.updated })
  }

  try {
    const res = await fetch('https://iraqborsa.com/%D8%B3%D8%B9%D8%B1-%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1-%D9%81%D9%8A-%D8%A7%D9%84%D8%B3%D9%88%D9%82/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ar-IQ,ar;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const html = await res.text()

    // Extract all numbers in the 1400–1700 IQD/USD range
    const matches = html.match(/\b1[4-7]\d{2}\b/g)
    if (!matches || matches.length === 0) throw new Error('No rates found in page')

    const rates = matches.map(Number)
    const highest = Math.max(...rates)

    const now = new Date().toISOString()
    cached = { rate: highest, updated: now, ts: Date.now() }

    return NextResponse.json({ rate: highest, source: 'iraqborsa.com', updated: now })
  } catch {
    const now = new Date().toISOString()
    return NextResponse.json({ rate: FALLBACK_RATE, source: 'fallback', updated: now })
  }
}
