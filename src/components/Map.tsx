import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons
const carIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3097/3097136.png', // Simple car icon
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const userIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png', // User icon
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

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
  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom={interactive}
      dragging={interactive}
      zoomControl={false}
      className="w-full h-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapController center={center} />

      {/* Click Handler */}
      {onMapClick && <MapClickHandler onClick={onMapClick} />}

      {/* Markers */}
      {markers.map((marker, idx) => (
        <Marker
          key={idx}
          position={marker.position}
          icon={marker.type === 'driver' ? carIcon : userIcon}
        >
          {marker.title && <Popup>{marker.title}</Popup>}
        </Marker>
      ))}

      {/* Route Polyline */}
      {route && route.length > 0 && (
        <Polyline positions={route} color="#006400" weight={5} opacity={0.8} />
      )}
    </MapContainer>
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
