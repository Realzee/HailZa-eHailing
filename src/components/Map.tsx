import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers } from 'lucide-react';

// Modern SVG Strings for Icons
const carSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
const userSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const destinationSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

const createModernIcon = (svg: string, bgClass: string) => {
  return L.divIcon({
    html: `<div class="flex items-center justify-center w-10 h-10 rounded-full shadow-lg border-2 border-white ${bgClass} transition-transform hover:scale-110">${svg}</div>`,
    className: 'custom-leaflet-icon bg-transparent border-none',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

const carIcon = createModernIcon(carSvg, 'bg-gray-900');
const userIcon = createModernIcon(userSvg, 'bg-blue-600');
const destinationIcon = createModernIcon(destinationSvg, 'bg-hail-green');

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface MapProps {
  center: [number, number];
  markers?: Array<{
    position: [number, number];
    title?: string;
    type?: 'user' | 'driver' | 'destination';
    rotation?: number;
  }>;
  route?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
  interactive?: boolean;
}

export default function Map({ center, markers = [], route, onMapClick, interactive = true }: MapProps) {
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        {mapStyle === 'streets' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        
        <MapController center={center} />

        {/* Click Handler */}
        {onMapClick && <MapClickHandler onClick={onMapClick} />}

        {/* Markers */}
        {markers.map((marker, idx) => {
          let icon = userIcon;
          if (marker.type === 'driver') icon = carIcon;
          if (marker.type === 'destination') icon = destinationIcon;

          return (
            <Marker
              key={idx}
              position={marker.position}
              icon={icon}
            >
              {marker.title && <Popup className="font-sans font-bold">{marker.title}</Popup>}
            </Marker>
          );
        })}

        {/* Route Polyline */}
        {route && route.length > 0 && (
          <Polyline positions={route} color="#000000" weight={4} opacity={0.8} dashArray="10, 10" />
        )}
      </MapContainer>

      {/* Satellite Toggle Button */}
      <button
        onClick={() => setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')}
        className="absolute top-4 right-4 z-10 bg-white p-3 rounded-2xl shadow-xl border border-gray-100 hover:bg-gray-50 transition-all active:scale-95 group"
        title="Toggle Map Style"
      >
        <Layers size={20} className="text-gray-700 group-hover:text-hail-green transition-colors" />
      </button>
    </div>
  );
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    map.on('click', (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    });
    return () => {
      map.off('click');
    };
  }, [map, onClick]);
  return null;
}
