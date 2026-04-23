import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Navigation, MapPin, User, TriangleAlert } from 'lucide-react';

// Icons using Lucide via renderToString would be complex, let's use refined SVGs
const carSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
const userSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const destinationSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
const hazardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

const createPremiumIcon = (svg: string, color: string) => {
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center p-2 group">
        <div class="absolute inset-0 bg-white/40 dark:bg-navy/40 backdrop-blur-md rounded-2xl border-2 shadow-2xl transition-all duration-500 group-hover:scale-110 group-active:scale-95" style="border-color: ${color}; box-shadow: 0 10px 25px -5px ${color}40"></div>
        <div class="relative flex items-center justify-center w-7 h-7" style="color: ${color}">
          ${svg}
        </div>
        <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-b-2 border-r-2 bg-white dark:bg-navy border-inherit" style="border-color: ${color}"></div>
      </div>
    `,
    className: 'premium-map-icon',
    iconSize: [48, 52],
    iconAnchor: [24, 52],
    popupAnchor: [0, -52],
  });
};

// Colors from our theme
const carIcon = createPremiumIcon(carSvg, '#0f172a'); // Navy (Professional Blue)
const userIcon = createPremiumIcon(userSvg, '#0ea5e9'); // Sky Bright (Primary Action)
const destinationIcon = createPremiumIcon(destinationSvg, '#0ea5e9'); // Sky Bright (Objective)
const hazardIcon = createPremiumIcon(hazardSvg, '#ef4444'); // Red (Danger)

function MapController({ center, route }: { center: [number, number], route?: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.length > 0) {
      const bounds = L.latLngBounds(route);
      map.flyToBounds(bounds, { padding: [80, 80], duration: 1.5 });
    } else {
      map.flyTo(center, map.getZoom(), { duration: 1 });
    }
  }, [center, route, map]);
  return null;
}

interface MapProps {
  center: [number, number];
  markers?: Array<{
    position: [number, number];
    title?: string;
    type?: 'user' | 'driver' | 'destination' | 'hazard';
    rotation?: number;
    draggable?: boolean;
    onDragEnd?: (lat: number, lng: number) => void;
  }>;
  route?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
  interactive?: boolean;
}

export default function Map({ center, markers = [], route, onMapClick, interactive = true }: MapProps) {
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-navy">
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={false}
        className="w-full h-full z-0 transition-opacity duration-500"
      >
        {mapStyle === 'streets' ? (
          <TileLayer
            key={isDarkMode ? 'dark' : 'light'}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={isDarkMode 
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            }
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        
        <MapController center={center} route={route} />

        {/* Click Handler */}
        {onMapClick && <MapClickHandler onClick={onMapClick} />}

        {/* Markers */}
        {markers.map((marker, idx) => {
          let icon = userIcon;
          if (marker.type === 'driver') icon = carIcon;
          if (marker.type === 'destination') icon = destinationIcon;
          if (marker.type === 'hazard') icon = hazardIcon;

          return (
            <Marker
              key={idx}
              position={marker.position}
              icon={icon}
              draggable={marker.draggable}
              eventHandlers={{
                dragend: (e) => {
                  if (marker.onDragEnd) {
                    const m = e.target;
                    const position = m.getLatLng();
                    marker.onDragEnd(position.lat, position.lng);
                  }
                }
              }}
            >
              {marker.title && (
                <Popup className="premium-popup">
                  <div className="p-1 text-center">
                    <p className="font-display font-black text-sm tracking-tight text-navy dark:text-white mb-0 uppercase">{marker.title}</p>
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}

        {/* Route Polyline */}
        {route && route.length > 0 && (
          <Polyline 
            positions={route} 
            color={isDarkMode ? "#0ea5e9" : "#0ea5e9"} 
            weight={6} 
            opacity={0.6} 
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapContainer>

      {/* Satellite Toggle Button */}
      <button
        onClick={() => setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')}
        className="absolute top-24 right-6 z-10 glass p-3.5 rounded-2xl shadow-2xl border-white/40 dark:border-white/5 hover:scale-110 active:scale-95 transition-all text-navy dark:text-white"
        title="Toggle Map Style"
      >
        <Layers size={22} />
      </button>

      <style dangerouslySetInnerHTML={{ __html: `
        .premium-popup .leaflet-popup-content-wrapper {
          background: rgba(255, 255, 255, 0.9);
          border-radius: 1rem;
          padding: 0;
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .dark .premium-popup .leaflet-popup-content-wrapper {
          background: rgba(2, 6, 23, 0.9);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .premium-popup .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.9);
        }
        .dark .premium-popup .leaflet-popup-tip {
          background: rgba(2, 6, 23, 0.9);
        }
        .leaflet-container {
          background: transparent !important;
        }
      `}} />
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
