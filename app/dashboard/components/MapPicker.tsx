'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const goldIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:20px;height:20px;border-radius:50%;
    background:radial-gradient(circle at 35% 35%,#f5d87a,#c9a84c);
    border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

function MapCenterer({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng]) }, [lat, lng, map])
  return null
}

function ClickHandler({ onMove, readOnly }: { onMove?: (lat: number, lng: number) => void; readOnly: boolean }) {
  useMapEvents({
    click(e) {
      if (!readOnly && onMove) onMove(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

interface Props {
  lat: number
  lng: number
  onMove?: (lat: number, lng: number) => void
  height?: number
  readOnly?: boolean
}

export default function MapPicker({ lat, lng, onMove, height = 300, readOnly = false }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={13}
      style={{ height, width: '100%', borderRadius: 10 }}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <MapCenterer lat={lat} lng={lng} />
      <ClickHandler onMove={onMove} readOnly={readOnly} />
      <Marker
        position={[lat, lng]}
        icon={goldIcon}
        draggable={!readOnly}
        eventHandlers={{
          dragend(e) {
            if (!readOnly && onMove) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const ll = (e.target as any).getLatLng()
              onMove(ll.lat, ll.lng)
            }
          },
        }}
      />
    </MapContainer>
  )
}
