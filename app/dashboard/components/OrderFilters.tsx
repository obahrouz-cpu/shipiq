'use client'
import { useState, useEffect } from 'react'
import styles from './OrderFilters.module.css'

// ── Public types ──────────────────────────────────────────────────────────────

export interface OrderFiltersState {
  status: string        // 'all' | 'pending' | 'calculated' | 'confirmed' | 'ordered' | 'warehouse' | 'transit' | 'arrived' | 'delivered' | 'rejected'
  category: string      // 'All' | specific category
  dateRange: string     // 'all' | '7d' | '30d' | '3m'
  sort: string          // 'newest' | 'oldest' | 'price-high' | 'price-low'
  country: string       // admin: 'All' | 'USA' | 'Turkey' | 'China' | 'UAE'
  customerSearch: string
  urgency: string       // 'all' | 'urgent' | 'normal'
  dateFrom: string
  dateTo: string
}

export const DEFAULT_FILTERS: OrderFiltersState = {
  status: 'all',
  category: 'All',
  dateRange: 'all',
  sort: 'newest',
  country: 'All',
  customerSearch: '',
  urgency: 'all',
  dateFrom: '',
  dateTo: '',
}

// ── Option lists ──────────────────────────────────────────────────────────────

const STATUS_OPTS = [
  { v: 'all',       l: 'All' },
  { v: 'pending',   l: '⏳ Pending' },
  { v: 'calculated',l: '💰 Calculated' },
  { v: 'confirmed', l: '✅ Confirmed' },
  { v: 'ordered',   l: '🛒 Ordered' },
  { v: 'warehouse', l: '🏭 At Warehouse' },
  { v: 'transit',   l: '✈️ In Transit' },
  { v: 'arrived',   l: '🏙️ Arrived' },
  { v: 'delivered', l: '📬 Delivered' },
  { v: 'rejected',  l: '❌ Rejected' },
]

const CATEGORY_OPTS = ['All', 'Electronics', 'Clothing', 'Cosmetics', 'Home', 'Gaming', 'Shoes', 'Sports', 'Other']

const DATE_OPTS = [
  { v: 'all', l: 'All Time' },
  { v: '7d', l: 'Last 7 days' },
  { v: '30d', l: 'Last 30 days' },
  { v: '3m', l: 'Last 3 months' },
]

const SORT_OPTS = [
  { v: 'newest', l: 'Newest first' },
  { v: 'oldest', l: 'Oldest first' },
  { v: 'price-high', l: 'Price high to low' },
  { v: 'price-low', l: 'Price low to high' },
]

const COUNTRY_OPTS = ['All', 'USA', 'Turkey', 'China', 'UAE']

const URGENCY_OPTS = [
  { v: 'all', l: 'All' },
  { v: 'urgent', l: '⚡ Urgent only' },
  { v: 'normal', l: 'Normal only' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function countActive(v: OrderFiltersState, isAdmin: boolean): number {
  let n = 0
  if (v.status !== 'all') n++
  if (v.category !== 'All') n++
  if (v.dateRange !== 'all') n++
  if (v.sort !== 'newest') n++
  if (isAdmin) {
    if (v.country !== 'All') n++
    if (v.customerSearch.trim()) n++
    if (v.urgency !== 'all') n++
    if (v.dateFrom) n++
    if (v.dateTo) n++
  }
  return n
}

function buildChips(v: OrderFiltersState, isAdmin: boolean) {
  const chips: Array<{ key: keyof OrderFiltersState; label: string }> = []
  if (v.status !== 'all') chips.push({ key: 'status', label: `Status: ${v.status}` })
  if (v.category !== 'All') chips.push({ key: 'category', label: `Category: ${v.category}` })
  if (v.dateRange !== 'all') chips.push({ key: 'dateRange', label: DATE_OPTS.find(d => d.v === v.dateRange)?.l ?? v.dateRange })
  if (v.sort !== 'newest') chips.push({ key: 'sort', label: SORT_OPTS.find(s => s.v === v.sort)?.l ?? v.sort })
  if (isAdmin) {
    if (v.country !== 'All') chips.push({ key: 'country', label: `Country: ${v.country}` })
    if (v.customerSearch.trim()) chips.push({ key: 'customerSearch', label: `Customer: ${v.customerSearch}` })
    if (v.urgency !== 'all') chips.push({ key: 'urgency', label: v.urgency === 'urgent' ? '⚡ Urgent only' : 'Normal only' })
    if (v.dateFrom) chips.push({ key: 'dateFrom', label: `From: ${v.dateFrom}` })
    if (v.dateTo) chips.push({ key: 'dateTo', label: `To: ${v.dateTo}` })
  }
  return chips
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`${styles.pill} ${active ? styles.pillActive : ''}`} onClick={onClick}>
      {label}
    </button>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </div>
  )
}

