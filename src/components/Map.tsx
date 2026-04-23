import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Navigation, MapPin, User, TriangleAlert } from 'lucide-react';

// Premium SVGs with higher detail
const carSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h1c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="16" r="2"/></svg>`;
const userSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;
const destinationSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
const hazardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;

const createPremiumIcon = (svg: string, color: string, variant: 'pin' | 'dot' | 'vehicle' = 'pin') => {
  const isDot = variant === 'dot';
  const isVehicle = variant === 'vehicle';
  
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center p-2 group">
        ${isDot ? `
          <div class="absolute inset-0 bg-white/40 dark:bg-navy/40 backdrop-blur-md rounded-full border-2 shadow-2xl transition-all duration-500 group-hover:scale-110" style="border-color: ${color}"></div>
          <div class="absolute inset-0 rounded-full animate-ping opacity-20" style="background-color: ${color}"></div>
          <div class="relative flex items-center justify-center w-6 h-6" style="color: ${color}">
            ${svg}
          </div>
        ` : isVehicle ? `
          <div class="absolute inset-0 bg-white dark:bg-navy backdrop-blur-lg rounded-[1.25rem] border-2 shadow-2xl transition-all duration-300 group-hover:scale-110 group-active:scale-95 flex items-center justify-center" style="border-color: ${color}">
            <div class="absolute inset-0 opacity-10 bg-gradient-to-br from-white to-transparent dark:from-white/20 dark:to-transparent rounded-[1.25rem]"></div>
            <div class="relative flex items-center justify-center w-6 h-6" style="color: ${color}">
              ${svg}
            </div>
          </div>
          <div class="absolute -bottom-1 w-2.5 h-2.5 rotate-45 border-b-2 border-r-2 bg-white dark:bg-navy" style="border-color: ${color}"></div>
        ` : `
          <div class="absolute inset-0 bg-white dark:bg-navy backdrop-blur-lg rounded-full border-2 shadow-2xl transition-all duration-500 group-hover:scale-110 group-active:scale-95" style="border-color: ${color}; box-shadow: 0 10px 25px -5px ${color}40"></div>
          <div class="relative flex items-center justify-center w-7 h-7" style="color: ${color}">
            ${svg}
          </div>
          <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-b-2 border-r-2 bg-white dark:bg-navy" style="border-color: ${color}"></div>
        `}
      </div>
    `,
    className: 'premium-map-icon',
    iconSize: isDot ? [36, 36] : [48, 52],
    iconAnchor: isDot ? [18, 18] : [24, 52],
    popupAnchor: isDot ? [0, -18] : [0, -52],
  });
};

// Colors and refined icon variants
const carIcon = createPremiumIcon(carSvg, '#0f172a', 'vehicle'); // Navy Vehicle
const userIcon = createPremiumIcon(userSvg, '#0ea5e9', 'dot'); // Pulsing Sky Dot
const destinationIcon = createPremiumIcon(destinationSvg, '#0ea5e9', 'pin'); // Sky Pin
const hazardIcon = createPremiumIcon(hazardSvg, '#ef4444', 'pin'); // Red Pin

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

        {/* Route Polyline with Glow Effect */}
        {route && route.length > 0 && (
          <>
            <Polyline 
              positions={route} 
              color={isDarkMode ? "#0ea5e9" : "#0ea5e9"} 
              weight={10} 
              opacity={0.15} 
              lineCap="round"
              lineJoin="round"
            />
            <Polyline 
              positions={route} 
              color={isDarkMode ? "#0ea5e9" : "#0ea5e9"} 
              weight={4} 
              opacity={0.8} 
              lineCap="round"
              lineJoin="round"
              dashArray="8, 12"
            />
          </>
        )}
      </MapContainer>

      {/* Map Control Cluster */}
      <div className="absolute bottom-10 right-6 z-10 flex flex-col gap-3">
        <button
          onClick={() => setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')}
          className="glass p-4 rounded-2xl shadow-2xl border-white/40 dark:border-white/5 hover:scale-110 active:scale-95 transition-all text-navy dark:text-white group"
          title="Toggle Map Style"
        >
          <Layers size={22} className="group-hover:text-secondary transition-colors" />
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .premium-popup .leaflet-popup-content-wrapper {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 1.5rem;
          padding: 4px;
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        .dark .premium-popup .leaflet-popup-content-wrapper {
          background: rgba(2, 6, 23, 0.9);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .premium-popup .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.95);
        }
        .dark .premium-popup .leaflet-popup-tip {
          background: rgba(2, 6, 23, 0.9);
        }
        .leaflet-container {
          background: #f1f5f9 !important;
        }
        .dark .leaflet-container {
          background: #020617 !important;
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
