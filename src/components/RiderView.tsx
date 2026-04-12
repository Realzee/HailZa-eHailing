import { useState, useEffect, type FormEvent } from 'react';
import Map from '@/components/Map';
import { supabase, type Ride, type Driver } from '@/lib/supabase';
import { getRoute, reverseGeocode, formatZAR, searchAddress } from '@/lib/utils';
import { MapPin, Search, Car, CreditCard, Star, Loader2, X, CheckCircle, LogOut } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';

interface RiderViewProps {
  user: any;
}

export default function RiderView({ user }: RiderViewProps) {
  const [location, setLocation] = useState<[number, number]>([-26.2041, 28.0473]); // JHB Default
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [pickupAddress, setPickupAddress] = useState('Locating...');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [route, setRoute] = useState<[number, number][] | undefined>(undefined);
  const [rideStats, setRideStats] = useState<{ distance: number; duration: number; price: number } | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const cancellationReasons = ['Driver too far', 'Changed mind', 'Unsafe', 'Other'];

  // 1. Get User Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation([lat, lng]);
          const addr = await reverseGeocode(lat, lng);
          setPickupAddress(addr);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // 2. Listen for Active Rides
  useEffect(() => {
    const fetchActiveRide = async () => {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', user.id)
        .in('status', ['requested', 'accepted', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (data) {
        // If completed but not paid (logic could be added), or just show last status
        setActiveRide(data);
        if (data.status === 'completed') {
           setShowPayment(true);
        }
      }
    };

    fetchActiveRide();
    fetchRideHistory();
    fetchDrivers();

    const rideChannel = supabase
      .channel('rider_rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `rider_id=eq.${user.id}` },
        (payload) => {
          const newRide = payload.new as Ride;
          setActiveRide(newRide);
          if (newRide.status === 'completed') {
            setShowPayment(true);
          }
        }
      )
      .subscribe();

    const driverChannel = supabase
      .channel('drivers_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => {
          fetchDrivers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rideChannel);
      supabase.removeChannel(driverChannel);
    };
  }, [user.id]);

  const fetchRideHistory = async () => {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('rider_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    
    if (data) {
      setRideHistory(data);
    }
  };

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .eq('is_online', true)
      .eq('is_approved', true);
    
    if (data) {
      setDrivers(data);
    }
  };

  const getDriverLocation = (driver: Driver) => {
    if (!driver.current_location) return null;
    if (typeof driver.current_location === 'string') {
      const match = driver.current_location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
      if (match) {
        return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
      }
    }
    if (driver.current_location.coordinates) {
      return { lng: driver.current_location.coordinates[0], lat: driver.current_location.coordinates[1] };
    }
    return null;
  };

  // 3. Handle Map Click (Set Destination)
  const handleMapClick = async (lat: number, lng: number) => {
    if (activeRide && activeRide.status !== 'completed' && activeRide.status !== 'cancelled') return;
    
    // Reset if previous ride was completed/cancelled
    if (activeRide && (activeRide.status === 'completed' || activeRide.status === 'cancelled')) {
        setActiveRide(null);
        setShowPayment(false);
    }

    setDestination([lat, lng]);
    const addr = await reverseGeocode(lat, lng);
    setDropoffAddress(addr);
    
    // Calculate Route
    const routeData = await getRoute(location, [lat, lng]);
    if (routeData) {
      setRoute(routeData.coordinates);
      // Simple pricing: R10 base + R12/km
      const distKm = routeData.distance / 1000;
      const price = 10 + (distKm * 12);
      setRideStats({
        distance: distKm,
        duration: routeData.duration,
        price: Math.round(price),
      });
    }
  };

  // 4. Request Ride
  const requestRide = async () => {
    if (!destination || !rideStats) return;
    setSearching(true);
    
    try {
      console.log('Requesting ride:', {
        rider_id: user.id,
        pickup_lat: location[0],
        pickup_lng: location[1],
        dropoff_lat: destination[0],
        dropoff_lng: destination[1],
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        fare_amount: rideStats.price,
        distance_km: rideStats.distance,
        status: 'requested'
      });
      const { error } = await supabase.from('rides').insert({
        rider_id: user.id,
        pickup_lat: location[0],
        pickup_lng: location[1],
        dropoff_lat: destination[0],
        dropoff_lng: destination[1],
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        fare_amount: rideStats.price,
        distance_km: rideStats.distance,
        status: 'requested'
      });
      
      if (error) throw error;
    } catch (err) {
      console.error('Error requesting ride:', err);
      setSearching(false);
    }
  };

  // 5. Address Search
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const results = await searchAddress(searchQuery);
    setSearchResults(results);
  };

  const selectSearchResult = async (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setSearchResults([]);
    setSearchQuery('');
    handleMapClick(lat, lng);
  };

  const handlePayment = async () => {
    setProcessingPayment(true);
    // Simulate Paystack payment delay
    setTimeout(async () => {
      setProcessingPayment(false);
      setShowPayment(false);
      setActiveRide(null);
      setDestination(null);
      setRoute(undefined);
      setRideStats(null);
      alert('Payment Successful!');
    }, 2000);
  };

  const cancelRide = () => {
    if (!activeRide) return;
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!activeRide || !cancelReason) return;
    
    const { error } = await supabase
      .from('rides')
      .update({ status: 'cancelled' })
      .eq('id', activeRide.id);
      
    if (error) {
      console.error('Error cancelling ride:', error);
      alert('Failed to cancel ride.');
    } else {
      setActiveRide(null);
      setDestination(null);
      setRoute(undefined);
      setRideStats(null);
      setShowCancelModal(false);
      setCancelReason('');
    }
  };

  return (
    <div className="relative w-full h-screen flex flex-col">
      {/* Map Layer */}
      <div className="flex-1 relative z-0">
        <Map
          center={location}
          markers={[
            { position: location, type: 'user', title: 'You' },
            ...(destination ? [{ position: destination, type: 'destination' as const, title: 'Dropoff' }] : []),
            ...drivers.map(d => {
              const loc = getDriverLocation(d);
              return loc ? { position: [loc.lat, loc.lng] as [number, number], type: 'driver' as const, title: 'Available Driver' } : null;
            }).filter(m => m !== null) as any[]
          ]}
          route={route}
          onMapClick={handleMapClick}
          interactive={!activeRide || activeRide.status === 'completed' || activeRide.status === 'cancelled'}
        />
      </div>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-4 z-10 pointer-events-none flex justify-between items-start">
        <div className="bg-white shadow-lg rounded-xl p-3 flex items-center gap-3 pointer-events-auto max-w-md">
          <div className="bg-gray-100 p-2 rounded-full">
            <MapPin size={20} className="text-hail-green" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">Current Location</p>
            <p className="font-medium text-sm truncate">{pickupAddress}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ThemeToggle />
          <button 
            onClick={() => supabase.auth.signOut()}
            className="bg-white shadow-lg p-3 rounded-xl pointer-events-auto text-gray-600 hover:text-red-600 transition-colors"
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && activeRide && (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 text-hail-green rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-2xl font-bold">Ride Completed!</h2>
              <p className="text-gray-500">How was your ride?</p>
            </div>

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={32} className="text-yellow-400 fill-current cursor-pointer hover:scale-110 transition-transform" />
              ))}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl mb-6 flex justify-between items-center">
              <span className="font-medium text-gray-700">Total Fare</span>
              <span className="text-2xl font-bold text-gray-900">{formatZAR(activeRide.fare_amount)}</span>
            </div>

            <button
              onClick={handlePayment}
              disabled={processingPayment}
              className="w-full bg-hail-green text-white py-4 rounded-xl font-bold text-lg hover:bg-green-800 transition-colors flex items-center justify-center gap-2"
            >
              {processingPayment ? <Loader2 className="animate-spin" /> : <>Pay with Paystack <CreditCard size={20} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-4">Select Cancellation Reason</h2>
            <div className="space-y-2 mb-6">
              {cancellationReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setCancelReason(reason)}
                  className={`w-full p-3 rounded-xl text-left font-medium transition-colors ${
                    cancelReason === reason ? 'bg-hail-green text-white' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-gray-100 rounded-xl font-bold"
              >
                Back
              </button>
              <button
                onClick={confirmCancel}
                disabled={!cancelReason}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet / Controls */}
      <div className="bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] rounded-t-3xl p-6 z-20 min-h-[300px]">
        {!activeRide || activeRide.status === 'completed' || activeRide.status === 'cancelled' ? (
          <>
            {/* Search Destination */}
            <div className="mb-6 relative">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Where to?"
                    className="w-full bg-gray-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-hail-green"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button type="submit" className="bg-gray-900 text-white p-3 rounded-xl">
                  <Search size={20} />
                </button>
              </form>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl mt-2 overflow-hidden border border-gray-100 z-30">
                  <div className="flex justify-between items-center p-2 bg-gray-50 border-b">
                     <span className="text-xs font-bold text-gray-500 uppercase px-2">Results</span>
                     <button onClick={() => setSearchResults([])}><X size={16} /></button>
                  </div>
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectSearchResult(res)}
                      className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-0 text-sm"
                    >
                      {res.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ride Selection */}
            {destination && rideStats ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border-2 border-hail-green bg-green-50 rounded-xl cursor-pointer">
                  <div className="flex items-center gap-4">
                    <Car size={32} className="text-hail-green" />
                    <div>
                      <p className="font-bold text-gray-900">HailZA Standard</p>
                      <p className="text-xs text-gray-500">4 min away • {rideStats.distance.toFixed(1)} km</p>
                    </div>
                  </div>
                  <p className="font-bold text-lg">{formatZAR(rideStats.price)}</p>
                </div>

                <button
                  onClick={requestRide}
                  disabled={searching}
                  className="w-full bg-hail-green text-white py-4 rounded-xl font-bold text-lg hover:bg-green-800 transition-colors flex items-center justify-center gap-2"
                >
                  {searching ? <Loader2 className="animate-spin" /> : 'Confirm Ride'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-bold text-lg">Ride History</h3>
                {rideHistory.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rideHistory.map((ride) => (
                      <div key={ride.id} className="p-3 bg-gray-50 rounded-xl text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="font-bold">{new Date(ride.created_at).toLocaleDateString()}</span>
                          <span className="font-bold text-hail-green">{formatZAR(ride.fare_amount)}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{ride.pickup_address}</p>
                        <p className="text-xs text-gray-500 truncate">{ride.dropoff_address}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-4">No past rides found</p>
                )}
              </div>
            )}
          </>
        ) : (
          /* Active Ride Status */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {activeRide.status === 'requested' ? 'Finding your driver...' : 
                 activeRide.status === 'accepted' ? 'Driver is on the way' :
                 activeRide.status === 'in_progress' ? 'Heading to destination' : 'Ride Completed'}
              </h2>
              <span className="bg-hail-gold/20 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold uppercase">
                {activeRide.status}
              </span>
            </div>

            {activeRide.status === 'requested' && (
               <div className="flex justify-center py-8">
                 <div className="relative">
                   <div className="w-16 h-16 border-4 border-gray-200 border-t-hail-green rounded-full animate-spin"></div>
                 </div>
               </div>
            )}

            {(activeRide.status === 'requested' || activeRide.status === 'accepted') && (
              <button
                onClick={cancelRide}
                className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
              >
                Cancel Ride
              </button>
            )}

            {(activeRide.status === 'accepted' || activeRide.status === 'in_progress') && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                  <Car size={24} className="text-gray-600" />
                </div>
                <div>
                  <p className="font-bold">Toyota Corolla</p>
                  <p className="text-sm text-gray-500">GP 123 ZA • White</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="font-bold text-lg">4.8 <Star size={12} className="inline text-hail-gold fill-current" /></p>
                </div>
              </div>
            )}
            
            {activeRide.status === 'in_progress' && (
               <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-sm">
                 Ride in progress. Sit back and relax!
               </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
