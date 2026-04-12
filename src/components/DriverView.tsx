import { useState, useEffect } from 'react';
import Map from '@/components/Map';
import { supabase, type Ride, type Profile } from '@/lib/supabase';
import { getRoute, formatZAR } from '@/lib/utils';
import { Car, MapPin, Navigation, CheckCircle, XCircle, LogOut, Loader2, Phone, ExternalLink, ShieldAlert, Bell, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';

interface DriverViewProps {
  user: any;
}

export default function DriverView({ user }: DriverViewProps) {
  const [location, setLocation] = useState<[number, number]>([-26.2041, 28.0473]);
  const [isOnline, setIsOnline] = useState(false);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<'pending' | 'approved' | 'declined' | null>(null);
  const [incomingRide, setIncomingRide] = useState<Ride | null>(null);
  const [activeRide, setActiveRide] = useState<(Ride & { rider?: Profile }) | null>(null);
  const [route, setRoute] = useState<[number, number][] | undefined>(undefined);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  // Sound effect for new requests
  const playNotificationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.error('Error playing sound:', e));
  };

  useEffect(() => {
    if (incomingRide) {
      playNotificationSound();
      setShowNotification(true);
    }
  }, [incomingRide?.id]);

  // 0. Check Approval Status
  useEffect(() => {
    console.log('Driver isApproved status:', isApproved);
    const checkApproval = async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('is_approved, onboarding_status')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking approval:', error);
      } else if (!data) {
        // If driver record doesn't exist, create it
        await supabase.from('drivers').insert({
          id: user.id,
          vehicle_make: 'Toyota',
          vehicle_model: 'Corolla',
          vehicle_plate: 'GP 123 ZA',
          vehicle_color: 'White',
          is_approved: false,
          onboarding_status: 'pending'
        });
        setIsApproved(false);
        setOnboardingStatus('pending');
      } else {
        setIsApproved(data.is_approved);
        setOnboardingStatus(data.onboarding_status);
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
          setOnboardingStatus(payload.new.onboarding_status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  // 1. Location Tracking & Status Update
  useEffect(() => {
    console.log('Driver isOnline status:', isOnline);
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
      (err) => {
        console.error('Geolocation error:', err);
        setGeoError(err.message);
      },
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
        .select('*, rider:rider_id(*)')
        .eq('driver_id', user.id)
        .in('status', ['accepted', 'in_progress'])
        .maybeSingle();
      if (data) {
        setActiveRide(data as any);
        // Calculate route based on current status
        const targetLat = data.status === 'accepted' ? data.pickup_lat : data.dropoff_lat;
        const targetLng = data.status === 'accepted' ? data.pickup_lng : data.dropoff_lng;
        const routeData = await getRoute(location, [targetLat, targetLng]);
        if (routeData) setRoute(routeData.coordinates);
      }
    };
    checkActive();

    // Subscribe to NEW requests
    const channel = supabase
      .channel('driver_rides')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides' },
        (payload) => {
          console.log('New ride payload:', payload);
          const newRide = payload.new as Ride;
          if (newRide.status === 'requested' && !activeRide && !incomingRide) {
            setIncomingRide(newRide);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, activeRide, incomingRide, user.id, isApproved]);

  // 3. Accept Ride
  const acceptRide = async () => {
    if (!incomingRide || !isApproved) return;
    
    // Fetch rider details too
    const { data: riderData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', incomingRide.rider_id)
      .single();

    const { error } = await supabase
      .from('rides')
      .update({ status: 'accepted', driver_id: user.id })
      .eq('id', incomingRide.id);

    if (!error) {
      setActiveRide({ ...incomingRide, status: 'accepted', driver_id: user.id, rider: riderData as any });
      setIncomingRide(null);
      setShowNotification(false);
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

  const openNavigation = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  if (isApproved === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-hail-green" size={48} />
      </div>
    );
  }

  if (onboardingStatus === 'declined') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-red-100 p-6 rounded-full mb-6">
          <ShieldAlert size={64} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-red-600">Account Suspended</h1>
        <p className="text-gray-500 mb-8 max-w-xs">
          Your driver account has been declined or suspended. Please contact support for more information.
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
      {/* Visual Notification Banner */}
      {showNotification && incomingRide && !activeRide && (
        <div className="absolute top-20 left-4 right-4 z-50 animate-in slide-in-from-top duration-300 pointer-events-auto">
          <div className="bg-hail-green text-white p-4 rounded-xl shadow-2xl flex items-center justify-between gap-3 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Bell size={20} className="animate-bounce" />
              </div>
              <div>
                <p className="font-bold text-sm">New Ride Request!</p>
                <p className="text-[10px] opacity-90 line-clamp-1">{incomingRide.pickup_address}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowNotification(false)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

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
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            {geoError && (
              <div className="bg-red-600 text-white text-[10px] px-3 py-1 rounded-full font-bold shadow-lg pointer-events-auto flex items-center gap-1 w-fit">
                <ShieldAlert size={12} />
                GPS ERROR: {geoError}
              </div>
            )}
          </div>
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`px-6 py-2 rounded-full font-bold shadow-lg transition-colors pointer-events-auto ${
              isOnline ? 'bg-hail-green text-white' : 'bg-gray-800 text-gray-300'
            }`}
          >
            {isOnline ? 'YOU ARE ONLINE' : 'GO ONLINE'}
          </button>
          <div className="flex-1 flex justify-end gap-2">
            <ThemeToggle />
            <button 
              onClick={handleSignOut}
              className="bg-white shadow-lg p-3 rounded-xl pointer-events-auto text-gray-600 hover:text-red-600 transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
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
                onClick={() => {
                  setIncomingRide(null);
                  setShowNotification(false);
                }}
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
          <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600 text-xl">
                  {activeRide.rider?.full_name?.charAt(0) || 'R'}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{activeRide.rider?.full_name || 'Rider'}</h3>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={12} />
                    {activeRide.status === 'accepted' ? 'Heading to Pickup' : 'Heading to Dropoff'}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-[10px] font-bold uppercase mb-1">
                  {activeRide.status.replace('_', ' ')}
                </span>
                <p className="font-bold text-hail-green">{formatZAR(activeRide.fare_amount)}</p>
              </div>
            </div>

            <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
              <div className="flex items-start gap-3">
                <div className={`mt-1 w-2.5 h-2.5 rounded-full ${activeRide.status === 'accepted' ? 'bg-green-500 ring-4 ring-green-100' : 'bg-gray-300'}`} />
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Pickup</p>
                  <p className="text-sm font-medium line-clamp-1">{activeRide.pickup_address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`mt-1 w-2.5 h-2.5 rounded-full ${activeRide.status === 'in_progress' ? 'bg-red-500 ring-4 ring-red-100' : 'bg-gray-300'}`} />
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Dropoff</p>
                  <p className="text-sm font-medium line-clamp-1">{activeRide.dropoff_address}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => openNavigation(
                  activeRide.status === 'accepted' ? activeRide.pickup_lat : activeRide.dropoff_lat,
                  activeRide.status === 'accepted' ? activeRide.pickup_lng : activeRide.dropoff_lng
                )}
                className="bg-gray-100 text-gray-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
              >
                <ExternalLink size={18} />
                Navigate
              </button>
              <button
                className="bg-gray-100 text-gray-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
              >
                <Phone size={18} />
                Call Rider
              </button>
            </div>

            {activeRide.status === 'accepted' && (
              <button
                onClick={() => updateRideStatus('in_progress')}
                className="w-full bg-hail-green text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-hail-green/20"
              >
                <Navigation size={20} />
                Start Trip
              </button>
            )}

            {activeRide.status === 'in_progress' && (
              <button
                onClick={() => updateRideStatus('completed')}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
              >
                <CheckCircle size={20} />
                Complete Trip
              </button>
            )}
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
