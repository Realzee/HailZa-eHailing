import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Map from '@/components/Map';
import { supabase, type Ride, type Driver } from '@/lib/supabase';
import { getRoute, reverseGeocode, formatZAR, searchAddress } from '@/lib/utils';
import { MapPin, Search, Car, CreditCard, Star, Loader2, X, CheckCircle, LogOut, Navigation, Clock, ChevronRight, History, Settings } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';
import { PREDEFINED_ROUTES, getPriceForRoute } from '@/constants/pricing';

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
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);
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
        .limit(1);
        
      if (data && data.length > 0) {
        const ride = data[0];
        // If completed but not paid (logic could be added), or just show last status
        setActiveRide(ride);
        if (ride.status === 'completed') {
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
    setSelectedRouteId(null); // Reset predefined route if map is clicked
    
    // Calculate Route
    const routeData = await getRoute(location, [lat, lng]);
    if (routeData) {
      setRoute(routeData.coordinates);
      const distKm = routeData.distance / 1000;
      const price = getPriceForRoute(null, distKm);
      setRideStats({
        distance: distKm,
        duration: routeData.duration,
        price: price,
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

  const selectPredefinedRoute = (routeId: string) => {
    const route = PREDEFINED_ROUTES.find(r => r.id === routeId);
    if (!route) return;

    setSelectedRouteId(routeId);
    setDropoffAddress(`${route.from} to ${route.to}`);
    setShowAllRoutes(false);
    
    // For predefined routes, we might not have exact coordinates, 
    // so we'll just set a dummy destination for the map or use search to find it
    // For now, let's just set the price and wait for user to confirm
    setRideStats({
      distance: 0, // Unknown exactly
      duration: 0,
      price: getPriceForRoute(routeId, 0)
    });
    
    // Try to search for the destination to show on map
    searchAddress(route.to).then(results => {
      if (results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        setDestination([lat, lng]);
        getRoute(location, [lat, lng]).then(routeData => {
          if (routeData) {
            setRoute(routeData.coordinates);
            setRideStats(prev => prev ? {
              ...prev,
              distance: routeData.distance / 1000,
              duration: routeData.duration
            } : null);
          }
        });
      }
    });
  };

  const appLogo = localStorage.getItem('appLogo');

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
        <div className="flex items-start gap-2">
          {appLogo && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white shadow-xl rounded-2xl p-2 pointer-events-auto border border-gray-100"
            >
              <img src={appLogo} alt="Logo" className="h-8 w-auto" />
            </motion.div>
          )}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white shadow-xl rounded-2xl p-3 flex items-center gap-3 pointer-events-auto max-w-md border border-gray-100"
          >
            <div className="bg-hail-green/10 p-2 rounded-xl">
              <MapPin size={20} className="text-hail-green" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Current Location</p>
              <p className="font-bold text-sm truncate text-gray-900">{pickupAddress}</p>
            </div>
          </motion.div>
        </div>
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="flex gap-2">
            <ThemeToggle />
            <button 
              onClick={() => supabase.auth.signOut()}
              className="bg-white shadow-xl p-3 rounded-2xl text-gray-600 hover:text-red-600 transition-all hover:scale-105 active:scale-95 border border-gray-100"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
          {activeRide && (activeRide.status === 'accepted' || activeRide.status === 'in_progress') && (
            <button
              onClick={() => setIsSheetMinimized(!isSheetMinimized)}
              className="bg-hail-green text-white shadow-xl p-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
            >
              {isSheetMinimized ? <Navigation size={18} /> : <Car size={18} />}
              {isSheetMinimized ? 'Show Details' : 'Show Map'}
            </button>
          )}
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
      <motion.div 
        initial={{ y: 100 }}
        animate={{ 
          y: isSheetMinimized && activeRide && (activeRide.status === 'accepted' || activeRide.status === 'in_progress') ? '70%' : 0 
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] rounded-t-[2.5rem] p-6 z-20 min-h-[350px] border-t border-gray-100 relative"
      >
        {/* Handle for visual cue / Toggle */}
        <button 
          onClick={() => activeRide && (activeRide.status === 'accepted' || activeRide.status === 'in_progress') && setIsSheetMinimized(!isSheetMinimized)}
          className="w-full py-2 flex justify-center cursor-pointer"
        >
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </button>

        {!activeRide || activeRide.status === 'completed' || activeRide.status === 'cancelled' ? (
          <div className="max-w-2xl mx-auto w-full mt-4">

            {/* Search Destination */}
            <div className="mb-8 relative">
              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-hail-green transition-colors" size={20} />
                  <input
                    type="text"
                    placeholder="Where to?"
                    className="w-full bg-gray-50 rounded-2xl py-4 pl-12 pr-4 outline-none border border-gray-100 focus:border-hail-green focus:bg-white focus:ring-4 focus:ring-hail-green/5 transition-all text-lg font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  type="submit" 
                  className="bg-gray-900 text-white p-4 rounded-2xl hover:bg-black transition-all active:scale-95 shadow-lg shadow-black/10"
                >
                  <Search size={24} />
                </button>
              </form>
              
              {/* Search Results */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 w-full bg-white shadow-2xl rounded-2xl mt-3 overflow-hidden border border-gray-100 z-30"
                  >
                    <div className="flex justify-between items-center p-4 bg-gray-50/50 border-b border-gray-100">
                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Search Results</span>
                       <button onClick={() => setSearchResults([])} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={16} /></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {searchResults.map((res, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectSearchResult(res)}
                          className="w-full text-left p-4 hover:bg-hail-green/5 border-b border-gray-50 last:border-0 transition-colors flex items-center gap-3"
                        >
                          <div className="p-2 bg-gray-100 rounded-lg text-gray-500">
                            <MapPin size={18} />
                          </div>
                          <span className="text-sm font-medium text-gray-700 line-clamp-1">{res.display_name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Predefined Routes */}
            {!destination && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Navigation size={16} className="text-hail-green" /> Popular Routes
                  </h3>
                  <button 
                    onClick={() => setShowAllRoutes(true)}
                    className="text-xs font-bold text-hail-green hover:underline uppercase tracking-wider"
                  >
                    View All
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
                  {PREDEFINED_ROUTES.slice(0, 8).map((route) => (
                    <button
                      key={route.id}
                      onClick={() => selectPredefinedRoute(route.id)}
                      className="whitespace-nowrap bg-white border border-gray-100 px-5 py-3 rounded-2xl text-sm font-bold text-gray-700 hover:border-hail-green hover:bg-green-50 transition-all hover:shadow-md active:scale-95 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 bg-hail-green rounded-full" />
                      {route.from} → {route.to}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ride Selection */}
            {destination && rideStats ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between p-5 border-2 border-hail-green bg-hail-green/5 rounded-[2rem] shadow-sm">
                  <div className="flex items-center gap-5">
                    <div className="bg-hail-green p-3 rounded-2xl shadow-lg shadow-hail-green/20">
                      <Car size={32} className="text-white" />
                    </div>
                    <div>
                      <p className="font-black text-xl text-gray-900">eTaxiDriver Standard</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                        <Clock size={14} />
                        <span>4 min away</span>
                        <span className="text-gray-300">•</span>
                        <span>{rideStats.distance.toFixed(1)} km</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-2xl text-hail-green">{formatZAR(rideStats.price)}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fixed Fare</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setDestination(null); setRoute(undefined); setRideStats(null); }}
                    className="p-4 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
                  >
                    <X size={24} />
                  </button>
                  <button
                    onClick={requestRide}
                    disabled={searching}
                    className="flex-1 bg-hail-green text-white py-4 rounded-2xl font-black text-xl hover:bg-green-800 transition-all active:scale-[0.98] shadow-xl shadow-hail-green/20 flex items-center justify-center gap-3"
                  >
                    {searching ? <Loader2 className="animate-spin" /> : <>Confirm Ride <ChevronRight size={24} /></>}
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <History size={16} className="text-gray-400" /> Recent Trips
                  </h3>
                </div>
                {rideHistory.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rideHistory.slice(0, 4).map((ride) => (
                      <div key={ride.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(ride.created_at).toLocaleDateString()}</span>
                          <span className="font-black text-hail-green">{formatZAR(ride.fare_amount)}</span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-800 line-clamp-1 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                            {ride.dropoff_address}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium italic">No past rides found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Active Ride Status */
          <div className="max-w-2xl mx-auto w-full">
            {isSheetMinimized ? (
              <div className="flex items-center justify-between py-2">
                <div>
                  <h3 className="font-black text-gray-900">
                    {activeRide.status === 'requested' ? 'Finding Driver...' : 
                     activeRide.status === 'accepted' ? 'Driver Arriving' :
                     activeRide.status === 'in_progress' ? 'En Route' : 'Arrived'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">{activeRide.dropoff_address}</p>
                </div>
                <div className="bg-hail-green text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {activeRide.status}
                </div>
              </div>
            ) : (
              <div className="space-y-8 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                      {activeRide.status === 'requested' ? 'Finding Driver' : 
                       activeRide.status === 'accepted' ? 'On the Way' :
                       activeRide.status === 'in_progress' ? 'En Route' : 'Arrived'}
                    </h2>
                    <p className="text-gray-500 font-medium">
                      {activeRide.status === 'requested' ? 'Searching for nearby drivers...' : 
                       activeRide.status === 'accepted' ? 'Your driver is heading to you' :
                       activeRide.status === 'in_progress' ? 'You are on your way' : 'Your ride is complete'}
                    </p>
                  </div>
                  <div className="bg-hail-green/10 text-hail-green px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border border-hail-green/20">
                    {activeRide.status}
                  </div>
                </div>

                {activeRide.status === 'requested' && (
                   <div className="flex justify-center py-12">
                     <div className="relative">
                       <div className="w-24 h-24 border-8 border-gray-100 border-t-hail-green rounded-full animate-spin"></div>
                       <div className="absolute inset-0 flex items-center justify-center">
                         <Search size={32} className="text-hail-green animate-pulse" />
                       </div>
                     </div>
                   </div>
                )}

                {(activeRide.status === 'accepted' || activeRide.status === 'in_progress') && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-5 p-6 bg-gray-900 text-white rounded-[2.5rem] shadow-2xl"
                  >
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                      <Car size={32} className="text-hail-green" />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-xl">Toyota Corolla</p>
                      <p className="text-sm text-gray-400 font-bold tracking-widest uppercase">GP 123 ZA • White</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 font-black text-xl">
                        <span>4.8</span>
                        <Star size={18} className="text-hail-gold fill-current" />
                      </div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Driver Rating</p>
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  {(activeRide.status === 'requested' || activeRide.status === 'accepted') && (
                    <button
                      onClick={cancelRide}
                      className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-lg hover:bg-red-100 transition-all active:scale-95 border border-red-100"
                    >
                      Cancel Ride
                    </button>
                  )}
                  <button className="flex-1 py-4 bg-gray-100 text-gray-900 rounded-2xl font-black text-lg hover:bg-gray-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Settings size={20} />
                    Support
                  </button>
                </div>
                
                {activeRide.status === 'in_progress' && (
                   <div className="bg-blue-50 p-6 rounded-[2rem] text-blue-800 text-center font-bold border border-blue-100">
                     Ride in progress. Sit back and enjoy the trip!
                   </div>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* All Routes Modal */}
      <AnimatePresence>
        {showAllRoutes && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 pointer-events-auto"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-xl rounded-t-[3rem] sm:rounded-[3rem] p-8 max-h-[90vh] flex flex-col shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Predefined Routes</h2>
                  <p className="text-sm text-gray-500 font-medium">Select a route for a fixed fare</p>
                </div>
                <button 
                  onClick={() => setShowAllRoutes(false)} 
                  className="p-3 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-all active:scale-95"
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                {PREDEFINED_ROUTES.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => {
                      selectPredefinedRoute(route.id);
                      setShowAllRoutes(false);
                    }}
                    className="w-full flex justify-between items-center p-5 bg-gray-50 rounded-[2rem] hover:bg-hail-green/5 hover:border-hail-green border-2 border-transparent transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                        <Navigation size={20} className="text-hail-green" />
                      </div>
                      <div>
                        <p className="font-black text-gray-900 group-hover:text-hail-green transition-colors">{route.from} → {route.to}</p>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Fixed rate trip</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-xl text-hail-green">
                        R{new Date().getHours() >= 20 || new Date().getHours() < 5 ? route.nightPrice : route.dayPrice}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                        {new Date().getHours() >= 20 || new Date().getHours() < 5 ? 'Night Rate' : 'Day Rate'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
