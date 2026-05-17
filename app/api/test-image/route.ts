import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const testUrls = [
    'https://www.amazon.com/dp/B0F6PLQ93N',
    'https://www.trendyol.com/apple/iphone-15-128gb-p-686900249',
    'https://www.wearfigs.com/products/test'
  ]

  const results = []
  for (const url of testUrls) {
    try {
      const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      results.push({ url, status: res.status, image: data?.data?.image?.url, logo: data?.data?.logo?.url, error: data?.message })
    } catch (e: any) {
      results.push({ url, error: e.message })
    }
  }

  return NextResponse.json(results)
}
