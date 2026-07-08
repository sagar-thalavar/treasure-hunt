"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Treasure } from "@/lib/types";
import { getDifficultyMarkerColor, getRewardTypeLabel } from "@/lib/utils";

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function createTreasureIcon(color: string) {
  return L.divIcon({
    html: `<div style="
      width:38px;height:38px;
      background:white;
      border:2.5px solid ${color};
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:18px;
      box-shadow:0 2px 8px ${color}55, 0 0 0 4px ${color}18;
      cursor:pointer;
    ">💎</div>`,
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

interface LeafletMapProps {
  treasures: Treasure[];
  userLocation: { lat: number; lng: number } | null;
}

export default function LeafletMap({ treasures, userLocation }: LeafletMapProps) {
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [12.9716, 77.5946];

  return (
    <MapContainer center={center} zoom={14} style={{ width: "100%", height: "100%" }} zoomControl>
      {userLocation && <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />}

      <TileLayer url={TILE_URL} attribution={TILE_ATTR} subdomains="abcd" maxZoom={20} />

      {/* User dot */}
      {userLocation && (
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={9}
          pathOptions={{ color: "#fff", fillColor: "#6D8196", fillOpacity: 1, weight: 2.5 }}
        />
      )}

      {/* Treasure markers */}
      {treasures.map((t) => {
        const color = getDifficultyMarkerColor(t.difficulty);
        return (
          <Marker key={t.id} position={[t.latitude, t.longitude]} icon={createTreasureIcon(color)}>
            <Popup>
              <div style={{ minWidth: 190, fontFamily: "Inter, system-ui, sans-serif" }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: "#4A4A4A", marginBottom: 4 }}>{t.title}</p>
                <p style={{ fontSize: 12, color: "#6D8196", marginBottom: 10, textTransform: "capitalize" }}>
                  {t.difficulty} · {t.reward_type ? getRewardTypeLabel(t.reward_type) : "Points"}
                </p>
                <a href={`/treasure/${t.id}`} style={{
                  display: "block", textAlign: "center",
                  background: "#4A4A4A", color: "#FFFFE3",
                  fontWeight: 600, fontSize: 12,
                  padding: "9px 14px", borderRadius: 10, textDecoration: "none",
                }}>
                  Hunt This →
                </a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
