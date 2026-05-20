type Settings = Record<string, string>

const AFFILIATE_RULES: { domain: string; key: string; param: string }[] = [
  { domain: 'amazon.com',       key: 'affiliate_amazon',    param: 'tag' },
  { domain: 'amazon.ae',        key: 'affiliate_amazon_ae', param: 'tag' },
  { domain: 'ebay.com',         key: 'affiliate_ebay',      param: 'campid' },
  { domain: 'trendyol.com',     key: 'affiliate_trendyol',  param: 'boutiqueId' },
  { domain: 'noon.com',         key: 'affiliate_noon',      param: 'affiliate' },
  { domain: 'aliexpress.com',   key: 'affiliate_aliexpress', param: 'aff_fcid' },
  { domain: 'bhphotovideo.com', key: 'affiliate_bhphoto',   param: 'BI' },
  { domain: 'bestbuy.com',      key: 'affiliate_bestbuy',   param: 'ref' },
  { domain: 'newegg.com',       key: 'affiliate_newegg',    param: 'cm_mmc' },
]

export function appendAffiliateTag(url: string, settings: Settings): string {
  if (!url) return url
  if (settings.affiliate_enabled === 'false') return url
  const lower = url.toLowerCase()
  const rule = AFFILIATE_RULES.find(r => lower.includes(r.domain))
  if (!rule) return url
  const tag = settings[rule.key]?.trim()
  if (!tag) return url
  try {
    const u = new URL(url)
    u.searchParams.set(rule.param, tag)
    return u.toString()
  } catch {
    return url
  }
}

export function hasAffiliateTag(url: string, settings: Settings): boolean {
  return appendAffiliateTag(url, settings) !== url
}
