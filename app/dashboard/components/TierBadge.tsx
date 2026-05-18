'use client'
import type { TierSettings } from '@/lib/types'

interface Props {
  tier: string
  totalSpent: number
  tiers: TierSettings[]
  compact?: boolean
  language?: 'en' | 'ar'
}

export default function TierBadge({ tier, totalSpent, tiers, compact = false, language = 'en' }: Props) {
  const sorted = [...tiers].sort((a, b) => a.min_spend - b.min_spend)
  const current = sorted.find(t => t.tier === tier) || sorted[0]
  if (!current) return null

  const currentIdx = sorted.indexOf(current)
  const next = sorted[currentIdx + 1] ?? null

  const name = language === 'ar' ? current.name_ar : current.name_en
  const color = current.color

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 6,
        background: `${color}18`, border: `1px solid ${color}40`,
        fontSize: 11, fontWeight: 700, color,
        whiteSpace: 'nowrap',
      }}>
        {current.icon} {name}
      </span>
    )
  }

  // Progress calculation
  const prevMin = current.min_spend
  const nextMin = next?.min_spend ?? null
  const progress = nextMin != null
    ? Math.min(100, ((totalSpent - prevMin) / (nextMin - prevMin)) * 100)
    : 100
  const remaining = nextMin != null ? Math.max(0, nextMin - totalSpent) : 0

  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${color}50`,
      background: `linear-gradient(135deg, ${color}0f 0%, ${color}04 100%)`,
      boxShadow: `0 0 16px ${color}20`,
      padding: '14px 16px',
      marginBottom: 16,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Icon + name row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>{current.icon}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color }}>{name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
              {totalSpent.toFixed(2)} USD spent
            </div>
          </div>
        </div>
        {next && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Next tier</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: next.color }}>
              {next.icon} {language === 'ar' ? next.name_ar : next.name_en}
            </div>
          </div>
        )}
        {!next && (
          <div style={{ fontSize: 11, fontWeight: 700, color, opacity: 0.8 }}>Max tier 👑</div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ background: 'var(--surface3)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
        {next
          ? `${remaining.toFixed(2)} USD to ${language === 'ar' ? next.name_ar : next.name_en}`
          : `You've reached the highest tier!`}
      </div>
    </div>
  )
}
