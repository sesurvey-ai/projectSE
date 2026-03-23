'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default icon issue with webpack/Next.js
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const incidentIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface SurveyorLocation {
  user_id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

interface SurveyorMapProps {
  surveyors: SurveyorLocation[];
  incidentLat?: number;
  incidentLng?: number;
  autoFit?: boolean;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  height?: string;
}

function FitBounds({ surveyors, incidentLat, incidentLng }: SurveyorMapProps) {
  const map = useMap();

  useEffect(() => {
    const points: L.LatLngExpression[] = surveyors.map((s) => [s.latitude, s.longitude]);
    if (incidentLat !== undefined && incidentLng !== undefined) {
      points.push([incidentLat, incidentLng]);
    }
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [map, surveyors, incidentLat, incidentLng]);

  return null;
}

export default function SurveyorMap({ surveyors, incidentLat, incidentLng, autoFit = true, defaultCenter, defaultZoom, height = '400px' }: SurveyorMapProps) {
  const center: L.LatLngExpression = defaultCenter
    ? defaultCenter
    : surveyors.length > 0
      ? [surveyors[0].latitude, surveyors[0].longitude]
      : incidentLat !== undefined && incidentLng !== undefined
        ? [incidentLat, incidentLng]
        : [13.7563, 100.5018]; // Bangkok default
  const zoom = defaultZoom ?? 12;

  return (
    <MapContainer center={center} zoom={zoom} style={{ width: '100%', height, borderRadius: '0.5rem' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {autoFit && <FitBounds surveyors={surveyors} incidentLat={incidentLat} incidentLng={incidentLng} />}

      {surveyors.map((s) => (
        <Marker key={s.user_id} position={[s.latitude, s.longitude]}>
          <Popup>
            <strong>{s.first_name ? `${s.first_name} ${s.last_name || ''}` : s.username}</strong>
            {s.distance !== undefined && <br />}
            {s.distance !== undefined && `ระยะทาง: ${s.distance.toFixed(2)} กม.`}
          </Popup>
        </Marker>
      ))}

      {incidentLat !== undefined && incidentLng !== undefined && (
        <Marker position={[incidentLat, incidentLng]} icon={incidentIcon}>
          <Popup><strong>จุดเกิดเหตุ</strong></Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
