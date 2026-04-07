import { useState, useEffect } from 'react';
import Map from '@/components/Map';
import { supabase, type Ride } from '@/lib/supabase';
import { getRoute, formatZAR } from '@/lib/utils';
import { Car, MapPin, Navigation, CheckCircle, XCircle, LogOut, Loader2 } from 'lucide-react';

interface DriverViewProps {
  user: any;
}

export default function DriverView({ user }: DriverViewProps) {
  const [location, setLocation] = useState<[number, number]>([-26.2041, 28.0473]);
  const [isOnline, setIsOnline] = useState(false);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [incomingRide, setIncomingRide] = useState<Ride | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [route, setRoute] = useState<[number, number][] | undefined>(undefined);

  // 0. Check Approval Status
  useEffect(() => {
    const checkApproval = async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('is_approved')
        .eq('id', user.id)
        .single();
      
      if (error) {
        // If driver record doesn't exist, create it
        if (error.code === 'PGRST116') {
          await supabase.from('drivers').insert({
            id: user.id,
            vehicle_make: 'Toyota',
            vehicle_model: 'Corolla',
            vehicle_plate: 'GP 123 ZA',
            vehicle_color: 'White',
            is_approved: false
          });
          setIsApproved(false);
        }
      } else {
        setIsApproved(data.is_approved);
      }
    };

    checkApproval();

    // Subscribe to approval changes
    const channel = supabase
      .channel('driver_approval')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${user.id}` },
        (payload) => {
          setIsApproved(payload.new.is_approved);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  // 1. Location Tracking & Status Update
  useEffect(() => {
    if (!navigator.geolocation || !isApproved) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation([lat, lng]);

        if (isOnline) {
          // Update driver location in DB (PostGIS)
          await supabase
            .from('drivers')
            .update({
              current_location: `POINT(${lng} ${lat})`, // PostGIS format: POINT(lng lat)
              is_online: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, user.id, isApproved]);

  // 2. Listen for Ride Requests
  useEffect(() => {
    if (!isOnline || !isApproved) return;

    // Check for existing active ride first
    const checkActive = async () => {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', user.id)
        .in('status', ['accepted', 'in_progress'])
        .single();
      if (data) setActiveRide(data);
    };
    checkActive();

    // Subscribe to NEW requests
    const channel = supabase
      .channel('driver_rides')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: `status=eq.requested` },
        (payload) => {
          // Simple logic: Show any request (In prod, use PostGIS RPC to filter by radius)
          if (!activeRide && !incomingRide) {
            setIncomingRide(payload.new as Ride);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, activeRide, incomingRide, user.id, isApproved]);

  // 3. Accept Ride
  const acceptRide = async () => {
    if (!incomingRide || !isApproved) return;
    
    const { error } = await supabase
      .from('rides')
      .update({ status: 'accepted', driver_id: user.id })
      .eq('id', incomingRide.id);

    if (!error) {
      setActiveRide({ ...incomingRide, status: 'accepted', driver_id: user.id });
      setIncomingRide(null);
      // Calculate route to pickup
      const routeData = await getRoute(location, [incomingRide.pickup_lat, incomingRide.pickup_lng]);
      if (routeData) setRoute(routeData.coordinates);
    }
  };

  // 4. Ride Lifecycle Actions
  const updateRideStatus = async (status: 'in_progress' | 'completed') => {
    if (!activeRide) return;
    
    await supabase
      .from('rides')
      .update({ status })
      .eq('id', activeRide.id);
      
    if (status === 'completed') {
      setActiveRide(null);
      setRoute(undefined);
    } else {
      setActiveRide({ ...activeRide, status });
      // Route to dropoff
      const routeData = await getRoute(location, [activeRide.dropoff_lat, activeRide.dropoff_lng]);
      if (routeData) setRoute(routeData.coordinates);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (isApproved === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-hail-green" size={48} />
      </div>
    );
  }

  if (isApproved === false) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-orange-100 p-6 rounded-full mb-6">
          <Car size={64} className="text-orange-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Waiting for Approval</h1>
        <p className="text-gray-500 mb-8 max-w-xs">
          Your driver account is currently pending review by a fleet owner. 
          You'll be able to go online once approved.
        </p>
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 text-gray-600 font-semibold hover:text-red-600 transition-colors"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen flex flex-col">
      {/* Map */}
      <div className="flex-1">
        <Map
          center={location}
          markers={[
            { position: location, type: 'driver', title: 'You' },
            ...(activeRide ? [
              { position: [activeRide.pickup_lat, activeRide.pickup_lng] as [number, number], type: 'user' as const, title: 'Pickup' },
              { position: [activeRide.dropoff_lat, activeRide.dropoff_lng] as [number, number], type: 'destination' as const, title: 'Dropoff' }
            ] : [])
          ]}
          route={route}
        />
      </div>

      {/* Top Status Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center pointer-events-none">
        <div className="flex-1" />
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`px-6 py-2 rounded-full font-bold shadow-lg transition-colors pointer-events-auto ${
            isOnline ? 'bg-hail-green text-white' : 'bg-gray-800 text-gray-300'
          }`}
        >
          {isOnline ? 'YOU ARE ONLINE' : 'OFFLINE'}
        </button>
        <div className="flex-1 flex justify-end">
          <button 
            onClick={handleSignOut}
            className="bg-white shadow-lg p-3 rounded-xl pointer-events-auto text-gray-600 hover:text-red-600 transition-colors"
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Incoming Request Modal */}
      {incomingRide && !activeRide && (
        <div className="absolute bottom-0 left-0 w-full p-4 z-20">
          <div className="bg-white rounded-2xl shadow-2xl p-6 animate-in slide-in-from-bottom duration-300">
            <h3 className="text-xl font-bold mb-4 text-center">New Ride Request!</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gray-100 p-3 rounded-full">
                <Car size={24} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">{formatZAR(incomingRide.fare_amount)}</p>
                <p className="text-gray-500 text-sm">{incomingRide.distance_km.toFixed(1)} km trip</p>
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-2 h-2 bg-green-500 rounded-full" />
                <p className="text-sm">{incomingRide.pickup_address}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 w-2 h-2 bg-red-500 rounded-full" />
                <p className="text-sm">{incomingRide.dropoff_address}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIncomingRide(null)}
                className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700"
              >
                Decline
              </button>
              <button 
                onClick={acceptRide}
                className="flex-1 py-3 bg-hail-green text-white rounded-xl font-bold"
              >
                Accept Ride
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Ride Controls */}
      {activeRide && (
        <div className="absolute bottom-0 left-0 w-full p-4 z-20">
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Current Trip</h3>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase">
                {activeRide.status}
              </span>
            </div>

            {activeRide.status === 'accepted' && (
              <button
                onClick={() => updateRideStatus('in_progress')}
                className="w-full bg-hail-green text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Navigation size={20} />
                Start Trip
              </button>
            )}

            {activeRide.status === 'in_progress' && (
              <button
                onClick={() => updateRideStatus('completed')}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle size={20} />
                Complete Trip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
