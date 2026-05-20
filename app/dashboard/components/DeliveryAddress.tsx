'use client'
import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { updateProfile } from '@/lib/api'
import type { Profile } from '@/lib/types'

const MapPicker = dynamic(() => import('./MapPicker'), { ssr: false })

const DEFAULT_LAT = 33.3152
const DEFAULT_LNG = 44.3661
const IRAQ_CITIES = ['Erbil', 'Baghdad', 'Sulaymaniyah', 'Kirkuk', 'Basra', 'Mosul', 'Other']

interface Props {
  profile: Profile
  onSaved?: (updates: Partial<Profile>) => void
  onClose?: () => void
  compact?: boolean
}

type Mode = 'idle' | 'requesting' | 'map' | 'manual' | 'view'

async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; city: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.county ||
      data.address?.state ||
      ''
    return { address: data.display_name || '', city }
  } catch {
    return { address: '', city: '' }
  }
}

export default function DeliveryAddress({ profile, onSaved, onClose, compact = false }: Props) {
  const hasAddress = !!(profile.delivery_lat && profile.delivery_lng)
  const [mode, setMode] = useState<Mode>(hasAddress ? 'view' : 'idle')
  const [lat, setLat] = useState(profile.delivery_lat || DEFAULT_LAT)
  const [lng, setLng] = useState(profile.delivery_lng || DEFAULT_LNG)
  const [address, setAddress] = useState(profile.delivery_address || '')
  const [city, setCity] = useState(profile.delivery_city || '')
  const [notes, setNotes] = useState(profile.delivery_notes || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMapMove = useCallback((newLat: number, newLng: number) => {
    setLat(newLat)
    setLng(newLng)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const geo = await reverseGeocode(newLat, newLng)
      if (geo.address) setAddress(geo.address)
      if (geo.city) setCity(geo.city)
    }, 800)
  }, [])

  async function requestLocation() {
    setMode('requesting')
    if (!navigator.geolocation) { setMode('manual'); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newLat = pos.coords.latitude
        const newLng = pos.coords.longitude
        setLat(newLat)
        setLng(newLng)
        const geo = await reverseGeocode(newLat, newLng)
        if (geo.address) setAddress(geo.address)
        if (geo.city) setCity(geo.city)
        setMode('map')
      },
      () => setMode('manual')
    )
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    const updates = {
      delivery_lat: lat,
      delivery_lng: lng,
      delivery_address: address,
      delivery_city: city,
      delivery_notes: notes,
    }
    const { error } = await updateProfile(profile.id, updates)
    setSaving(false)
    if (error) {
      setMsg({ ok: false, text: error })
    } else {
      setMsg({ ok: true, text: 'Address saved!' })
      setMode('view')
      onSaved?.(updates)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const inp = (v: string, set: (s: string) => void, ph: string, textarea = false) => {
    const base: React.CSSProperties = {
      width: '100%', padding: '10px 12px', fontSize: 13,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, color: 'var(--text)', outline: 'none',
      boxSizing: 'border-box', resize: 'none',
    }
    if (textarea) return (
      <textarea value={v} onChange={e => set(e.target.value)} placeholder={ph}
        rows={2} style={base} />
    )
    return (
      <input value={v} onChange={e => set(e.target.value)} placeholder={ph} style={base} />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── VIEW mode ── */}
      {mode === 'view' && (
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>📍 Saved Location</div>
            <button onClick={() => setMode('map')} style={{
              fontSize: 11, padding: '3px 10px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text-dim)', cursor: 'pointer',
            }}>Edit</button>
          </div>
          <div style={{ height: 160, marginBottom: 10, borderRadius: 8, overflow: 'hidden' }}>
            <MapPicker lat={lat} lng={lng} height={160} readOnly />
          </div>
          {address && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>{address}</div>}
          {city && <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>City: {city}</div>}
          {notes && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, fontStyle: 'italic' }}>{notes}</div>}
        </div>
      )}

      {/* ── IDLE mode ── */}
      {mode === 'idle' && (
        <div style={{
          background: 'var(--surface2)', border: '1px dashed var(--border)',
          borderRadius: 12, padding: '20px 16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📍</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No delivery address saved</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14 }}>
            Set your location for home delivery orders
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={requestLocation} style={{
              padding: '9px 16px', fontSize: 12, fontWeight: 700,
              background: 'var(--gold)', color: 'var(--bg)',
              border: 'none', borderRadius: 8, cursor: 'pointer',
            }}>
              Use My GPS Location
            </button>
            <button onClick={() => setMode('manual')} style={{
              padding: '9px 16px', fontSize: 12, fontWeight: 600,
              background: 'transparent', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
            }}>
              Enter Manually
            </button>
          </div>
        </div>
      )}

      {/* ── REQUESTING mode ── */}
      {mode === 'requesting' && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: 13 }}>
          Requesting location...
        </div>
      )}

      {/* ── MAP mode ── */}
      {mode === 'map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
            Drag the pin or tap the map to set your location
          </div>
          <div style={{ borderRadius: 10, overflow: 'hidden' }}>
            <MapPicker lat={lat} lng={lng} onMove={handleMapMove} height={260} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inp(address, setAddress, 'Address (auto-filled from map)')}
            <select value={IRAQ_CITIES.includes(city) ? city : 'Other'} onChange={e => setCity(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 13,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text)', outline: 'none',
              }}>
              <option value="">Select city</option>
              {IRAQ_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {inp(notes, setNotes, 'Delivery notes (building, floor, landmark...)', true)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMode(hasAddress ? 'view' : 'idle')} style={{
              flex: 1, padding: '10px', fontSize: 13, background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text-dim)', cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{
              flex: 2, padding: '10px', fontSize: 13, fontWeight: 700,
              background: 'var(--gold)', color: 'var(--bg)',
              border: 'none', borderRadius: 8,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Saving...' : 'Save Location'}</button>
          </div>
        </div>
      )}

      {/* ── MANUAL mode ── */}
      {mode === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Enter Address Manually</div>
          {inp(address, setAddress, 'Street address')}
          <select value={IRAQ_CITIES.includes(city) ? city : ''} onChange={e => setCity(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 13,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', outline: 'none',
            }}>
            <option value="">Select city</option>
            {IRAQ_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {inp(notes, setNotes, 'Delivery notes (building, floor, landmark...)', true)}
          <button onClick={() => setMode('map')} style={{
            fontSize: 12, color: 'var(--gold)', background: 'transparent',
            border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
          }}>
            Show on map instead
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMode(hasAddress ? 'view' : 'idle')} style={{
              flex: 1, padding: '10px', fontSize: 13, background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text-dim)', cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{
              flex: 2, padding: '10px', fontSize: 13, fontWeight: 700,
              background: 'var(--gold)', color: 'var(--bg)',
              border: 'none', borderRadius: 8,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Saving...' : 'Save Address'}</button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ fontSize: 12, color: msg.ok ? '#16a34a' : '#ef4444', textAlign: 'center' }}>
          {msg.text}
        </div>
      )}

    </div>
  )
}
