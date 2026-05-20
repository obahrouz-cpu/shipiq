export const metadata = {
  title: "You're offline — ShipIQ",
}

export default function Offline() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', gap: 12, padding: 24, textAlign: 'center',
      background: '#0f0e0c', fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 52, opacity: 0.2, marginBottom: 4 }}>📦</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: '#c9a84c', letterSpacing: -1, lineHeight: 1 }}>ShipIQ</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#f0ece4', marginTop: 8 }}>You're offline</div>
      <div style={{ fontSize: 15, color: '#9e9a93', fontFamily: "'Tajawal', sans-serif" }}>أنت غير متصل</div>
      <div style={{ fontSize: 13, color: '#6b6760', maxWidth: 320, marginTop: 4 }}>
        Please check your connection and try again.
      </div>
      <a href="/" style={{
        marginTop: 20, padding: '12px 28px',
        background: '#c9a84c', color: '#0f0e0c',
        borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14,
      }}>
        Try Again · حاول مجدداً
      </a>
    </div>
  )
}
