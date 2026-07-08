"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  html: `<div style="
    width:42px;height:42px;
    background:white;
    border:2.5px solid #4A4A4A;
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:20px;
    box-shadow:0 2px 12px rgba(74,74,74,0.25), 0 0 0 6px rgba(74,74,74,0.08);
  ">📍</div>`,
  className: "",
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// react-leaflet's <MapContainer center={...}> only applies the `center` prop
// on the very first render — it does NOT recenter the map when the prop
// changes afterwards. Since geolocation always resolves a moment *after*
// the map has already mounted (with the Bangalore fallback center), the
// map was silently staying put and never showing the user's real position.
// This component imperatively calls map.setView() whenever the resolved
// location changes, which is the correct way to recenter an existing map.
function RecenterOnLocate({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

const BANGALORE_CENTER: [number, number] = [12.9716, 77.5946];

export default function LeafletPicker({ onLocationSelected }: { onLocationSelected: (lat: number, lng: number) => void }) {
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      setLocationError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserLocation([p.coords.latitude, p.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  function handlePick(lat: number, lng: number) {
    setPin([lat, lng]);
    onLocationSelected(lat, lng);
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer center={BANGALORE_CENTER} zoom={13} style={{ width: "100%", height: "100%" }} zoomControl>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd" maxZoom={20}
        />
        <ClickHandler onPick={handlePick} />

        {userLocation && <RecenterOnLocate lat={userLocation[0]} lng={userLocation[1]} />}

        {/* "You are here" — live location dot, matches the map/detail views */}
        {userLocation && (
          <CircleMarker
            center={userLocation}
            radius={9}
            pathOptions={{ color: "#fff", fillColor: "#3b82f6", fillOpacity: 1, weight: 2.5 }}
          />
        )}

        {pin && <Marker position={pin} icon={pinIcon} />}
      </MapContainer>

      {locating && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[1000] bg-white/95 text-ink-400 text-xs font-medium rounded-lg px-3 py-2 shadow-card pointer-events-none text-center">
          Finding your location…
        </div>
      )}
      {!locating && locationError && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[1000] bg-white/95 text-ink-400 text-xs font-medium rounded-lg px-3 py-2 shadow-card pointer-events-none text-center">
          Couldn't get your location — showing Bangalore. Enable location access and reload to auto-center.
        </div>
      )}
    </div>
  );
}
