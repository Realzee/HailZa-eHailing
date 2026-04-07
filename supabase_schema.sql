-- 1. Enable PostGIS for location support
create extension if not exists postgis;

-- 2. PROFILES (Users)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text check (role in ('rider', 'driver', 'owner')) default 'rider',
  phone text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure 'owner' role is allowed in existing profiles table
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('rider', 'driver', 'owner'));

-- 3. DRIVERS (Extended profile for drivers)
create table if not exists public.drivers (
  id uuid references public.profiles(id) not null primary key,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  vehicle_color text,
  is_online boolean default false,
  current_location geography(POINT), -- PostGIS point
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add missing columns to drivers if they don't exist (for existing tables)
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='drivers' and column_name='is_approved') then
    alter table public.drivers add column is_approved boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='drivers' and column_name='owner_id') then
    alter table public.drivers add column owner_id uuid references public.profiles(id);
  end if;
end $$;

-- 4. RIDES (Ride requests and history)
create table if not exists public.rides (
  id uuid default gen_random_uuid() primary key,
  rider_id uuid references public.profiles(id) not null,
  driver_id uuid references public.profiles(id),
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  status text check (status in ('requested', 'accepted', 'in_progress', 'completed', 'cancelled')) default 'requested',
  fare_amount numeric not null,
  distance_km numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. RLS POLICIES (Row Level Security)
alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.rides enable row level security;

-- Profiles Policies
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Drivers Policies
drop policy if exists "Drivers viewable by everyone" on public.drivers;
drop policy if exists "Drivers can update own status" on public.drivers;
drop policy if exists "Drivers can insert own record" on public.drivers;
drop policy if exists "Owners can update drivers" on public.drivers;

create policy "Drivers viewable by everyone" on public.drivers for select using (true);
create policy "Drivers can update own status" on public.drivers for update using (auth.uid() = id);
create policy "Drivers can insert own record" on public.drivers for insert with check (auth.uid() = id);
create policy "Owners can update drivers" on public.drivers for update using (
  exists (
    select 1 from public.profiles 
    where id = auth.uid() and role = 'owner'
  )
);

-- Rides Policies
drop policy if exists "Riders can see own rides" on public.rides;
drop policy if exists "Drivers can see requested rides" on public.rides;
drop policy if exists "Riders can create rides" on public.rides;
drop policy if exists "Drivers can update assigned rides" on public.rides;

create policy "Riders can see own rides" on public.rides for select using (auth.uid() = rider_id);
create policy "Drivers can see requested rides" on public.rides for select using (status = 'requested' or driver_id = auth.uid());
create policy "Riders can create rides" on public.rides for insert with check (auth.uid() = rider_id);
create policy "Drivers can update assigned rides" on public.rides for update using (driver_id = auth.uid() or (driver_id is null and status = 'requested'));

-- 6. REALTIME (Enable Realtime for these tables)
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.drivers;
alter publication supabase_realtime add table public.rides;

-- 7. HELPER FUNCTION: Find nearest drivers
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
    and d.is_approved = true
    and st_dwithin(d.current_location, st_point(lng, lat)::geography, radius_km * 1000)
  order by
    d.current_location <-> st_point(lng, lat)::geography
  limit 10;
$$;
