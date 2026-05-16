'use client'
import { useState, useMemo } from 'react'
import type { Order } from '@/lib/types'
import { STATUS_CONFIG } from '@/lib/constants'
import styles from './AdminExport.module.css'

const COUNTRY_DOMAINS: Record<string, string[]> = {
  USA:    ['amazon.', 'ebay.', 'walmart.', 'target.', 'bestbuy.', 'newegg.', 'etsy.', 'macys.', 'nordstrom.', 'samsclub.'],
  Turkey: ['trendyol.', 'lcwaikiki.', 'hepsiburada.', 'n11.', 'ciceksepeti.'],
  China:  ['alibaba.', 'aliexpress.', 'taobao.', '1688.', 'jd.', 'shein.'],
  UAE:    ['noon.', 'namshi.', 'ounass.', 'sharafdg.', 'sivvi.'],
}

function detectCountry(url: string): string {
  const u = url.toLowerCase()
  for (const [country, domains] of Object.entries(COUNTRY_DOMAINS)) {
    if (domains.some(d => u.includes(d))) return country
  }
  return 'Other'
}

function escapeCSV(val: unknown): string {
  const s = String(val ?? '').replace(/"/g, '""')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
}

const COUNTRY_OPTS = ['All', 'USA', 'Turkey', 'UAE', 'China']
const STATUS_OPTS = ['all', ...Object.keys(STATUS_CONFIG)]

interface Props {
  orders: Order[]
  onClose: () => void
}

export default function AdminExport({ orders, onClose }: Props) {
  const [country, setCountry] = useState('All')
  const [status, setStatus]   = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const filtered = useMemo(() => {
    return orders
      .filter(o => {
        const c = detectCountry(o.url)
        if (country !== 'All' && c !== country) return false
        if (status !== 'all' && o.status !== status) return false
        if (dateFrom && new Date(o.created_at).getTime() < new Date(dateFrom).getTime()) return false
        if (dateTo && new Date(o.created_at).getTime() > new Date(dateTo + 'T23:59:59').getTime()) return false
        return true
      })
      .map(o => ({ ...o, _country: detectCountry(o.url) }))
  }, [orders, country, status, dateFrom, dateTo])

  const exportCSV = () => {
    const headers = [
      'Order ID', 'Customer Name', 'URL', 'Description', 'Category',
      'Qty', 'Item Price', 'Shipping Price', 'Weight', 'Status', 'Country', 'Date',
    ]
    const rows = filtered.map(o => [
      o.id,
      o.profiles?.full_name ?? '',
      o.url,
      o.description,
      o.category,
      o.qty,
      o.item_price ? `${o.item_price} ${o.item_price_currency}` : '',
      o.shipping_price ? `${o.shipping_price} ${o.shipping_currency}` : '',
      o.weight ?? '',
      STATUS_CONFIG[o.status]?.label ?? o.status,
      o._country,
      o.created_at?.split('T')[0] ?? '',
    ].map(escapeCSV).join(','))

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `shipiq-orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(href)
  }

  const exportPDF = () => {
    const byCountry: Record<string, typeof filtered> = {}
    for (const o of filtered) {
      if (!byCountry[o._country]) byCountry[o._country] = []
      byCountry[o._country].push(o)
    }

    const filterDesc = [
      country !== 'All' ? country : null,
      status !== 'all' ? (STATUS_CONFIG[status]?.label ?? status) : null,
      dateFrom ? `from ${dateFrom}` : null,
      dateTo   ? `to ${dateTo}` : null,
    ].filter(Boolean).join(' · ')

    const tableRows = (group: typeof filtered) =>
      group.map(o => `
        <tr>
          <td>${o.id}</td>
          <td>${o.profiles?.full_name ?? '—'}</td>
          <td style="max-width:180px;word-break:break-word">${o.description}</td>
          <td>${o.category}</td>
          <td>${o.qty}</td>
          <td>${o.item_price ? `${o.item_price} ${o.item_price_currency}` : '—'}</td>
          <td>${o.shipping_price ? `${o.shipping_price.toLocaleString()} ${o.shipping_currency}` : '—'}</td>
          <td>${o.weight ?? '—'}</td>
          <td>${STATUS_CONFIG[o.status]?.label ?? o.status}</td>
          <td>${o.created_at?.split('T')[0] ?? ''}</td>
        </tr>`).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ShipIQ Orders Export</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; }
    h1 { font-size: 22px; font-weight: 800; color: #c9a84c; margin-bottom: 4px; }
    .meta { color: #666; font-size: 11px; margin-bottom: 28px; }
    h2 { font-size: 13px; font-weight: 700; border-bottom: 2px solid #c9a84c; padding-bottom: 5px; margin: 24px 0 10px; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #f4f4f4; text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #ddd; }
    td { padding: 6px 8px; border: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) { background: #fafafa; }
    @media print { @page { margin: 16mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <h1>ShipIQ — Orders Export</h1>
  <div class="meta">
    Generated ${new Date().toLocaleString()} ·
    <strong>${filtered.length}</strong> order${filtered.length !== 1 ? 's' : ''}
    ${filterDesc ? ` · ${filterDesc}` : ''}
  </div>
  ${Object.entries(byCountry).map(([c, group]) => `
    <h2>${c} &nbsp;(${group.length})</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Customer</th><th>Description</th><th>Category</th>
          <th>Qty</th><th>Item Price</th><th>Shipping</th><th>Weight</th>
          <th>Status</th><th>Date</th>
        </tr>
      </thead>
      <tbody>${tableRows(group)}</tbody>
    </table>`).join('')}
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        <div className={styles.header}>
          <div className={styles.title}>📤 Export Orders</div>
          <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Country</div>
            <div className={styles.pills}>
              {COUNTRY_OPTS.map(c => (
                <button key={c} className={`${styles.pill} ${country === c ? styles.pillActive : ''}`} onClick={() => setCountry(c)}>{c}</button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Status</div>
            <div className={styles.pills}>
              {STATUS_OPTS.map(s => (
                <button key={s} className={`${styles.pill} ${status === s ? styles.pillActive : ''}`} onClick={() => setStatus(s)}>
                  {s === 'all' ? 'All' : `${STATUS_CONFIG[s]?.icon} ${STATUS_CONFIG[s]?.label}`}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Date Range</div>
            <div className={styles.dateRow}>
              <div className={styles.dateField}>
                <label className={styles.dateLabel}>From</label>
                <input type="date" className={styles.dateInput} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className={styles.dateField}>
                <label className={styles.dateLabel}>To</label>
                <input type="date" className={styles.dateInput} value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>

          <div className={styles.count}>
            {filtered.length === 0
              ? 'No orders match these filters'
              : <><span className={styles.countHighlight}>{filtered.length}</span> order{filtered.length !== 1 ? 's' : ''} ready to export</>}
          </div>

          <div className={styles.actions}>
            <button className={styles.btnCSV} onClick={exportCSV} disabled={filtered.length === 0}>
              📊 Export CSV
            </button>
            <button className={styles.btnPDF} onClick={exportPDF} disabled={filtered.length === 0}>
              🖨️ Export PDF
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
