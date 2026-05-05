import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Map from '@/components/Map';
import { supabase, type Ride, type Driver, type Hazard, type Profile } from '@/lib/supabase';
import { getRoute, reverseGeocode, formatZAR, searchAddress } from '@/lib/utils';
import StatusModal from './StatusModal';
import { MapPin, Search, Car, CreditCard, Star, Loader2, X, CheckCircle, LogOut, Navigation, Clock, ChevronRight, History, Settings, Home, Banknote, Wallet, Users, Info, ShieldCheck, AlertTriangle, TriangleAlert } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';
import { HazardsPanel } from './HazardsPanel';
import { useBranding } from '../hooks/useBranding';
import { PREDEFINED_ROUTES, getPriceForRoute, calculateTotalFare } from '@/constants/pricing';

interface RiderViewProps {
  user: any;
  profile: any;
  onShowVerification: () => void;
}

export default function RiderView({ user, profile, onShowVerification }: RiderViewProps) {
  const { logoUrl: appLogo } = useBranding();
  const [location, setLocation] = useState<[number, number]>([-26.2041, 28.0473]); // JHB Default
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [pickupAddress, setPickupAddress] = useState('Locating...');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [route, setRoute] = useState<[number, number][] | undefined>(undefined);
  const [rideStats, setRideStats] = useState<{ distance: number; duration: number; price: number } | null>(null);
  const [activeRide, setActiveRide] = useState<(Ride & { driver_profile?: Profile; driver_info?: Driver }) | null>(null);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchingType, setSearchingType] = useState<'pickup' | 'destination'>('destination');
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
  const [passengerCount, setPassengerCount] = useState(1);
  const [showHazardsPanel, setShowHazardsPanel] = useState(false);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'confirm' | 'info' | 'loading' | 'warning';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });

  const showModal = (type: any, title: string, message: string, onConfirm?: () => void) => {
    setModal({ isOpen: true, type, title, message, onConfirm });
  };

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
  const cancellationReasons = ['Driver too far', 'Changed mind', 'Unsafe', 'Other'];

  const RIDE_TYPES = [
    { id: 'standard', name: 'eTaxi Standard', category: 'Economy', capacity: 4, desc: 'Affordable, everyday rides', multiplier: 1, icon: Car },
    { id: 'comfort', name: 'eTaxi Comfort', category: 'Economy', capacity: 4, desc: 'Newer cars with extra legroom', multiplier: 1.3, icon: Car },
    { id: 'premium', name: 'eTaxi Black', category: 'Premium', capacity: 4, desc: 'High-end cars with top-rated drivers', multiplier: 2.1, icon: Car },
    { id: 'van', name: 'eTaxi Van', category: 'Premium', capacity: 7, desc: 'Rides for groups up to 7 people', multiplier: 2.5, icon: Car },
  ];

  // 1. Get User Location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setPickupAddress('Locating...');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation([lat, lng]);
          const addr = await reverseGeocode(lat, lng);
          setPickupAddress(addr);
          
          if (destination) {
            const routeData = await getRoute([lat, lng], destination);
            if (routeData) {
              setRoute(routeData.coordinates);
              const distKm = routeData.distance / 1000;
              setRideStats(prev => prev ? {
                ...prev,
                distance: distKm,
                duration: routeData.duration
              } : null);
            }
          }
        },
        (err) => {
          console.error(err);
          setPickupAddress('Location Error');
        },
        { enableHighAccuracy: true }
      );
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  // 2. Listen for Active Rides
  useEffect(() => {
    const fetchActiveRide = async () => {
      const { data } = await supabase
        .from('rides')
        .select(`
          *,
          driver_profile:driver_id(full_name, verification_status),
          driver_info:driver_id(vehicle_make, vehicle_model, vehicle_plate, vehicle_color)
        `)
        .eq('rider_id', user.id)
        .in('status', ['requested', 'accepted', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (data && data.length > 0) {
        const ride = data[0];
        setActiveRide(ride as any);
        if (ride.status === 'completed') {
           setShowPayment(true);
        }
      }
    };

    fetchActiveRide();
    fetchRideHistory();
    fetchDrivers();
    fetchHazards();

    const hazardsChannel = supabase
      .channel('hazards_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hazards' },
        () => fetchHazards()
      )
      .subscribe();

    const rideChannel = supabase
      .channel('rider_rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `rider_id=eq.${user.id}` },
        async (payload) => {
          const newRide = payload.new as Ride;
          
          if (newRide.driver_id) {
            // Fetch driver details if they joined
            const { data: driverProfile } = await supabase.from('profiles').select('full_name, verification_status').eq('id', newRide.driver_id).single();
            const { data: driverInfo } = await supabase.from('drivers').select('vehicle_make, vehicle_model, vehicle_plate, vehicle_color').eq('id', newRide.driver_id).single();
            
            setActiveRide({
              ...newRide,
              driver_profile: driverProfile as any,
              driver_info: driverInfo as any
            });
          } else {
            setActiveRide(newRide as any);
          }
          
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
      supabase.removeChannel(hazardsChannel);
    };
  }, [user.id]);

  const fetchRideHistory = async () => {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('rider_id', user.id)
      .in('status', ['completed', 'paid'])
      .order('created_at', { ascending: false });
    
    if (data) {
      setRideHistory(data);
    }
  };

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_online', true)
        .eq('is_approved', true);
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('not found')) {
          console.warn('Drivers table not found.');
          return;
        }
        throw error;
      }
      if (data) {
        setDrivers(data);
      }
    } catch (err) {
      console.error('Error fetching drivers:', err);
    }
  };

  const fetchHazards = async () => {
    try {
      const { data, error } = await supabase
        .from('hazards')
        .select('*')
        .gt('expires_at', new Date().toISOString());
        
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('not found')) {
          console.warn('Hazards table not found. Please ensure database schema is applied.');
          return;
        }
        throw error;
      }
      if (data) setHazards(data);
    } catch (err) {
      console.error('Error fetching hazards:', err);
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

  // 3. Handle Map Click (Set Pickup or Destination)
  const handleMapClick = async (lat: number, lng: number) => {
    if (activeRide && activeRide.status !== 'cancelled') return;
    
    // Reset if previous ride was cancelled
    if (activeRide && activeRide.status === 'cancelled') {
        setActiveRide(null);
    }

    if (searchingType === 'pickup') {
      setLocation([lat, lng]);
      const addr = await reverseGeocode(lat, lng);
      setPickupAddress(addr);
      setSearchingType('destination');
      
      if (destination) {
        const routeData = await getRoute([lat, lng], destination);
        if (routeData) {
          setRoute(routeData.coordinates);
          const distKm = routeData.distance / 1000;
          setRideStats(prev => prev ? {
            ...prev,
            distance: distKm,
            duration: routeData.duration
          } : null);
        }
      }
    } else {
      setDestination([lat, lng]);
      const addr = await reverseGeocode(lat, lng);
      setDropoffAddress(addr);
      setSelectedRouteId(null);
      
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
    }
  };

  const handlePickupDragEnd = async (lat: number, lng: number) => {
    if (activeRide && activeRide.status !== 'cancelled') return;
    setLocation([lat, lng]);
    const addr = await reverseGeocode(lat, lng);
    setPickupAddress(addr);
    
    if (destination) {
      const routeData = await getRoute([lat, lng], destination);
      if (routeData) {
        setRoute(routeData.coordinates);
        const distKm = routeData.distance / 1000;
        const price = getPriceForRoute(selectedRouteId, distKm);
        setRideStats({
          distance: distKm,
          duration: routeData.duration,
          price
        });
      }
    }
  };

  const handleDestinationDragEnd = async (lat: number, lng: number) => {
    if (activeRide && activeRide.status !== 'cancelled') return;
    setDestination([lat, lng]);
    const addr = await reverseGeocode(lat, lng);
    setDropoffAddress(addr);
    
    const routeData = await getRoute(location, [lat, lng]);
    if (routeData) {
      setRoute(routeData.coordinates);
      const distKm = routeData.distance / 1000;
      const price = getPriceForRoute(selectedRouteId, distKm);
      setRideStats({
        distance: distKm,
        duration: routeData.duration,
        price
      });
    }
  };

  // 4. Request Ride
  const requestRide = async () => {
    if (!destination || !rideStats) return;

    if (profile?.verification_status !== 'verified') {
      onShowVerification();
      return;
    }

    setSearching(true);
    showModal('loading', 'Requesting Ride', 'Finding the nearest driver for you...');
    
    try {
      const { error } = await supabase.from('rides').insert({
        rider_id: user.id,
        pickup_lat: location[0],
        pickup_lng: location[1],
        dropoff_lat: destination[0],
        dropoff_lng: destination[1],
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        fare_amount: calculateTotalFare(rideStats.price * (RIDE_TYPES.find(t => t.id === selectedRideType)?.multiplier || 1), passengerCount),
        distance_km: rideStats.distance,
        passenger_count: passengerCount,
        status: 'requested'
      });
      
      if (error) throw error;
      closeModal();
    } catch (err) {
      console.error('Error requesting ride:', err);
      setSearching(false);
      showModal('error', 'Request Failed', 'We couldn\'t process your ride request. Please try again.');
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
    }, 350);

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
    const addr = result.title || result.display_name.split(',')[0];
    
    setSearchResults([]);
    setSearchQuery('');
    
    if (searchingType === 'pickup') {
      setLocation([lat, lng]);
      setPickupAddress(addr);
      setSearchingType('destination'); // Auto-switch to destination after pickup
      if (destination) {
        const routeData = await getRoute([lat, lng], destination);
        if (routeData) {
          setRoute(routeData.coordinates);
          const distKm = routeData.distance / 1000;
          setRideStats(prev => prev ? {
            ...prev,
            distance: distKm,
            duration: routeData.duration
          } : null);
        }
      }
    } else {
      setDestination([lat, lng]);
      setDropoffAddress(addr);
      setSelectedRouteId(null);
      
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
    }
  };

  const handlePayment = async (method: string) => {
    if (!activeRide) return;
    setProcessingPayment(true);
    showModal('loading', 'Processing Payment', `Securely processing your ${method} payment...`);
    
    try {
      // Update ride status to paid
      const { error } = await supabase
        .from('rides')
        .update({ status: 'paid' })
        .eq('id', activeRide.id);
        
      if (error) throw error;
      
      // Simulate payment processing delay
      setTimeout(() => {
        setProcessingPayment(false);
        setShowPayment(false);
        setActiveRide(null);
        setDestination(null);
        setRoute(undefined);
        setRideStats(null);
        showModal('success', 'Payment Successful', `Your payment via ${method} has been processed. Thank you for riding with eTaxi!`);
      }, 1500);
    } catch (err) {
      console.error('Payment error:', err);
      setProcessingPayment(false);
      showModal('error', 'Payment Failed', 'Transaction could not be completed. Please try again.');
    }
  };

  const cancelRide = () => {
    if (!activeRide) return;
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!activeRide || !cancelReason) return;
    
    showModal(
      'confirm',
      'Cancel Ride?',
      'Are you sure you want to cancel? Frequent cancellations may affect your account status.',
      async () => {
        const { error } = await supabase
          .from('rides')
          .update({ status: 'cancelled' })
          .eq('id', activeRide.id);
          
        if (error) {
          console.error('Error cancelling ride:', error);
          showModal('error', 'Cancellation Failed', 'We couldn\'t cancel your ride at this time.');
        } else {
          setActiveRide(null);
          setDestination(null);
          setRoute(undefined);
          setRideStats(null);
          setShowCancelModal(false);
          setCancelReason('');
          showModal('success', 'Ride Cancelled', 'Your ride has been successfully cancelled.');
        }
      }
    );
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

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <StatusModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
      />
      {/* Map Layer - Full Screen Background */}
      <div className="absolute inset-0 z-0">
        <Map
          center={location}
          markers={[
            { position: location, type: 'user', title: 'You', draggable: !activeRide || activeRide.status === 'cancelled', onDragEnd: handlePickupDragEnd },
            ...(destination ? [{ position: destination, type: 'destination' as const, title: 'Dropoff', draggable: !activeRide || activeRide.status === 'cancelled', onDragEnd: handleDestinationDragEnd }] : []),
            ...drivers.map(d => {
              const loc = getDriverLocation(d);
              return loc ? { position: [loc.lat, loc.lng] as [number, number], type: 'driver' as const, title: 'Available Driver' } : null;
            }).filter(m => m !== null) as any[],
            ...hazards.map(h => ({
              position: [h.lat, h.lng] as [number, number],
              type: 'hazard' as const,
              title: `${h.type.toUpperCase()}: ${h.description}`
            }))
          ]}
          route={route}
          onMapClick={handleMapClick}
          interactive={!activeRide || activeRide.status === 'cancelled'}
        />

        {/* Hazard Button */}
        <button
          onClick={() => setShowHazardsPanel(true)}
          className="absolute top-20 right-4 z-10 bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 group transition-all active:scale-95"
          title="Report Hazard"
        >
          <TriangleAlert size={20} className="text-red-600 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      <div className="absolute top-0 left-0 w-full p-6 z-10 pointer-events-none flex justify-between items-start">
        <div className="flex items-start gap-3">
          {appLogo && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-2.5 rounded-2xl pointer-events-auto shadow-2xl border-white/40 dark:border-white/5"
            >
              <img src={appLogo} alt="Logo" className="h-9 w-auto" />
            </motion.div>
          )}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-4 flex items-center gap-4 pointer-events-auto max-w-sm rounded-[1.5rem] shadow-2xl border-white/40 dark:border-white/5"
          >
            <div className="bg-secondary/15 p-3 rounded-2xl">
              <MapPin size={22} className="text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-secondary font-semibold  tracking-wide leading-none mb-1.5 px-0.5">Your Location</p>
              <p className="font-bold text-sm font-sans truncate text-navy dark:text-white">{pickupAddress}</p>
            </div>
          </motion.div>

          {drivers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass px-4 py-2 rounded-full flex items-center gap-2 pointer-events-auto border-white/40 dark:border-white/5 shadow-xl"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold  tracking-normal text-navy dark:text-white">
                {drivers.length} Driver{drivers.length > 1 ? 's' : ''} Online
              </span>
            </motion.div>
          )}
        </div>
        <div className="flex flex-col gap-3 pointer-events-auto p-2 items-end">
          <ThemeToggle />
          <div className="flex gap-3">
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
                className="bg-white dark:bg-gray-800 shadow-xl p-3 rounded-2xl text-gray-900 dark:text-white hover:text-secondary dark:hover:text-secondary transition-all hover:scale-105 active:scale-95 border border-gray-100 dark:border-gray-700"
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
              className="bg-white dark:bg-gray-800 shadow-xl p-3 rounded-2xl text-gray-600 dark:text-gray-300 hover:text-secondary dark:hover:text-secondary transition-all hover:scale-105 active:scale-95 border border-gray-100 dark:border-gray-700"
              title="Home"
            >
              <Home size={20} />
            </button>
            <button 
              onClick={() => setShowHistoryModal(true)}
              className="bg-white dark:bg-gray-800 shadow-xl p-3 rounded-2xl text-gray-600 dark:text-gray-300 hover:text-secondary dark:hover:text-secondary transition-all hover:scale-105 active:scale-95 border border-gray-100 dark:border-gray-700"
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
              className="bg-secondary text-white shadow-xl p-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs  tracking-normal transition-all hover:scale-105 active:scale-95"
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
          <div className="bg-ice dark:bg-navy w-full max-w-md rounded-2xl p-6 animate-in slide-in-from-bottom duration-300 border border-mist dark:border-ocean-deep shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-secondary rounded-full flex items-center justify-center mx-auto mb-4">
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

            <div className="bg-mist dark:bg-ocean-deep/30 p-4 rounded-xl mb-6 flex justify-between items-center border border-mist dark:border-ocean-deep">
              <span className="font-medium text-ocean dark:text-steel">Total Fare</span>
              <span className="text-2xl font-bold text-navy dark:text-white">{formatZAR(activeRide.fare_amount)}</span>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handlePayment('Paystack')}
                disabled={processingPayment}
                className="w-full bg-secondary text-white py-4 rounded-xl font-bold text-lg hover:bg-green-800 transition-colors flex items-center justify-center gap-2"
              >
                {processingPayment ? <Loader2 className="animate-spin" /> : <>Pay with Card (Paystack) <CreditCard size={20} /></>}
              </button>
              
              <button
                onClick={() => handlePayment('Cash')}
                disabled={processingPayment}
                className="w-full bg-gray-900 dark:bg-gray-700 text-white py-4 rounded-xl font-bold text-lg hover:bg-black dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
              >
                {processingPayment ? <Loader2 className="animate-spin" /> : <>Pay with Cash <Banknote size={20} /></>}
              </button>

              <button
                onClick={() => handlePayment('Wallet')}
                disabled={processingPayment}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {processingPayment ? <Loader2 className="animate-spin" /> : <>Pay with Wallet <Wallet size={20} /></>}
              </button>
            </div>
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
                    cancelReason === reason ? 'bg-secondary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
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

      {/* Controls Container */}
      <AnimatePresence>
        {(!isSheetMinimized || (!activeRide && !destination)) && (
          <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white dark:bg-navy shadow-2xl rounded-3xl z-20 border border-gray-100 dark:border-ocean-deep flex flex-col overflow-visible"
          >
            <div className="w-full flex-1 mx-auto flex flex-col pt-5 px-5 pb-5">
              {(!activeRide || activeRide.status === 'cancelled') && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 px-1">
                  {destination ? 'Review route' : 'Where can we take you?'}
                </p>
              )}

          {!activeRide || activeRide.status === 'cancelled' ? (
            <div className="w-full">
              
              {profile?.verification_status !== 'verified' && (
                <motion.button
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={onShowVerification}
                  className="w-full mb-4 p-3 bg-orange-50/50 dark:bg-orange-500/5 border border-orange-100/50 dark:border-orange-500/10 rounded-2xl flex items-center gap-3 group transition-all hover:bg-orange-50 dark:hover:bg-orange-500/10"
                >
                  <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg text-orange-600 shadow-sm border border-orange-100/30 dark:border-white/5">
                    {profile?.verification_status === 'pending' ? <Clock size={16} className="animate-pulse" /> : <AlertTriangle size={16} />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-semibold text-orange-900 dark:text-orange-400  tracking-normal">
                      {profile?.verification_status === 'pending' ? 'Verification Pending' : 'Action Required'}
                    </p>
                    <p className="text-xs text-orange-700/80 dark:text-orange-300/60 font-bold leading-tight line-clamp-1">
                      {profile?.verification_status === 'pending' 
                        ? 'Your documents are being reviewed.' 
                        : 'Verify your ID and face to unlock all features.'}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-orange-400 opacity-60 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              )}

              {/* Pickup & Destination Inputs */}
              <div className="mb-4 space-y-2">
                {/* Pickup Toggle */}
                <div 
                  onClick={() => setSearchingType('pickup')}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    searchingType === 'pickup' 
                      ? 'border-secondary bg-secondary/5 ring-2 ring-hail-green/10' 
                      : 'border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="w-6 h-6 flex items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <div className="w-2 h-2 rounded-full border-2 border-current" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold  tracking-wider text-gray-400 dark:text-gray-500">Pick-up Location</p>
                    <p className={`text-sm font-bold truncate ${searchingType === 'pickup' ? 'text-navy dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                      {pickupAddress}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      getCurrentLocation();
                    }}
                    className="p-1.5 hover:bg-secondary/10 rounded-lg text-secondary transition-colors"
                    title="Use Current Location"
                  >
                    <Navigation size={14} />
                  </button>
                </div>

                {/* Destination Toggle */}
                <div 
                  onClick={() => setSearchingType('destination')}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    searchingType === 'destination' 
                      ? 'border-secondary bg-secondary/5 ring-2 ring-hail-green/10' 
                      : 'border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                    <MapPin size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold  tracking-wider text-gray-400 dark:text-gray-500">Where to?</p>
                    <p className={`text-sm font-bold truncate ${searchingType === 'destination' ? 'text-navy dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                      {dropoffAddress || 'Search destination'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Universal Search Bar */}
            <div className="mb-4 relative">
              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1 group">
                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searchingType === 'pickup' ? 'text-secondary' : 'text-blue-500'}`} size={18} />
                  <input
                    type="text"
                    placeholder={searchingType === 'pickup' ? "Change pick-up address..." : "Search for destination..."}
                    className="w-full bg-gray-50/80 dark:bg-slate-800/40 rounded-xl py-2.5 pl-11 pr-11 outline-none border border-gray-100 dark:border-white/5 focus:border-secondary focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-hail-green/5 transition-all text-sm font-medium dark:text-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus={!isSheetMinimized}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isSearchingAddress && <Loader2 size={16} className="animate-spin text-secondary" />}
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
                    className="absolute bottom-[calc(100%+12px)] left-0 w-full bg-white dark:bg-navy shadow-2xl rounded-2xl overflow-hidden border border-gray-100 dark:border-ocean-deep z-30"
                  >
                    <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-ocean border-b border-gray-100 dark:border-ocean-deep">
                       <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Search Results</span>
                       <button onClick={() => setSearchResults([])} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={16} className="text-gray-500 dark:text-gray-300" /></button>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                      {searchResults.map((res, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectSearchResult(res)}
                          className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-ocean rounded-xl border-b border-gray-50/50 dark:border-ocean-deep/50 last:border-0 transition-all flex items-center gap-3 active:scale-[0.99]"
                        >
                          <div className="p-2.5 bg-gray-100 dark:bg-ocean rounded-lg text-gray-500">
                            <MapPin size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {res.title || res.display_name.split(',')[0]}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {res.subtitle || res.display_name}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Predefined Routes */}
            {!destination && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 px-1">
                    <Navigation size={14} className="text-secondary" /> Popular Routes
                  </h3>
                  <button 
                    onClick={() => setShowAllRoutes(true)}
                    className="text-xs font-semibold text-secondary hover:underline px-1"
                  >
                    View All
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar -mx-2 px-2">
                  {PREDEFINED_ROUTES.slice(0, 8).map((route) => (
                    <button
                      key={route.id}
                      onClick={() => selectPredefinedRoute(route.id)}
                      className="whitespace-nowrap bg-gray-50 dark:bg-ocean border border-gray-100 dark:border-ocean-deep px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:border-secondary dark:hover:border-secondary transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                    >
                      <div className="w-1.5 h-1.5 bg-secondary/80 rounded-full" />
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
                className="space-y-6 pb-20"
              >
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-2xl flex items-start gap-3">
                  <Info className="text-blue-600 dark:text-blue-400 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-bold text-blue-900 dark:text-blue-200">Mandatory Verification</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">Please ensure all passengers are registered or verified before travel.</p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-600">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <Users size={20} className="text-secondary" />
                      <span className="font-bold text-gray-900 dark:text-white">Passengers</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))}
                        className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center font-bold text-xl border border-gray-100 dark:border-gray-700"
                      >-</button>
                      <span className="font-semibold text-xl w-4 text-center dark:text-white">{passengerCount}</span>
                      <button 
                        onClick={() => setPassengerCount(Math.min(4, passengerCount + 1))}
                        className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center font-bold text-xl border border-gray-100 dark:border-gray-700"
                      >+</button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-bold  tracking-normal">+ R10 per additional passenger</p>
                </div>

                <div className="text-center mb-2">
                   <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500  tracking-normal opacity-60">Choose your mobility</h2>
                </div>

                <div className="space-y-6">
                  {['Economy', 'Premium'].map((category) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 px-1 tracking-tight">{category}</h3>
                      <div className="space-y-1.5">
                        {RIDE_TYPES.filter(t => t.category === category).map((type) => (
                          <button
                            key={type.id}
                            onClick={() => setSelectedRideType(type.id)}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border ${
                              selectedRideType === type.id 
                                ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-slate-800/80 shadow-sm' 
                                : 'border-transparent hover:bg-gray-50/50 dark:hover:bg-slate-800/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-xl transition-colors ${selectedRideType === type.id ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100/80 dark:bg-slate-800 text-gray-500 dark:text-gray-500'}`}>
                                <type.icon size={22} />
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-sm text-gray-900 dark:text-white leading-none">{type.name}</p>
                                  <div className="flex items-center gap-0.5 text-[8px] bg-gray-200 dark:bg-slate-700 px-1 py-0.5 rounded font-semibold dark:text-gray-400 ">
                                    <Star size={6} className="fill-current" />
                                    <span>{type.capacity}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight mt-0.5 line-clamp-1">{type.desc}</p>
                                <p className="text-[8px] text-gray-400 dark:text-gray-500 font-semibold mt-1  tracking-wider opacity-60">
                                  {Math.round(rideStats.duration / 60)} min · Reliable
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-base text-gray-900 dark:text-white">
                                {formatZAR(calculateTotalFare(rideStats.price * type.multiplier, passengerCount))}
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

                <div className="fixed bottom-6 left-6 right-6 z-30 max-w-md mx-auto">
                  <button
                    onClick={requestRide}
                    disabled={searching}
                    className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-5 rounded-2xl font-semibold text-xl hover:bg-black dark:hover:bg-gray-200 transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-3"
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
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {activeRide.status === 'requested' ? 'Finding Driver...' : 
                       activeRide.status === 'accepted' ? (activeRide.driver_profile?.full_name ? `Driver ${activeRide.driver_profile.full_name} Arriving` : 'Driver Arriving') :
                       activeRide.status === 'in_progress' ? 'En Route' : 'Arrived'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold  tracking-tighter">
                      {activeRide.driver_info ? `${activeRide.driver_info.vehicle_make} ${activeRide.driver_info.vehicle_model} • ${activeRide.driver_info.vehicle_plate}` : activeRide.dropoff_address}
                    </p>
                  </div>
                </div>
                <ChevronRight size={20} className="-rotate-90 text-gray-400 dark:text-gray-500" />
              </div>
            ) : (
              <div className="space-y-8 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
                      {activeRide.status === 'requested' ? 'Finding Driver' : 
                       activeRide.status === 'accepted' ? 'Driver on the Way' :
                       activeRide.status === 'in_progress' ? 'En Route' : 'Arrived'}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      {activeRide.status === 'requested' ? 'Searching for nearby drivers...' : 
                       activeRide.status === 'accepted' ? `${activeRide.driver_profile?.full_name || 'Your driver'} is heading to you` :
                       activeRide.status === 'in_progress' ? 'You are on your way' : 'Your ride is complete'}
                    </p>
                  </div>
                  <div className="bg-secondary/10 text-secondary px-4 py-2 rounded-2xl text-xs font-semibold  tracking-normal border border-secondary/20">
                    {activeRide.status}
                  </div>
                </div>

                {activeRide.status === 'requested' && (
                   <div className="flex justify-center py-12">
                     <div className="relative">
                       <div className="w-24 h-24 border-8 border-gray-100 dark:border-gray-700 border-t-hail-green dark:border-t-hail-green rounded-full animate-spin"></div>
                       <div className="absolute inset-0 flex items-center justify-center">
                         <Search size={32} className="text-secondary animate-pulse" />
                       </div>
                     </div>
                   </div>
                )}

                {(activeRide.status === 'accepted' || activeRide.status === 'in_progress') && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-5 p-6 bg-gray-900 dark:bg-gray-800 text-white rounded-3xl shadow-2xl border border-gray-800 dark:border-gray-700"
                  >
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                      <Car size={32} className="text-secondary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-xl">{activeRide.driver_profile?.full_name || 'Driver'}</p>
                      <p className="text-sm text-gray-400 font-bold tracking-normal ">
                        {activeRide.driver_info ? `${activeRide.driver_info.vehicle_make} ${activeRide.driver_info.vehicle_model}` : 'Toyota Corolla'}
                      </p>
                      <p className="text-xs text-gray-500 font-bold tracking-normal ">
                        {activeRide.driver_info ? `${activeRide.driver_info.vehicle_plate} • ${activeRide.driver_info.vehicle_color}` : 'GP 123 ZA • White'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 font-semibold text-xl">
                        <span>4.8</span>
                        <Star size={18} className="text-hail-gold fill-current" />
                      </div>
                      <p className="text-xs font-bold text-gray-500  tracking-normal">Driver Rating</p>
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  {(activeRide.status === 'requested' || activeRide.status === 'accepted') && (
                    <button
                      onClick={cancelRide}
                      className="flex-1 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-semibold text-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-all active:scale-95 border border-red-100 dark:border-red-900/30"
                    >
                      Cancel Ride
                    </button>
                  )}
                  <button className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-semibold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 flex items-center justify-center gap-2">
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
        )}
      </AnimatePresence>

      <div className="absolute top-0 opacity-0 pointer-events-none">
        <Footer />
      </div>

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
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Trip History</h2>
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
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500  tracking-normal">{new Date(ride.created_at).toLocaleDateString()}</span>
                        <span className="font-semibold text-secondary text-lg">{formatZAR(ride.fare_amount)}</span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-500 rounded-full" />
                          {ride.dropoff_address}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400  tracking-normal">
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
        {showHazardsPanel && (
          <HazardsPanel
            onClose={() => setShowHazardsPanel(false)}
            currentLat={location[0]}
            currentLng={location[1]}
            reporterId={user.id}
          />
        )}
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
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Predefined Routes</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Select a route for a fixed fare</p>
                </div>
                <button 
                  onClick={() => setShowAllRoutes(false)} 
                  className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl transition-all active:scale-95"
                >
                  <X size={24} className="text-gray-600 dark:text-gray-300" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {PREDEFINED_ROUTES.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => {
                      selectPredefinedRoute(route.id);
                      setShowAllRoutes(false);
                    }}
                    className="w-full flex justify-between items-center p-5 bg-gray-50 dark:bg-gray-700/50 rounded-[2rem] hover:bg-secondary/5 dark:hover:bg-secondary/10 hover:border-secondary dark:hover:border-secondary border-2 border-transparent transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all border border-gray-100 dark:border-gray-700">
                        <Navigation size={20} className="text-secondary" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white group-hover:text-secondary dark:group-hover:text-secondary transition-colors">{route.from} → {route.to}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold  tracking-normal">Fixed rate trip</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-xl text-secondary">
                        R{new Date().getHours() >= 20 || new Date().getHours() < 5 ? route.nightPrice : route.dayPrice}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500  font-bold tracking-normal">
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
    </div>
  );
}
