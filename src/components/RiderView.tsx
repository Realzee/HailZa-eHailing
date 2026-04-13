import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Map from '@/components/Map';
import { supabase, type Ride, type Driver } from '@/lib/supabase';
import { getRoute, reverseGeocode, formatZAR, searchAddress } from '@/lib/utils';
import { MapPin, Search, Car, CreditCard, Star, Loader2, X, CheckCircle, LogOut, Navigation, Clock, ChevronRight, History, Settings, Home } from 'lucide-react';
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedRideType, setSelectedRideType] = useState('standard');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const cancellationReasons = ['Driver too far', 'Changed mind', 'Unsafe', 'Other'];

  const RIDE_TYPES = [
    { id: 'standard', name: 'eTaxi Standard', category: 'Economy', capacity: 4, desc: 'Affordable, everyday rides', multiplier: 1, icon: Car },
    { id: 'comfort', name: 'eTaxi Comfort', category: 'Economy', capacity: 4, desc: 'Newer cars with extra legroom', multiplier: 1.3, icon: Car },
    { id: 'premium', name: 'eTaxi Black', category: 'Premium', capacity: 4, desc: 'High-end cars with top-rated drivers', multiplier: 2.1, icon: Car },
    { id: 'van', name: 'eTaxi Van', category: 'Premium', capacity: 7, desc: 'Rides for groups up to 7 people', multiplier: 2.5, icon: Car },
  ];

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
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearchingAddress(true);
        const results = await searchAddress(searchQuery);
        setSearchResults(results);
        setIsSearchingAddress(false);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length > 2) {
      setIsSearchingAddress(true);
      const results = await searchAddress(searchQuery);
      setSearchResults(results);
      setIsSearchingAddress(false);
    }
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
              className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-2 pointer-events-auto border border-gray-100 dark:border-gray-700 transition-colors"
            >
              <img src={appLogo} alt="Logo" className="h-8 w-auto" />
            </motion.div>
          )}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-3 flex items-center gap-3 pointer-events-auto max-w-md border border-gray-100 dark:border-gray-700 transition-colors"
          >
            <div className="bg-hail-green/10 p-2 rounded-xl">
              <MapPin size={20} className="text-hail-green" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Current Location</p>
              <p className="font-bold text-sm truncate text-gray-900 dark:text-white">{pickupAddress}</p>
            </div>
          </motion.div>
        </div>
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="flex gap-2">
            {(destination || activeRide) && (
              <button 
                onClick={() => {
                  if (activeRide) return; // Don't allow going back if ride is active
                  setDestination(null);
                  setRoute(undefined);
                  setRideStats(null);
                  setSearchQuery('');
                  setSearchResults([]);
                  setIsSheetMinimized(false);
                }}
                className="bg-white dark:bg-gray-800 shadow-xl p-3 rounded-2xl text-gray-900 dark:text-white hover:text-hail-green dark:hover:text-hail-green transition-all hover:scale-105 active:scale-95 border border-gray-100 dark:border-gray-700"
                title="Back"
              >
                <ChevronRight size={24} className="rotate-180" />
              </button>
            )}
            <button 
              onClick={() => {
                setDestination(null);
                setRoute(undefined);
                setRideStats(null);
                setSearchQuery('');
                setSearchResults([]);
                setIsSheetMinimized(false);
              }}
              className="bg-white dark:bg-gray-800 shadow-xl p-3 rounded-2xl text-gray-600 dark:text-gray-300 hover:text-hail-green dark:hover:text-hail-green transition-all hover:scale-105 active:scale-95 border border-gray-100 dark:border-gray-700"
              title="Home"
            >
              <Home size={20} />
            </button>
            <button 
              onClick={() => setShowHistoryModal(true)}
              className="bg-white dark:bg-gray-800 shadow-xl p-3 rounded-2xl text-gray-600 dark:text-gray-300 hover:text-hail-green dark:hover:text-hail-green transition-all hover:scale-105 active:scale-95 border border-gray-100 dark:border-gray-700"
              title="Trip History"
            >
              <History size={20} />
            </button>
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl border border-gray-100 dark:border-gray-700">
              <ThemeToggle />
            </div>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="bg-white dark:bg-gray-800 shadow-xl p-3 rounded-2xl text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-all hover:scale-105 active:scale-95 border border-gray-100 dark:border-gray-700"
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
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-6 animate-in slide-in-from-bottom duration-300 border border-gray-100 dark:border-gray-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-hail-green rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-2xl font-bold dark:text-white">Ride Completed!</h2>
              <p className="text-gray-500 dark:text-gray-400">How was your ride?</p>
            </div>

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={32} className="text-yellow-400 fill-current cursor-pointer hover:scale-110 transition-transform" />
              ))}
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl mb-6 flex justify-between items-center border border-gray-100 dark:border-gray-600">
              <span className="font-medium text-gray-700 dark:text-gray-300">Total Fare</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatZAR(activeRide.fare_amount)}</span>
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
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Select Cancellation Reason</h2>
            <div className="space-y-2 mb-6">
              {cancellationReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setCancelReason(reason)}
                  className={`w-full p-3 rounded-xl text-left font-medium transition-colors ${
                    cancelReason === reason ? 'bg-hail-green text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={confirmCancel}
                disabled={!cancelReason}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-red-700 transition-colors"
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
        className="bg-white dark:bg-gray-800 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] rounded-t-[2.5rem] z-20 max-h-[85vh] overflow-y-auto border-t border-gray-100 dark:border-gray-700 relative scrollbar-hide flex justify-center transition-colors"
      >
        <div className="w-full max-w-2xl p-6">
          {/* Handle for visual cue / Toggle */}
          <button 
            onClick={() => activeRide && (activeRide.status === 'accepted' || activeRide.status === 'in_progress') && setIsSheetMinimized(!isSheetMinimized)}
            className="w-full py-2 flex flex-col items-center cursor-pointer group mb-4"
          >
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full group-hover:bg-gray-300 dark:group-hover:bg-gray-500 transition-colors" />
            {(!activeRide || activeRide.status === 'completed') && (
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-2">
                {destination ? 'Choose a ride, or swipe up for more' : 'Where can we take you?'}
              </p>
            )}
          </button>

          {!activeRide || activeRide.status === 'completed' || activeRide.status === 'cancelled' ? (
            <div className="w-full">

            {/* Search Destination */}
            <div className="mb-8 relative">
              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-hail-green transition-colors" size={20} />
                  <input
                    type="text"
                    placeholder="Where to?"
                    className="w-full bg-gray-50 dark:bg-gray-700 rounded-2xl py-3 pl-12 pr-12 outline-none border border-gray-100 dark:border-gray-600 focus:border-hail-green focus:bg-white dark:focus:bg-gray-800 focus:ring-4 focus:ring-hail-green/5 transition-all text-base font-medium dark:text-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isSearchingAddress && <Loader2 size={16} className="animate-spin text-hail-green" />}
                    {searchQuery && !isSearchingAddress && (
                      <button 
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </form>
              
              {/* Search Results */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 w-full bg-white dark:bg-gray-800 shadow-2xl rounded-2xl mt-3 overflow-hidden border border-gray-100 dark:border-gray-700 z-30"
                  >
                    <div className="flex justify-between items-center p-4 bg-gray-50/50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                       <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Search Results</span>
                       <button onClick={() => setSearchResults([])} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"><X size={16} className="dark:text-gray-300" /></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {searchResults.map((res, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectSearchResult(res)}
                          className="w-full text-left p-4 hover:bg-hail-green/5 dark:hover:bg-hail-green/10 border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors flex items-center gap-3"
                        >
                          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400">
                            <MapPin size={18} />
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 line-clamp-1">{res.display_name}</span>
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
                  <h3 className="font-bold text-sm text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Navigation size={16} className="text-hail-green" /> Popular Routes
                  </h3>
                  <button 
                    onClick={() => setShowAllRoutes(true)}
                    className="text-xs font-bold text-hail-green hover:underline uppercase tracking-wider"
                  >
                    View All
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
                  {PREDEFINED_ROUTES.slice(0, 8).map((route) => (
                    <button
                      key={route.id}
                      onClick={() => selectPredefinedRoute(route.id)}
                      className="whitespace-nowrap bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:border-hail-green dark:hover:border-hail-green hover:bg-green-50 dark:hover:bg-hail-green/10 transition-all hover:shadow-md active:scale-95 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 bg-hail-green rounded-full" />
                      {route.from} → {route.to}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ride Selection */}
            {destination && rideStats && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 pb-24"
              >
                <div className="text-center mb-4">
                   <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Choose a ride</h2>
                </div>

                <div className="space-y-8">
                  {['Economy', 'Premium'].map((category) => (
                    <div key={category}>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4 px-2">{category}</h3>
                      <div className="space-y-2">
                        {RIDE_TYPES.filter(t => t.category === category).map((type) => (
                          <button
                            key={type.id}
                            onClick={() => setSelectedRideType(type.id)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border-2 ${
                              selectedRideType === type.id 
                                ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-700' 
                                : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl ${selectedRideType === type.id ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                <type.icon size={28} />
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-gray-900 dark:text-white">{type.name}</p>
                                  <div className="flex items-center gap-1 text-[10px] bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded font-bold dark:text-gray-300">
                                    <Star size={8} className="fill-current" />
                                    <span>{type.capacity}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{type.desc}</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-1 uppercase tracking-tighter">
                                  {Math.round(rideStats.duration / 60)} min dropoff
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-lg text-gray-900 dark:text-white">
                                {formatZAR(rideStats.price * type.multiplier)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payment Selector Mock */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-6 mt-6">
                  <button className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600 p-1.5 rounded text-white">
                        <CreditCard size={16} />
                      </div>
                      <p className="font-bold text-sm text-gray-700 dark:text-gray-200">•••• 1059</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="fixed bottom-6 left-6 right-6 z-30 max-w-2xl mx-auto">
                  <button
                    onClick={requestRide}
                    disabled={searching}
                    className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-5 rounded-2xl font-black text-xl hover:bg-black dark:hover:bg-gray-200 transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-3"
                  >
                    {searching ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>Choose {RIDE_TYPES.find(t => t.id === selectedRideType)?.name}</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          /* Active Ride Status */
          <div className="w-full">
            {isSheetMinimized ? (
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="bg-gray-900 dark:bg-gray-700 p-2 rounded-xl text-white">
                    <Car size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white">
                      {activeRide.status === 'requested' ? 'Finding Driver...' : 
                       activeRide.status === 'accepted' ? 'Driver Arriving' :
                       activeRide.status === 'in_progress' ? 'En Route' : 'Arrived'}
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter">
                      {activeRide.dropoff_address}
                    </p>
                  </div>
                </div>
                <ChevronRight size={20} className="-rotate-90 text-gray-400 dark:text-gray-500" />
              </div>
            ) : (
              <div className="space-y-8 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                      {activeRide.status === 'requested' ? 'Finding Driver' : 
                       activeRide.status === 'accepted' ? 'On the Way' :
                       activeRide.status === 'in_progress' ? 'En Route' : 'Arrived'}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
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
                       <div className="w-24 h-24 border-8 border-gray-100 dark:border-gray-700 border-t-hail-green dark:border-t-hail-green rounded-full animate-spin"></div>
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
                    className="flex items-center gap-5 p-6 bg-gray-900 dark:bg-gray-800 text-white rounded-[2.5rem] shadow-2xl border border-gray-800 dark:border-gray-700"
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
                      className="flex-1 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-black text-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-all active:scale-95 border border-red-100 dark:border-red-900/30"
                    >
                      Cancel Ride
                    </button>
                  )}
                  <button className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-black text-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Settings size={20} />
                    Support
                  </button>
                </div>
                
                {activeRide.status === 'in_progress' && (
                   <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2rem] text-blue-800 dark:text-blue-300 text-center font-bold border border-blue-100 dark:border-blue-900/30">
                     Ride in progress. Sit back and enjoy the trip!
                   </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>

      {/* Trip History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
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
              className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-t-[3rem] sm:rounded-[3rem] p-8 max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-700"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Trip History</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Your recent rides</p>
                </div>
                <button 
                  onClick={() => setShowHistoryModal(false)} 
                  className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl transition-all active:scale-95"
                >
                  <X size={24} className="text-gray-600 dark:text-gray-300" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                {rideHistory.length > 0 ? (
                  rideHistory.map((ride) => (
                    <div key={ride.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{new Date(ride.created_at).toLocaleDateString()}</span>
                        <span className="font-black text-hail-green text-lg">{formatZAR(ride.fare_amount)}</span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-500 rounded-full" />
                          {ride.dropoff_address}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                          <span className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-md">{ride.status}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-medium">
                    No recent trips found.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-t-[3rem] sm:rounded-[3rem] p-8 max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-700"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Predefined Routes</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Select a route for a fixed fare</p>
                </div>
                <button 
                  onClick={() => setShowAllRoutes(false)} 
                  className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl transition-all active:scale-95"
                >
                  <X size={24} className="text-gray-600 dark:text-gray-300" />
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
                    className="w-full flex justify-between items-center p-5 bg-gray-50 dark:bg-gray-700/50 rounded-[2rem] hover:bg-hail-green/5 dark:hover:bg-hail-green/10 hover:border-hail-green dark:hover:border-hail-green border-2 border-transparent transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all border border-gray-100 dark:border-gray-700">
                        <Navigation size={20} className="text-hail-green" />
                      </div>
                      <div>
                        <p className="font-black text-gray-900 dark:text-white group-hover:text-hail-green dark:group-hover:text-hail-green transition-colors">{route.from} → {route.to}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Fixed rate trip</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-xl text-hail-green">
                        R{new Date().getHours() >= 20 || new Date().getHours() < 5 ? route.nightPrice : route.dayPrice}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">
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
