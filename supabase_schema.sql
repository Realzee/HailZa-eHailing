-- Enable PostGIS for location support
create extension if not exists postgis;

-- PROFILES (Users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text check (role in ('rider', 'driver')) default 'rider',
  phone text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- DRIVERS (Extended profile for drivers)
create table public.drivers (
  id uuid references public.profiles(id) not null primary key,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  vehicle_color text,
  is_online boolean default false,
  current_location geography(POINT), -- PostGIS point
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- RIDES
create table public.rides (
  id uuid default gen_random_uuid() primary key,
  rider_id uuid references public.profiles(id) not null,
  driver_id uuid references public.drivers(id),
  pickup_lat float not null,
  pickup_lng float not null,
  dropoff_lat float not null,
  dropoff_lng float not null,
  pickup_address text,
  dropoff_address text,
  status text check (status in ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')) default 'requested',
  fare_amount decimal,
  distance_km decimal,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS POLICIES
alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.rides enable row level security;

-- Enable Realtime for the rides table
alter publication supabase_realtime add table public.rides;

-- Profiles: Everyone can read, User can update own
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Drivers: Public read (for map), Driver update own
create policy "Drivers viewable by everyone" on public.drivers for select using (true);
create policy "Drivers can update own status" on public.drivers for update using (auth.uid() = id);
create policy "Drivers can insert own record" on public.drivers for insert with check (auth.uid() = id);

-- Rides: Riders see own, Drivers see available or assigned
create policy "Riders can see own rides" on public.rides for select using (auth.uid() = rider_id);
create policy "Drivers can see requested rides" on public.rides for select using (status = 'requested' or driver_id = auth.uid());
create policy "Riders can create rides" on public.rides for insert with check (auth.uid() = rider_id);
create policy "Drivers can update assigned rides" on public.rides for update using (driver_id = auth.uid() or (driver_id is null and status = 'requested'));

-- FUNCTION: Find nearest drivers
-- Returns drivers within radius_km, ordered by distance
create or replace function find_nearest_drivers(
  lat float,
  lng float,
  radius_km float default 10
)
returns table (
  id uuid,
  lat float,
  lng float,
  dist_meters float,
  vehicle_model text,
  vehicle_plate text
)
language sql
as $$
  select
    d.id,
    st_y(d.current_location::geometry) as lat,
    st_x(d.current_location::geometry) as lng,
    st_distance(d.current_location, st_point(lng, lat)::geography) as dist_meters,
    d.vehicle_model,
    d.vehicle_plate
  from
    public.drivers d
  where
    d.is_online = true
    and st_dwithin(d.current_location, st_point(lng, lat)::geography, radius_km * 1000)
  order by
    d.current_location <-> st_point(lng, lat)::geography
  limit 10;
$$;
