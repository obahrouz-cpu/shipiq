import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ShipIQ — شيب آي كيو',
  description: 'Smart shipping service from worldwide to Iraq',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
