import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Navigation, MapPin, User, TriangleAlert } from 'lucide-react';

// Premium SVGs with higher detail and professional geometry
const carSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.15-3.42C6.35 7.21 6.69 7 7.07 7h9.86c.38 0 .72.21.87.58L19 11H5z"/></svg>`;
const userSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>`;
const destinationSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
const hazardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

const createPremiumIcon = (svg: string, color: string, variant: 'pin' | 'dot' | 'vehicle' = 'pin', rotation: number = 0) => {
  const isDot = variant === 'dot';
  const isVehicle = variant === 'vehicle';
  
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center p-3 group">
        ${isDot ? `
          <div class="absolute inset-0 bg-white/60 dark:bg-navy/60 backdrop-blur-md rounded-full border shadow-2xl scale-75" style="border-color: ${color}40"></div>
          <div class="absolute inset-0 rounded-full animate-ping opacity-20" style="background-color: ${color}"></div>
          <div class="relative w-4 h-4 rounded-full border-2 border-white shadow-lg" style="background-color: ${color}"></div>
        ` : isVehicle ? `
          <div class="relative" style="transform: rotate(${rotation}deg); transition: transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)">
            <div class="absolute -inset-1 blur-md rounded-full opacity-30" style="background-color: ${color}"></div>
            <div class="relative bg-white dark:bg-navy p-2.5 rounded-2xl shadow-2xl border-2 flex items-center justify-center transform active:scale-90 transition-transform" style="border-color: ${color}20">
              <div class="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-transparent to-black/5 dark:from-white/10 dark:to-transparent pointer-events-none"></div>
              <div class="relative flex items-center justify-center w-6 h-6" style="color: ${color}">
                ${svg}
              </div>
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-navy border-b-2 border-r-2" style="border-color: ${color}20"></div>
          </div>
        ` : `
          <div class="relative flex flex-col items-center group-hover:scale-110 transition-transform duration-500">
            <div class="relative flex items-center justify-center w-14 h-14 bg-white dark:bg-navy rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-2 transition-all p-3" style="border-color: ${color}">
              <div class="absolute inset-0 rounded-full bg-gradient-to-tr from-black/5 to-white/20 dark:from-white/5 dark:to-transparent"></div>
              <div class="relative flex items-center justify-center w-full h-full" style="color: ${color}">
                ${svg}
              </div>
            </div>
            <div class="w-1.5 h-6 bg-gradient-to-b from-${color} to-transparent mt-[-6px] rounded-full" style="background: linear-gradient(to bottom, ${color}, transparent)"></div>
            <div class="w-1.5 h-1.5 bg-black/20 dark:bg-white/20 blur-[1px] mt-0.5 rounded-full"></div>
          </div>
        `}
      </div>
    `,
    className: 'premium-map-icon',
    iconSize: isDot ? [40, 40] : [56, 72],
    iconAnchor: isDot ? [20, 20] : [28, 72],
    popupAnchor: isDot ? [0, -20] : [0, -72],
  });
};

// Colors and refined icon variants
const getIcon = (type: string, rotation: number = 0) => {
  if (type === 'driver') return createPremiumIcon(carSvg, '#0f172a', 'vehicle', rotation);
  if (type === 'user') return createPremiumIcon(userSvg, '#0ea5e9', 'dot');
  if (type === 'destination') return createPremiumIcon(destinationSvg, '#0ea5e9', 'pin');
  if (type === 'hazard') return createPremiumIcon(hazardSvg, '#ef4444', 'pin');
  return createPremiumIcon(userSvg, '#0ea5e9', 'dot');
};

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
          const icon = getIcon(marker.type || 'user', marker.rotation);

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
        .premium-map-icon {
          background: transparent !important;
          border: none !important;
        }
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
