import { createClient } from '@supabase/supabase-js';

// Try to get config from Environment or LocalStorage
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('hailza_supabase_url') : null;
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('hailza_supabase_key') : null;

const supabaseUrl = envUrl || storedUrl;
const supabaseAnonKey = envKey || storedKey;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Initialize with real credentials or safe placeholders to prevent crash
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'rider' | 'driver' | 'owner';
  phone?: string;
};

export type Driver = {
  id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_plate: string;
  vehicle_color: string;
  is_online: boolean;
  is_approved: boolean;
  owner_id?: string;
  current_location?: any;
};

export type Ride = {
  id: string;
  rider_id: string;
  driver_id?: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  pickup_address: string;
  dropoff_address: string;
  status: 'requested' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  fare_amount: number;
  distance_km: number;
  created_at: string;
};
