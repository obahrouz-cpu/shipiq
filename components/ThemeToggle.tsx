'use client'
import { useState, useEffect } from 'react'

export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('shipiq_theme')
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored)
    } else {
      const sys = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
      setTheme(sys)
    }
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('shipiq_theme', next)
    document.documentElement.setAttribute('data-theme', next)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      style={{
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: 16,
        color: 'var(--text-muted)',
        transition: 'all 0.18s',
        display: 'flex',
        alignItems: 'center',
        ...style,
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
