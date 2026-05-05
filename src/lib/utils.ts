import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// South African Currency Formatter
export const formatZAR = (amount: number) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
};

// OSRM Route Fetcher
export const getRoute = async (start: [number, number], end: [number, number]) => {
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
    );
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return {
        coordinates: data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]), // Flip to [lat, lng]
        distance: data.routes[0].distance, // meters
        duration: data.routes[0].duration, // seconds
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching route:', error);
    return null;
  }
};

// Nominatim Geocoder
export const searchAddress = async (query: string) => {
  if (!query) return [];
  try {
    // Priority on South Africa with better specificity
    const viewbox = '16.4,-34.8,32.9,-22.1'; 
    const countrycodes = 'za'; // Restrict to South Africa
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&viewbox=${viewbox}&bounded=0&countrycodes=${countrycodes}&addressdetails=1&limit=6`,
      {
        headers: {
          'User-Agent': 'eTaxiPremium-Mobility/1.1',
        },
      }
    );
    const data = await response.json();
    return data.map((item: any) => ({
      ...item,
      // Create a better title-subtitle structure
      title: item.address.name || item.address.road || item.address.suburb || item.display_name.split(',')[0],
      subtitle: item.display_name.split(',').slice(1).join(',').trim()
    }));
  } catch (error) {
    console.error('Error searching address:', error);
    return [];
  }
};

export const reverseGeocode = async (lat: number, lng: number) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'User-Agent': 'eTaxiDriver-Web-App/1.0',
        },
      }
    );
    const data = await response.json();
    return data.display_name;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return 'Unknown Location';
  }
};
