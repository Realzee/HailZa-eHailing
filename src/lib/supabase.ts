import { createClient } from '@supabase/supabase-js';

// Try to get config from Environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
  role: 'rider' | 'driver' | 'owner' | 'admin';
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
  onboarding_status: 'pending' | 'approved' | 'declined';
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
