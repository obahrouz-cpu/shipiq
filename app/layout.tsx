import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ShipIQ — شيب آي كيو | Shop Global, Delivered to Iraq',
  description: 'ShipIQ is Iraq\'s smartest personal shopping & shipping service. Buy from Amazon, Trendyol, Noon, AliExpress and more — delivered to Erbil & Baghdad.',
  keywords: ['shipping Iraq', 'شحن العراق', 'personal shopper Iraq', 'Amazon Iraq', 'Trendyol Iraq', 'ShipIQ'],
  authors: [{ name: 'ShipIQ' }],
  openGraph: {
    title: 'ShipIQ — Shop Global, Delivered to Iraq',
    description: 'Buy from Amazon, Trendyol, Noon, AliExpress and more — delivered to Erbil & Baghdad. Instant shipping estimates, full tracking.',
    type: 'website',
    locale: 'en_US',
    siteName: 'ShipIQ',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShipIQ — Shop Global, Delivered to Iraq',
    description: 'Iraq\'s smartest shipping service. Buy from 27+ global stores, delivered to your door.',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// Inline script prevents flash of wrong theme before React hydrates
const themeScript = `(function(){try{var t=localStorage.getItem('shipiq_theme');var m=window.matchMedia('(prefers-color-scheme: light)').matches;var theme=t||(m?'light':'dark');document.documentElement.setAttribute('data-theme',theme);}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
