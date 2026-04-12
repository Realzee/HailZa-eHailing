import { createClient } from '@supabase/supabase-js';

// Try to get config from Environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isRealSupabase = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.includes('.supabase.co'));

// Mock Supabase Client for Demo Mode
const createMockClient = () => {
  const mockStorage = {
    getItem: (key: string) => localStorage.getItem(`mock_${key}`),
    setItem: (key: string, value: string) => localStorage.setItem(`mock_${key}`, value),
    removeItem: (key: string) => localStorage.removeItem(`mock_${key}`),
  };

  const getSession = async () => {
    const sessionStr = mockStorage.getItem('session');
    return { data: { session: sessionStr ? JSON.parse(sessionStr) : null }, error: null };
  };

  return {
    auth: {
      getSession,
      onAuthStateChange: (callback: any) => {
        getSession().then(({ data }) => callback('SIGNED_IN', data.session));
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithPassword: async ({ email }: any) => {
        const user = { id: 'mock-user-id', email };
        const session = { user, access_token: 'mock-token' };
        mockStorage.setItem('session', JSON.stringify(session));
        return { data: { session }, error: null };
      },
      signUp: async ({ email }: any) => {
        const user = { id: 'mock-user-id', email };
        const session = { user, access_token: 'mock-token' };
        mockStorage.setItem('session', JSON.stringify(session));
        return { data: { user, session }, error: null };
      },
      signOut: async () => {
        mockStorage.removeItem('session');
        return { error: null };
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            const data = mockStorage.getItem(`table_${table}`);
            return { data: data ? JSON.parse(data) : null, error: null };
          },
          maybeSingle: async () => {
            const data = mockStorage.getItem(`table_${table}`);
            return { data: data ? JSON.parse(data) : null, error: null };
          },
        }),
        order: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
      upsert: async (data: any) => {
        mockStorage.setItem(`table_${table}`, JSON.stringify(data));
        return { data, error: null };
      },
      update: () => ({
        eq: async () => ({ error: null }),
      }),
      insert: async (data: any) => ({ data, error: null }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: () => {},
      }),
    }),
  } as any;
};

export const isSupabaseConfigured = isRealSupabase;

export const supabase = isRealSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockClient();

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
