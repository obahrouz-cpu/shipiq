'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import type { Order, Profile } from '@/lib/types'
import styles from './AdminAnalytics.module.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const GOLD = '#c9a84c'
const IQD_PER_USD = 1540
const REVENUE_STATUSES = new Set(['confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'delivered'])

const STATUS_ORDER = ['pending', 'calculated', 'confirmed', 'ordered', 'warehouse', 'transit', 'arrived', 'out_for_delivery', 'delivered'] as const

const COUNTRY_DOMAINS: Record<string, string[]> = {
  USA:    ['amazon.com', 'ebay.', 'walmart.', 'bestbuy.', 'newegg.', 'bhphotovideo.', 'nike.', 'adidas.', 'sephora.', 'iherb.', 'target.', 'macys.'],
  Turkey: ['trendyol.', 'hepsiburada.', 'n11.', 'lcwaikiki.', 'mavi.'],
  UAE:    ['amazon.ae', 'noon.', 'boutiqaat.', 'namshi.', 'sharafdg.', 'brandsforless.'],
  China:  ['aliexpress.', 'shein.', 'banggood.', 'dhgate.', 'zaful.', 'taobao.', '1688.', 'jd.com'],
}

const COUNTRY_FLAGS: Record<string, string> = { USA: '🇺🇸', Turkey: '🇹🇷', UAE: '🇦🇪', China: '🇨🇳', Other: '🌍' }
const COUNTRY_COLORS: Record<string, string> = { USA: '#c9a84c', Turkey: '#e07b3a', UAE: '#5b9bd5', China: '#d9534f', Other: '#9e9a93' }

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', platinum: '#E5E4E2', vip: '#c9a84c',
}

const CHART_GRID   = '#2d2b28'
const CHART_AXIS   = '#6b6760'
const CHART_BORDER = '#3a3835'

const CATEGORY_COLORS = ['#c9a84c','#e07b3a','#5b9bd5','#4caf7a','#d9534f','#9c6fe4','#f5c518','#e2c27a']

// ── Helpers ───────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | '3months' | 'all'

function detectCountry(url: string): string {
  const u = (url || '').toLowerCase()
  for (const [country, domains] of Object.entries(COUNTRY_DOMAINS)) {
    if (domains.some(d => u.includes(d))) return country
  }
  return 'Other'
}

function toUsd(price?: number, currency?: string): number {
  if (!price) return 0
  return currency === 'USD' ? price : price / IQD_PER_USD
}

function getPeriodStart(period: Period): Date | null {
  const now = new Date()
  switch (period) {
    case 'today':   return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case 'week':    return new Date(now.getTime() - 6 * 86400000)
    case 'month':   return new Date(now.getFullYear(), now.getMonth(), 1)
    case '3months': return new Date(now.getFullYear(), now.getMonth() - 3, 1)
    default:        return null
  }
}

function filterByPeriod(orders: Order[], period: Period): Order[] {
  const start = getPeriodStart(period)
  if (!start) return orders
  return orders.filter(o => new Date(o.created_at) >= start)
}

function fmtUsd(n: number, dec = 0): string {
  return '$' + n.toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtDate(iso: string): string {
  return iso ? iso.split('T')[0] : '—'
}

function buildRevenueChart(orders: Order[], period: Period): { date: string; revenue: number }[] {
  if (period === 'today') {
    const buckets: Record<string, number> = {}
    for (let h = 0; h < 24; h++) buckets[`${String(h).padStart(2, '0')}:00`] = 0
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours()
      const key = `${String(h).padStart(2, '0')}:00`
      buckets[key] = (buckets[key] || 0) + toUsd(o.shipping_price, o.shipping_currency)
    })
    return Object.entries(buckets).map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }))
  }

  if (period === 'week' || period === 'month') {
    const buckets: Record<string, number> = {}
    const start = getPeriodStart(period)!
    const now = new Date()
    for (const d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      buckets[d.toISOString().split('T')[0]] = 0
    }
    orders.forEach(o => {
      const key = o.created_at.split('T')[0]
      if (key in buckets) buckets[key] = (buckets[key] || 0) + toUsd(o.shipping_price, o.shipping_currency)
    })
    return Object.entries(buckets).map(([date, revenue]) => ({
      date: new Date(date + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      revenue: Math.round(revenue),
    }))
  }

  if (period === '3months') {
    const buckets: Record<string, number> = {}
    orders.forEach(o => {
      const d = new Date(o.created_at)
      const dow = d.getDay()
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - dow)
      const key = weekStart.toISOString().split('T')[0]
      buckets[key] = (buckets[key] || 0) + toUsd(o.shipping_price, o.shipping_currency)
    })
    return Object.entries(buckets).sort().map(([date, revenue]) => ({
      date: new Date(date + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      revenue: Math.round(revenue),
    }))
  }

  // All time → by month
  const buckets: Record<string, number> = {}
  orders.forEach(o => {
    const d = new Date(o.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets[key] = (buckets[key] || 0) + toUsd(o.shipping_price, o.shipping_currency)
  })
  return Object.entries(buckets).sort().map(([key, revenue]) => {
    const [yr, mo] = key.split('-')
    return {
      date: new Date(+yr, +mo - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      revenue: Math.round(revenue),
    }
  })
}

// ── Mini components ───────────────────────────────────────────────────────────

function Skeleton({ h = 20, w = '100%' }: { h?: number; w?: string | number }) {
  return <div className={styles.skeleton} style={{ height: h, width: w }} />
}

function ChartTooltip({ active, payload, label, usd = false }: {
  active?: boolean; payload?: { value: number; color?: string }[]; label?: string; usd?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1a1916', border: '1px solid #3a3835',
      borderRadius: 8, padding: '8px 14px', fontSize: 12,
    }}>
      <div style={{ color: '#9e9a93', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || GOLD, fontWeight: 700 }}>
          {usd ? fmtUsd(p.value) : p.value.toLocaleString()}
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{
      background: '#1a1916', border: '1px solid #3a3835',
      borderRadius: 8, padding: '8px 14px', fontSize: 12,
    }}>
      <div style={{ color: '#9e9a93', marginBottom: 2 }}>{COUNTRY_FLAGS[p.name] || '🌍'} {p.name}</div>
      <div style={{ color: GOLD, fontWeight: 700 }}>{fmtUsd(p.value)}</div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color = GOLD }: {
  icon: string; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statEmoji}>{icon}</div>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} style={{ color }}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.summaryRow}>
      <span className={styles.summaryKey}>{label}</span>
      <span className={styles.summaryVal}>{value}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const [allOrders, setAllOrders]     = useState<Order[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [loading, setLoading]         = useState(true)
  const [period, setPeriod]           = useState<Period>('month')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from('orders')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'customer'),
    ]).then(([ordersRes, profilesRes]) => {
      setAllOrders((ordersRes.data as Order[]) || [])
      setAllProfiles((profilesRes.data as Profile[]) || [])
      setLoading(false)
    })
  }, [])

  // ── Derived data ────────────────────────────────────────────────────────────

  const orders = useMemo(() => filterByPeriod(allOrders, period), [allOrders, period])

  const revenueOrders = useMemo(
    () => orders.filter(o => REVENUE_STATUSES.has(o.status)),
    [orders]
  )

  const stats = useMemo(() => {
    const totalRevenue    = revenueOrders.reduce((s, o) => s + toUsd(o.shipping_price, o.shipping_currency), 0)
    const totalOrders     = orders.length
    const completedOrders = orders.filter(o => ['delivered', 'arrived', 'transit', 'warehouse', 'ordered'].includes(o.status)).length
    const pendingOrders   = orders.filter(o => ['pending', 'calculated'].includes(o.status)).length
    const activeCustomers = new Set(orders.map(o => o.user_id)).size
    const avgOrderValue   = revenueOrders.length > 0 ? totalRevenue / revenueOrders.length : 0
    return { totalRevenue, totalOrders, completedOrders, pendingOrders, activeCustomers, avgOrderValue }
  }, [orders, revenueOrders])

  const revenueChart = useMemo(
    () => buildRevenueChart(revenueOrders, period),
    [revenueOrders, period]
  )

  const countryOrders = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number }> = {}
    for (const o of orders) {
      const c = detectCountry(o.url)
      if (!map[c]) map[c] = { orders: 0, revenue: 0 }
      map[c].orders++
      if (REVENUE_STATUSES.has(o.status)) map[c].revenue += toUsd(o.shipping_price, o.shipping_currency)
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, flag: COUNTRY_FLAGS[name] || '🌍', orders: d.orders, revenue: Math.round(d.revenue) }))
      .sort((a, b) => b.orders - a.orders)
  }, [orders])

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of orders) map[o.category || 'Other'] = (map[o.category || 'Other'] || 0) + 1
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [orders])

  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; email: string; orders: number; revenue: number; tier: string; lastOrder: string }> = {}
    for (const o of orders) {
      if (!map[o.user_id]) {
        const prof = allProfiles.find(p => p.id === o.user_id)
        map[o.user_id] = {
          name: o.profiles?.full_name || prof?.full_name || '—',
          email: o.profiles?.email || prof?.email || '—',
          orders: 0, revenue: 0,
          tier: prof?.tier || 'bronze',
          lastOrder: o.created_at,
        }
      }
      map[o.user_id].orders++
      if (REVENUE_STATUSES.has(o.status)) map[o.user_id].revenue += toUsd(o.shipping_price, o.shipping_currency)
      if (o.created_at > map[o.user_id].lastOrder) map[o.user_id].lastOrder = o.created_at
    }
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }, [orders, allProfiles])

  const funnel = useMemo(() => {
    const total = orders.filter(o => o.status !== 'rejected').length || 1
    return STATUS_ORDER.map(s => {
      const idx = STATUS_ORDER.indexOf(s)
      const count = orders.filter(o => {
        if (o.status === 'rejected') return false
        return STATUS_ORDER.indexOf(o.status) >= idx
      }).length
      return { status: s, count, pct: Math.round((count / total) * 100) }
    })
  }, [orders])

  const todayOrders = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return allOrders.filter(o => o.created_at.startsWith(today))
  }, [allOrders])

  const financial = useMemo(() => {
    const totalRevUsd  = revenueOrders.reduce((s, o) => s + toUsd(o.shipping_price, o.shipping_currency), 0)
    const totalBalUsd  = allProfiles.reduce((s, p) => s + (p.balance_usd || 0), 0)

    const cRev: Record<string, number> = {}
    for (const o of revenueOrders) {
      const c = detectCountry(o.url)
      cRev[c] = (cRev[c] || 0) + toUsd(o.shipping_price, o.shipping_currency)
    }
    const topCountry = Object.entries(cRev).sort(([, a], [, b]) => b - a)[0]

    const catMap: Record<string, number> = {}
    for (const o of orders) catMap[o.category || 'Other'] = (catMap[o.category || 'Other'] || 0) + 1
    const topCat = Object.entries(catMap).sort(([, a], [, b]) => b - a)[0]

    const deliveredCount = allOrders.filter(o => o.status === 'delivered').length
    const convRate = allOrders.length ? Math.round((deliveredCount / allOrders.length) * 100) : 0

    return { totalRevUsd, totalBalUsd, topCountry, topCat, convRate }
  }, [revenueOrders, allProfiles, orders, allOrders])

  // ── Render ──────────────────────────────────────────────────────────────────

  const PERIODS: { id: Period; label: string }[] = [
    { id: 'today',   label: 'Today' },
    { id: 'week',    label: 'This Week' },
    { id: 'month',   label: 'This Month' },
    { id: '3months', label: 'Last 3 Months' },
    { id: 'all',     label: 'All Time' },
  ]

  return (
    <div>
      {/* Period filter */}
      <div className={styles.periodFilter}>
        {PERIODS.map(p => (
          <button
            key={p.id}
            className={`${styles.pill} ${period === p.id ? styles.pillActive : ''}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        /* ── Skeleton ── */
        <>
          <div className={styles.overviewGrid} style={{ marginBottom: 24 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.chartCard} style={{ padding: 20, gap: 10, display: 'flex', flexDirection: 'column' }}>
                <Skeleton h={22} w={32} />
                <Skeleton h={12} w="60%" />
                <Skeleton h={28} w="80%" />
              </div>
            ))}
          </div>
          <div className={styles.section}>
            <div className={styles.chartCard}><Skeleton h={260} /></div>
          </div>
          <div className={styles.twoCol}>
            <div className={styles.chartCard}><Skeleton h={240} /></div>
            <div className={styles.chartCard}><Skeleton h={240} /></div>
          </div>
        </>
      ) : (
        <>
          {/* ── SECTION 1: Overview Cards ── */}
          <div className={styles.overviewGrid}>
            <StatCard
              icon="💰" label="Total Revenue"
              value={fmtUsd(stats.totalRevenue)}
            />
            <StatCard
              icon="📦" label="Total Orders"
              value={String(stats.totalOrders)}
              color="var(--text)"
            />
            <StatCard
              icon="✅" label="Completed"
              value={String(stats.completedOrders)}
              sub={stats.totalOrders ? `${Math.round((stats.completedOrders / stats.totalOrders) * 100)}% of total` : ''}
              color="var(--green)"
            />
            <StatCard
              icon="⏳" label="Pending"
              value={String(stats.pendingOrders)}
              color="var(--orange)"
            />
            <StatCard
              icon="👥" label="Active Customers"
              value={String(stats.activeCustomers)}
              sub={`of ${allProfiles.length} total`}
              color="var(--blue)"
            />
            <StatCard
              icon="📈" label="Avg Order Value"
              value={fmtUsd(stats.avgOrderValue)}
              sub={`per shipped order`}
            />
          </div>

          {/* ── SECTION 2: Revenue Chart ── */}
          <div className={styles.section}>
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>
                Revenue Over Time
                <span className={styles.chartSub}>{fmtUsd(stats.totalRevenue, 2)} total</span>
              </div>
              {revenueChart.length === 0 ? (
                <div className={styles.empty}>No revenue data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={revenueChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: CHART_AXIS, fontSize: 11 }}
                      axisLine={{ stroke: CHART_BORDER }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: CHART_AXIS, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `$${v}`}
                      width={52}
                    />
                    <Tooltip content={<ChartTooltip usd />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke={GOLD}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: GOLD, stroke: '#0f0e0c', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── SECTION 3: Country Charts ── */}
          <div className={styles.twoCol}>
            {/* Bar: orders by country */}
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>Orders by Country</div>
              {countryOrders.length === 0 ? (
                <div className={styles.empty}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={countryOrders} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                    <XAxis dataKey="flag" tick={{ fontSize: 20 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div style={{ background: '#1a1916', border: '1px solid #3a3835', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                            <div style={{ color: '#f0ece4', fontWeight: 700 }}>{d.flag} {d.name}</div>
                            <div style={{ color: GOLD }}>{d.orders} orders</div>
                            <div style={{ color: '#9e9a93' }}>{fmtUsd(d.revenue)} revenue</div>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                      {countryOrders.map((entry, i) => (
                        <Cell key={i} fill={COUNTRY_COLORS[entry.name] || '#9e9a93'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pie: revenue by country */}
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>Revenue by Country</div>
              {countryOrders.every(c => c.revenue === 0) ? (
                <div className={styles.empty}>No revenue data</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={countryOrders.filter(c => c.revenue > 0)}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={3}
                    >
                      {countryOrders.filter(c => c.revenue > 0).map((entry, i) => (
                        <Cell key={i} fill={COUNTRY_COLORS[entry.name] || '#9e9a93'} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      formatter={(v) => `${COUNTRY_FLAGS[v] || ''} ${v}`}
                      wrapperStyle={{ fontSize: 12, color: '#9e9a93' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── SECTION 4: Category Chart ── */}
          <div className={styles.section}>
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>Orders by Category</div>
              {categoryData.length === 0 ? (
                <div className={styles.empty}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, categoryData.length * 42)}>
                  <BarChart
                    layout="vertical"
                    data={categoryData}
                    margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: CHART_AXIS, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: '#f0ece4', fontSize: 12, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: CHART_AXIS, fontSize: 11 }}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── SECTION 5: Top Customers ── */}
          <div className={styles.section}>
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>
                Top 10 Customers by Revenue
                <span className={styles.chartSub}>{PERIODS.find(p => p.id === period)?.label}</span>
              </div>
              {topCustomers.length === 0 ? (
                <div className={styles.empty}>No customer data for this period</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Tier</th>
                        <th>Orders</th>
                        <th>Total Spent</th>
                        <th>Last Order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCustomers.map((c, i) => (
                        <tr key={i}>
                          <td className={styles.rankNum}>{i + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{c.email}</div>
                          </td>
                          <td>
                            <span style={{ fontSize: 12, fontWeight: 700, color: TIER_COLORS[c.tier] || '#9e9a93' }}>
                              <span className={styles.tierDot} style={{ background: TIER_COLORS[c.tier] || '#9e9a93' }} />
                              {c.tier.charAt(0).toUpperCase() + c.tier.slice(1)}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{c.orders}</td>
                          <td style={{ color: GOLD, fontWeight: 700 }}>{fmtUsd(c.revenue, 2)}</td>
                          <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{fmtDate(c.lastOrder)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 6: Status Funnel ── */}
          <div className={styles.section}>
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>
                Order Status Funnel
                <span className={styles.chartSub}>
                  {financial.convRate}% delivered rate (all time)
                </span>
              </div>
              <div>
                {funnel.map(f => (
                  <div key={f.status} className={styles.funnelRow}>
                    <div className={styles.funnelLabel}>{f.status}</div>
                    <div className={styles.funnelBarWrap}>
                      <div
                        className={styles.funnelBarFill}
                        style={{
                          width: `${f.pct}%`,
                          background: f.status === 'delivered' ? 'var(--green)'
                            : f.status === 'pending' ? 'var(--orange)'
                            : GOLD,
                        }}
                      />
                    </div>
                    <div className={styles.funnelCount}>{f.count}</div>
                    <div className={styles.funnelPct}>{f.pct}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── SECTIONS 7 + 8: Financial Summary + Daily Activity ── */}
          <div className={styles.twoCol}>
            {/* Financial Summary */}
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>Financial Summary</div>
              <SumRow label="Total Revenue (USD)" value={fmtUsd(financial.totalRevUsd, 2)} />
              <SumRow
                label="Customer Balances Held"
                value={fmtUsd(financial.totalBalUsd, 2)}
              />
              <SumRow
                label="Most Profitable Country"
                value={financial.topCountry
                  ? `${COUNTRY_FLAGS[financial.topCountry[0]] || '🌍'} ${financial.topCountry[0]} (${fmtUsd(financial.topCountry[1])})`
                  : '—'}
              />
              <SumRow
                label="Most Popular Category"
                value={financial.topCat ? `${financial.topCat[0]} (${financial.topCat[1]} orders)` : '—'}
              />
              <SumRow
                label="Total Customers"
                value={String(allProfiles.length)}
              />
            </div>

            {/* Daily Activity */}
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>Daily Activity — Today</div>
              <div className={styles.dailyGrid}>
                <div className={styles.dailyCard}>
                  <div className={styles.dailyNum}>{todayOrders.length}</div>
                  <div className={styles.dailyLabel}>Orders Submitted</div>
                </div>
                <div className={styles.dailyCard}>
                  <div className={styles.dailyNum} style={{ color: 'var(--blue)' }}>
                    {todayOrders.filter(o => o.status === 'confirmed').length}
                  </div>
                  <div className={styles.dailyLabel}>Confirmed</div>
                </div>
                <div className={styles.dailyCard}>
                  <div className={styles.dailyNum} style={{ color: 'var(--gold)' }}>
                    {todayOrders.filter(o => ['transit', 'arrived', 'delivered'].includes(o.status)).length}
                  </div>
                  <div className={styles.dailyLabel}>Shipped</div>
                </div>
                <div className={styles.dailyCard}>
                  <div className={styles.dailyNum} style={{ color: 'var(--green)' }}>
                    {allProfiles.filter(p => p.created_at?.startsWith(new Date().toISOString().split('T')[0])).length}
                  </div>
                  <div className={styles.dailyLabel}>New Customers</div>
                </div>
              </div>

              {/* Quick bar: order statuses today */}
              {todayOrders.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
                    Today's orders by status
                  </div>
                  {(['pending', 'calculated', 'confirmed', 'delivered'] as const).map(s => {
                    const count = todayOrders.filter(o => o.status === s).length
                    if (count === 0) return null
                    return (
                      <div key={s} className={styles.funnelRow} style={{ marginBottom: 8 }}>
                        <div className={styles.funnelLabel} style={{ width: 70, fontSize: 11 }}>{s}</div>
                        <div className={styles.funnelBarWrap}>
                          <div
                            className={styles.funnelBarFill}
                            style={{
                              width: `${Math.round((count / todayOrders.length) * 100)}%`,
                              background: s === 'delivered' ? 'var(--green)' : s === 'pending' ? 'var(--orange)' : GOLD,
                            }}
                          />
                        </div>
                        <div className={styles.funnelCount}>{count}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
