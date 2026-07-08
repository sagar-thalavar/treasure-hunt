"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDifficultyMarkerColor } from "@/lib/utils";
import type { Difficulty } from "@/lib/types";

const treasureIcon = (color: string) =>
  L.divIcon({
    html: `<div style="
      width:42px;height:42px;background:white;
      border:2.5px solid ${color};border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-size:20px;
      box-shadow:0 2px 12px ${color}44, 0 0 0 6px ${color}18;
    ">💎</div>`,
    className: "", iconSize: [42, 42], iconAnchor: [21, 21],
  });

function FitBounds({ tlat, tlng, ulat, ulng }: { tlat: number; tlng: number; ulat?: number; ulng?: number }) {
  const map = useMap();
  useEffect(() => {
    if (ulat && ulng) {
      map.fitBounds([[tlat, tlng], [ulat, ulng]], { padding: [50, 50] });
    } else {
      map.setView([tlat, tlng], 16);
    }
  }, [map, tlat, tlng, ulat, ulng]);
  return null;
}

interface Props {
  latitude: number; longitude: number;
  radius: number; difficulty: Difficulty;
  userLocation: { lat: number; lng: number } | null;
}

export default function LeafletDetailMap({ latitude, longitude, radius, difficulty, userLocation }: Props) {
  const color = getDifficultyMarkerColor(difficulty);
  return (
    <MapContainer center={[latitude, longitude]} zoom={16}
      style={{ width: "100%", height: "100%" }} zoomControl={false}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd" maxZoom={20}
      />
      <FitBounds tlat={latitude} tlng={longitude} ulat={userLocation?.lat} ulng={userLocation?.lng} />
      <Circle center={[latitude, longitude]} radius={radius}
        pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 2, opacity: 0.7 }} />
      <Marker position={[latitude, longitude]} icon={treasureIcon(color)} />
      {userLocation && (
        <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={8}
          pathOptions={{ color: "#fff", fillColor: "#6D8196", fillOpacity: 1, weight: 2.5 }} />
      )}
    </MapContainer>
  );
}