// ── Funnel icon ───────────────────────────────────────────────────────────────

function FunnelIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface OrderFiltersProps {
  isAdmin: boolean
  value: OrderFiltersState
  onChange: (v: OrderFiltersState) => void
}

export default function OrderFilters({ isAdmin, value, onChange }: OrderFiltersProps) {
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(value.customerSearch)

  // Sync when parent resets filters (e.g. clearAll)
  useEffect(() => { setSearchInput(value.customerSearch) }, [value.customerSearch])

  // Debounce customer search propagation (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== value.customerSearch) {
        onChange({ ...value, customerSearch: searchInput })
      }
    }, 300)
    return () => clearTimeout(timer)
  // value and onChange intentionally omitted to prevent re-trigger loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const activeCount = countActive(value, isAdmin)
  const chips = buildChips(value, isAdmin)

  const set = <K extends keyof OrderFiltersState>(key: K, val: OrderFiltersState[K]) =>
    onChange({ ...value, [key]: val })

  const resetKey = (key: keyof OrderFiltersState) =>
    onChange({ ...value, [key]: DEFAULT_FILTERS[key] })

  const clearAll = () => onChange(DEFAULT_FILTERS)

  return (
    <div className={styles.wrap}>

      {/* ── Top row ── */}
      <div className={styles.topRow}>
        <button
          className={[
            styles.filterBtn,
            open ? styles.filterBtnOpen : '',
            activeCount > 0 ? styles.filterBtnActive : '',
          ].join(' ')}
          onClick={() => setOpen(o => !o)}
        >
          <FunnelIcon />
          Filters
          {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
        </button>

        {activeCount > 0 && (
          <button className={styles.clearAllBtn} onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      {/* ── Collapsible panel ── */}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.panelInner}>

          <Section label="Status">
            <div className={styles.pills}>
              {STATUS_OPTS.map(o => (
                <Pill key={o.v} label={o.l} active={value.status === o.v} onClick={() => set('status', o.v)} />
              ))}
            </div>
          </Section>

          <Section label="Category">
            <div className={styles.pills}>
              {CATEGORY_OPTS.map(cat => (
                <Pill key={cat} label={cat} active={value.category === cat} onClick={() => set('category', cat)} />
              ))}
            </div>
          </Section>

          <Section label="Date">
            <div className={styles.pills}>
              {DATE_OPTS.map(o => (
                <Pill key={o.v} label={o.l} active={value.dateRange === o.v} onClick={() => set('dateRange', o.v)} />
              ))}
            </div>
          </Section>

          <Section label="Sort by">
            <div className={styles.pills}>
              {SORT_OPTS.map(o => (
                <Pill key={o.v} label={o.l} active={value.sort === o.v} onClick={() => set('sort', o.v)} />
              ))}
            </div>
          </Section>

          {isAdmin && (
            <>
              <Section label="Country of origin">
                <div className={styles.pills}>
                  {COUNTRY_OPTS.map(c => (
                    <Pill key={c} label={c} active={value.country === c} onClick={() => set('country', c)} />
                  ))}
                </div>
              </Section>

              <Section label="Customer name">
                <input
                  className={styles.input}
                  placeholder="Search by name..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                />
              </Section>

              <Section label="Urgency">
                <div className={styles.pills}>
                  {URGENCY_OPTS.map(o => (
                    <Pill key={o.v} label={o.l} active={value.urgency === o.v} onClick={() => set('urgency', o.v)} />
                  ))}
                </div>
              </Section>

              <Section label="Date range">
                <div className={styles.dateRow}>
                  <div className={styles.dateField}>
                    <label className={styles.dateLabel}>From</label>
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={value.dateFrom}
                      onChange={e => set('dateFrom', e.target.value)}
                    />
                  </div>
                  <div className={styles.dateField}>
                    <label className={styles.dateLabel}>To</label>
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={value.dateTo}
                      onChange={e => set('dateTo', e.target.value)}
                    />
                  </div>
                </div>
              </Section>
            </>
          )}

        </div>
      </div>

      {/* ── Active filter chips ── */}
      {chips.length > 0 && (
        <div className={styles.chipsRow}>
          {chips.map(chip => (
            <span key={chip.key} className={styles.chip}>
              {chip.label}
              <button
                className={styles.chipRemove}
                onClick={() => resetKey(chip.key)}
                aria-label={`Remove ${chip.label} filter`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

    </div>
  )
}
