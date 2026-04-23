-- 1. Enable PostGIS for location support
create extension if not exists postgis;

-- 2. PROFILES (Users)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text check (role in ('rider', 'driver', 'owner', 'admin')) default 'rider',
  phone text,
  avatar_url text,
  is_verified boolean default false,
  verification_status text check (verification_status in ('unverified', 'pending', 'verified', 'rejected')) default 'unverified',
  id_document_url text,
  selfie_url text,
  last_verified_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure 'admin' role is allowed and verification columns exist
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='is_verified') then
    alter table public.profiles add column is_verified boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='verification_status') then
    alter table public.profiles add column verification_status text check (verification_status in ('unverified', 'pending', 'verified', 'rejected')) default 'unverified';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='id_document_url') then
    alter table public.profiles add column id_document_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='selfie_url') then
    alter table public.profiles add column selfie_url text;
  end if;
end $$;

-- 3. DRIVERS (Extended profile for drivers)
create table if not exists public.drivers (
  id uuid references public.profiles(id) not null primary key,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  vehicle_color text,
  is_online boolean default false,
  is_approved boolean default false, -- Owner must approve
  onboarding_status text check (onboarding_status in ('pending', 'approved', 'declined')) default 'pending',
  owner_id uuid references public.profiles(id), -- Linked owner
  current_location geography(POINT), -- PostGIS point
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

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
  status text check (status in ('requested', 'accepted', 'in_progress', 'completed', 'cancelled', 'paid')) default 'requested',
  fare_amount numeric not null,
  distance_km numeric not null,
  passenger_count integer default 1 check (passenger_count >= 1 and passenger_count <= 4),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add passenger_count to rides if it doesn't exist
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='rides' and column_name='passenger_count') then
    alter table public.rides add column passenger_count integer default 1 check (passenger_count >= 1 and passenger_count <= 4);
  end if;
end $$;

-- 8. DISPUTES
create table if not exists public.disputes (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid references public.rides(id) not null,
  reported_by uuid references public.profiles(id) not null,
  target_user_id uuid references public.profiles(id) not null,
  reason text not null,
  description text,
  evidence_url text,
  status text check (status in ('pending', 'investigating', 'resolved', 'dismissed')) default 'pending',
  resolution text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. PAYOUT REQUESTS
create table if not exists public.payout_requests (
  id uuid default gen_random_uuid() primary key,
  driver_id uuid references public.profiles(id) not null,
  amount numeric not null,
  status text check (status in ('pending', 'processed', 'failed')) default 'pending',
  payout_method text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. RLS POLICIES (Row Level Security)
alter table public.disputes enable row level security;
alter table public.payout_requests enable row level security;

-- Dispute Policies
create policy "Users can see their own reported disputes" on public.disputes for select using (auth.uid() = reported_by or auth.uid() = target_user_id);
create policy "Users can report disputes" on public.disputes for insert with check (auth.uid() = reported_by);

-- Payout Policies
create policy "Drivers can see their own payout requests" on public.payout_requests for select using (auth.uid() = driver_id);
create policy "Drivers can request payouts" on public.payout_requests for insert with check (auth.uid() = driver_id);


-- Ensure 'paid' status is allowed in existing rides table
alter table public.rides drop constraint if exists rides_status_check;
alter table public.rides add constraint rides_status_check check (status in ('requested', 'accepted', 'in_progress', 'completed', 'cancelled', 'paid'));

-- 5. RLS POLICIES (Row Level Security)
alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.rides enable row level security;

-- HELPER: Check if user is admin (Security Definer to avoid recursion)
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Admin Policy (Global access)
drop policy if exists "Admins can do everything on profiles" on public.profiles;
create policy "Admins can do everything on profiles" on public.profiles for all using (public.is_admin());

drop policy if exists "Admins can do everything on drivers" on public.drivers;
create policy "Admins can do everything on drivers" on public.drivers for all using (public.is_admin());

drop policy if exists "Admins can do everything on rides" on public.rides;
create policy "Admins can do everything on rides" on public.rides for all using (public.is_admin());

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
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, 
    new.email, 
    split_part(new.email, '@', 1), 
    case 
      when new.email = 'mzwelisto@gmail.com' then 'admin'
      else 'rider'
    end
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop if exists to avoid errors on re-run
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
