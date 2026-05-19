'use client'
import { useState, useEffect } from 'react'
import { removeFromWishlist } from '@/lib/api'
import type { WishlistItem } from '@/lib/types'

function StoreFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false)
  let domain = ''
  try { domain = new URL(url).hostname.replace('www.', '') } catch {}
  if (!domain || failed) return <span style={{ fontSize: 14 }}>🔗</span>
  return (
    <img
      src={`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=32`}
      alt=""
      width={16}
      height={16}
      style={{ borderRadius: 3, objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  )
}

interface Props {
  items: WishlistItem[]
  onOrderNow: (item: WishlistItem) => void
  onRemove: (id: string) => void
  onRefresh: () => void
}

export default function WishlistPage({ items, onOrderNow, onRemove, onRefresh }: Props) {
  const [removing, setRemoving] = useState<string | null>(null)

  async function handleRemove(id: string) {
    setRemoving(id)
    await removeFromWishlist(id)
    onRemove(id)
    setRemoving(null)
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🤍</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No saved items yet</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>ابدأ بحفظ المنتجات · Save items while browsing stores</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, paddingBottom: 80 }}>
      {items.map(item => (
        <WishlistCard
          key={item.id}
          item={item}
          removing={removing === item.id}
          onOrderNow={() => onOrderNow(item)}
          onRemove={() => handleRemove(item.id)}
        />
      ))}
    </div>
  )
}

function WishlistCard({
  item, removing, onOrderNow, onRemove,
}: {
  item: WishlistItem
  removing: boolean
  onOrderNow: () => void
  onRemove: () => void
}) {
  const dateStr = item.created_at
    ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  let domain = ''
  try { domain = new URL(item.url).hostname.replace('www.', '') } catch {}

  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Thumbnail */}
      <div style={{
        height: 160, background: 'var(--surface)', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid var(--border)',
      }}>
        {item.photo_url ? (
          <img
            src={item.photo_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <span style={{ fontSize: 40, opacity: 0.2 }}>🛍️</span>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.55)', borderRadius: 6,
            padding: '3px 8px', fontSize: 11, color: '#fff', textDecoration: 'none',
          }}
        >
          ↗ Open
        </a>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Store + date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <StoreFavicon url={item.url} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{domain}</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{dateStr}</span>
        </div>

        {/* Description */}
        {item.description && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
            {item.description}
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.4 }}>
            {item.notes}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={onOrderNow}
            style={{
              flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 700,
              background: 'var(--gold)', color: 'var(--bg)',
              border: 'none', borderRadius: 8, cursor: 'pointer',
            }}
          >
            🛒 Order Now
          </button>
          <button
            onClick={onRemove}
            disabled={removing}
            style={{
              padding: '8px 12px', fontSize: 12,
              background: 'rgba(239,68,68,0.08)', color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
              cursor: removing ? 'not-allowed' : 'pointer', opacity: removing ? 0.5 : 1,
            }}
          >
            {removing ? '...' : '🗑️'}
          </button>
        </div>
      </div>
    </div>
  )
}
