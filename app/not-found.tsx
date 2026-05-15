export default function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', gap: 12, padding: 24, textAlign: 'center',
      background: '#0f0e0c', fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 52, opacity: 0.2, marginBottom: 4 }}>📦</div>
      <div style={{ fontSize: 72, fontWeight: 800, color: '#c9a84c', letterSpacing: -3, lineHeight: 1 }}>404</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#f0ece4', marginTop: 8 }}>Page Not Found</div>
      <div style={{ fontSize: 14, color: '#9e9a93', fontFamily: "'Tajawal', sans-serif" }}>الصفحة غير موجودة</div>
      <div style={{ fontSize: 13, color: '#6b6760', maxWidth: 320, marginTop: 4 }}>
        The page you're looking for doesn't exist or has been moved.
      </div>
      <a href="/dashboard" style={{
        marginTop: 20, padding: '12px 28px',
        background: '#c9a84c', color: '#0f0e0c',
        borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14,
        transition: 'background 0.15s',
      }}>
        Go to Dashboard · العودة للرئيسية
      </a>
    </div>
  )
}
