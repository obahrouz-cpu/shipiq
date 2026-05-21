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

const swScript = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js');});}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* Resource hints — open connections to font + Supabase origins early */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://pzlckjasayitxcblvkjg.supabase.co" />
        <link rel="preconnect" href="https://pzlckjasayitxcblvkjg.supabase.co" crossOrigin="anonymous" />
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
        />
        <meta name="theme-color" content="#c9a84c" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ShipIQ" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
