import { useMemo } from 'react'
import type { TierSettings } from '../types'

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'vip'] as const
type TierName = typeof TIER_ORDER[number]

export function calculateTier(totalSpent: number, tierSettings: TierSettings[]): string {
  const sorted = [...tierSettings].sort((a, b) => b.min_spend - a.min_spend)
  for (const t of sorted) {
    if (totalSpent >= t.min_spend) return t.tier
  }
  return 'bronze'
}

export function useTier(totalSpent: number, tierSettings: TierSettings[]) {
  return useMemo(() => {
    const currentTierName = calculateTier(totalSpent, tierSettings)
    const currentIndex = TIER_ORDER.indexOf(currentTierName as TierName)
    const nextTierName = TIER_ORDER[currentIndex + 1]
    const nextTier = nextTierName
      ? (tierSettings.find(t => t.tier === nextTierName) ?? null)
      : null
    return { currentTier: currentTierName, nextTier }
  }, [totalSpent, tierSettings])
}
