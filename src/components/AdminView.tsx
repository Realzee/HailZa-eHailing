import { useState, useEffect } from 'react';
import { supabase, type Profile, type Driver, type Ride } from '@/lib/supabase';
import { Loader2, Users, Car, MapPin, LogOut, Shield, Search, Filter, Trash2, CheckCircle, XCircle, X } from 'lucide-react';
import { formatZAR } from '@/lib/utils';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';
import BrandingSettings from './BrandingSettings';

// Fix Leaflet marker icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function AdminView({ user }: { user: any }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [drivers, setDrivers] = useState<(Driver & { profiles: Profile })[]>([]);
  const [rides, setRides] = useState<(Ride & { rider: Profile; driver?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'drivers' | 'rides' | 'earnings' | 'map'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<(Driver & { profiles: Profile }) | null>(null);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [editVehicleForm, setEditVehicleForm] = useState({
    vehicle_make: '',
    vehicle_model: '',
    vehicle_plate: '',
    vehicle_color: ''
  });
  const [earningsDriverFilter, setEarningsDriverFilter] = useState<string>('all');
  const [earningsDateStart, setEarningsDateStart] = useState<string>('');
  const [earningsDateEnd, setEarningsDateEnd] = useState<string>('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [profilesRes, driversRes, ridesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*, profiles:drivers_id_fkey(*)'),
        supabase.from('rides').select('*, rider:rider_id(*), driver:driver_id(*)').order('created_at', { ascending: false })
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (driversRes.error) throw driversRes.error;
      if (ridesRes.error) throw ridesRes.error;

      setProfiles(profilesRes.data || []);
      setDrivers(driversRes.data as any || []);
      setRides(ridesRes.data as any || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const promoteToAdmin = async (profileId: string) => {
    if (!window.confirm('Are you sure you want to promote this user to Admin?')) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', profileId);
      
      if (error) throw error;
      fetchAllData();
    } catch (error) {
      console.error('Error promoting user:', error);
      alert('Failed to promote user. Check console for details.');
    }
  };

  const updateDriverStatus = async (driverId: string, status: 'pending' | 'approved' | 'declined') => {
    if (!window.confirm(`Are you sure you want to mark this driver as ${status}?`)) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ 
          onboarding_status: status,
          is_approved: status === 'approved' 
        })
        .eq('id', driverId);
      
      if (error) throw error;
      fetchAllData();
      if (selectedDriver && selectedDriver.id === driverId) {
        setSelectedDriver({
          ...selectedDriver,
          onboarding_status: status,
          is_approved: status === 'approved'
        });
      }
    } catch (error) {
      console.error('Error updating driver status:', error);
      alert('Failed to update driver status.');
    }
  };

  const updateDriverVehicleDetails = async () => {
    if (!selectedDriver) return;
    try {
      const { error } = await supabase
        .from('drivers')
        .update(editVehicleForm)
        .eq('id', selectedDriver.id);
      
      if (error) throw error;
      
      fetchAllData();
      setSelectedDriver({ ...selectedDriver, ...editVehicleForm });
      setIsEditingVehicle(false);
    } catch (error) {
      console.error('Error updating vehicle details:', error);
      alert('Failed to update vehicle details.');
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDrivers = drivers.filter(d => 
    d.profiles.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.vehicle_plate?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRides = rides.filter(r => 
    r.pickup_address?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.dropoff_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDriverLocation = (driver: Driver) => {
    if (!driver.current_location) return null;
    // PostGIS geography(POINT) is usually returned as a string or GeoJSON object
    // If it's a string like "POINT(lng lat)", we parse it
    if (typeof driver.current_location === 'string') {
      const match = driver.current_location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
      if (match) {
        return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
      }
    }
    // If it's a GeoJSON object
    if (driver.current_location.coordinates) {
      return { lng: driver.current_location.coordinates[0], lat: driver.current_location.coordinates[1] };
    }
    return null;
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-hail-green" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#141414] text-[#E4E3E0] px-6 py-4 flex justify-between items-center sticky top-0 z-20 border-b border-[#141414]">
        <div className="flex items-center gap-3">
          <div className="bg-[#E4E3E0] p-2 rounded-none">
            <Shield size={24} className="text-[#141414]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">eTaxiDriver Admin</h1>
            <p className="text-xs uppercase tracking-widest opacity-60">System Management</p>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="p-2 text-[#E4E3E0] hover:opacity-70 transition-opacity flex items-center gap-2"
        >
          <ThemeToggle />
          <span className="text-sm font-medium uppercase tracking-wider">Sign Out</span>
          <LogOut size={20} />
        </button>
      </header>

      {/* Stats Bar */}
      <div className="bg-[#E4E3E0] border-b border-[#141414] px-6 py-6 grid grid-cols-3 gap-4">
        <div className="flex flex-col border-l border-[#141414] pl-4">
          <span className="text-[11px] uppercase font-serif italic opacity-50 tracking-wider">Total Users</span>
          <span className="text-3xl font-mono tracking-tighter">{profiles.length}</span>
        </div>
        <div className="flex flex-col border-l border-[#141414] pl-4">
          <span className="text-[11px] uppercase font-serif italic opacity-50 tracking-wider">Active Drivers</span>
          <span className="text-3xl font-mono tracking-tighter">{drivers.filter(d => d.is_online).length}</span>
        </div>
        <div className="flex flex-col border-l border-[#141414] pl-4">
          <span className="text-[11px] uppercase font-serif italic opacity-50 tracking-wider">Total Rides</span>
          <span className="text-3xl font-mono tracking-tighter">{rides.length}</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* Tabs & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex bg-[#141414] p-1 w-full md:w-auto">
            {['users', 'drivers', 'rides', 'earnings', 'map', 'branding'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 md:flex-none px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                  activeTab === tab ? 'bg-[#E4E3E0] text-[#141414]' : 'text-[#E4E3E0] hover:opacity-70'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            {activeTab !== 'earnings' && (
              <>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={18} />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  className="w-full pl-10 pr-4 py-2 bg-transparent border border-[#141414] focus:ring-1 focus:ring-[#141414] outline-none font-mono text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </>
            )}
          </div>
        </div>

        {/* Data Tables */}
        <div className="bg-[#E4E3E0] border border-[#141414] overflow-hidden">
          {activeTab === 'earnings' && (
            <div className="p-4 bg-white border-b flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-400" />
                <select 
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={earningsDriverFilter}
                  onChange={(e) => setEarningsDriverFilter(e.target.value)}
                >
                  <option value="all">All Drivers</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.profiles.full_name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={earningsDateStart} onChange={(e) => setEarningsDateStart(e.target.value)} />
                <span>to</span>
                <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={earningsDateEnd} onChange={(e) => setEarningsDateEnd(e.target.value)} />
              </div>
            </div>
          )}

          {activeTab === 'earnings' && (
            <div className="p-6 bg-white border-b">
              <h3 className="text-lg font-bold mb-4">Daily Earnings</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(rides
                    .filter(r => r.status === 'completed')
                    .filter(r => earningsDriverFilter === 'all' || r.driver_id === earningsDriverFilter)
                    .filter(r => !earningsDateStart || new Date(r.created_at) >= new Date(earningsDateStart))
                    .filter(r => !earningsDateEnd || new Date(r.created_at) <= new Date(earningsDateEnd))
                    .reduce((acc, ride) => {
                      const date = new Date(ride.created_at).toLocaleDateString();
                      acc[date] = (acc[date] || 0) + ride.fare_amount;
                      return acc;
                    }, {} as Record<string, number>)).map(([date, amount]) => ({ date, amount }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatZAR(value)} />
                    <Bar dataKey="amount" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="h-[600px] w-full rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <MapContainer center={[-26.2041, 28.0473]} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {drivers.filter(d => d.is_online && d.is_approved).map(driver => {
                  const loc = getDriverLocation(driver);
                  if (!loc) return null;
                  return (
                    <Marker 
                      key={driver.id} 
                      position={[loc.lat, loc.lng]}
                      eventHandlers={{ click: () => setSelectedDriver(driver) }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">{driver.profiles.full_name}</p>
                          <p className="text-gray-500">{driver.vehicle_model} ({driver.vehicle_plate})</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="border-b border-[#141414]">
                  <tr>
                    <th className="px-6 py-4 font-serif italic text-[11px] uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 font-serif italic text-[11px] uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 font-serif italic text-[11px] uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-4 font-serif italic text-[11px] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]">
                  {filteredProfiles.map((profile) => (
                    <tr key={profile.id} className="hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-mono text-xs">
                            {profile.full_name?.charAt(0)}
                          </div>
                          <div className="font-mono">
                            <p className="font-bold">{profile.full_name}</p>
                            <p className="text-xs opacity-60">{profile.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs uppercase tracking-wider">
                        {profile.role}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs opacity-60">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {profile.role !== 'admin' && (
                            <button 
                              onClick={() => promoteToAdmin(profile.id)}
                              className="hover:opacity-50 transition-opacity p-1"
                              title="Promote to Admin"
                            >
                              <Shield size={16} />
                            </button>
                          )}
                          <button className="hover:opacity-50 transition-opacity p-1">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'drivers' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="border-b border-[#141414]">
                  <tr>
                    <th className="px-6 py-4 font-serif italic text-[11px] uppercase tracking-wider">Driver</th>
                    <th className="px-6 py-4 font-serif italic text-[11px] uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-4 font-serif italic text-[11px] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 font-serif italic text-[11px] uppercase tracking-wider">Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]">
                  {filteredDrivers.map((driver) => (
                    <tr 
                      key={driver.id} 
                      className="hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors cursor-pointer"
                      onClick={() => setSelectedDriver(driver)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-mono text-xs">
                            {driver.profiles.full_name?.charAt(0)}
                          </div>
                          <div className="font-mono">
                            <p className="font-bold">{driver.profiles.full_name}</p>
                            <p className="text-xs opacity-60">{driver.profiles.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <p>{driver.vehicle_make} {driver.vehicle_model}</p>
                        <p className="opacity-60">{driver.vehicle_plate}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs uppercase tracking-wider">
                        {driver.is_online ? 'Online' : 'Offline'}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs uppercase tracking-wider">
                        {driver.onboarding_status || 'pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'rides' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Route</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Rider/Driver</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Fare</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]">
                  {filteredRides.map((ride) => (
                    <tr key={ride.id} className="hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                      <td className="px-6 py-4 max-w-xs font-mono text-xs">
                        <p className="truncate">P: {ride.pickup_address}</p>
                        <p className="truncate opacity-60">D: {ride.dropoff_address}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <p className="font-bold">R: {ride.rider?.full_name}</p>
                        <p className="opacity-60">D: {ride.driver?.full_name || 'Unassigned'}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{formatZAR(ride.fare_amount)}</td>
                      <td className="px-6 py-4 font-mono text-xs uppercase tracking-wider">{ride.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'earnings' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Driver</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Rider</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Fare</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rides
                    .filter(r => r.status === 'completed')
                    .filter(r => earningsDriverFilter === 'all' || r.driver_id === earningsDriverFilter)
                    .filter(r => !earningsDateStart || new Date(r.created_at) >= new Date(earningsDateStart))
                    .filter(r => !earningsDateEnd || new Date(r.created_at) <= new Date(earningsDateEnd))
                    .map((ride) => (
                      <tr key={ride.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm">{new Date(ride.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm font-medium">{ride.driver?.full_name || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm">{ride.rider?.full_name}</td>
                        <td className="px-6 py-4 text-sm font-bold text-hail-green">{formatZAR(ride.fare_amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Driver Details Modal */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-hail-green rounded-full flex items-center justify-center font-bold">
                  {selectedDriver.profiles.full_name?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold">{selectedDriver.profiles.full_name}</h3>
                  <p className="text-xs text-gray-400">Driver ID: {selectedDriver.id.substring(0, 8)}...</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDriver(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Left Column: Details */}
                <div className="p-6 space-y-8 border-r border-gray-100">
                  {/* Profile Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Users size={16} /> Profile Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Full Name</p>
                        <p className="font-bold">{selectedDriver.profiles.full_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Email Address</p>
                        <p className="font-bold">{selectedDriver.profiles.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                        <p className="font-bold">{selectedDriver.profiles.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Joined Date</p>
                        <p className="font-bold">{new Date(selectedDriver.profiles.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Car size={16} /> Vehicle Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Make & Model</p>
                        <p className="font-bold">{selectedDriver.vehicle_make} {selectedDriver.vehicle_model}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">License Plate</p>
                        <p className="font-bold uppercase">{selectedDriver.vehicle_plate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Color</p>
                        <p className="font-bold">{selectedDriver.vehicle_color}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Onboarding Status</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                            selectedDriver.onboarding_status === 'approved' ? 'bg-green-100 text-green-700' :
                            selectedDriver.onboarding_status === 'declined' ? 'bg-red-100 text-red-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {selectedDriver.onboarding_status || 'pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditVehicleForm({
                          vehicle_make: selectedDriver.vehicle_make,
                          vehicle_model: selectedDriver.vehicle_model,
                          vehicle_plate: selectedDriver.vehicle_plate,
                          vehicle_color: selectedDriver.vehicle_color
                        });
                        setIsEditingVehicle(true);
                      }}
                      className="mt-4 w-full bg-gray-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800 transition-colors"
                    >
                      Edit Vehicle Details
                    </button>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h4>
                    <div className="flex flex-wrap gap-3">
                      {selectedDriver.onboarding_status !== 'approved' && (
                        <button 
                          onClick={() => updateDriverStatus(selectedDriver.id, 'approved')}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={18} /> Approve Driver
                        </button>
                      )}
                      {selectedDriver.onboarding_status !== 'declined' && (
                        <button 
                          onClick={() => updateDriverStatus(selectedDriver.id, 'declined')}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle size={18} /> Decline Driver
                        </button>
                      )}
                      {selectedDriver.onboarding_status !== 'pending' && (
                        <button 
                          onClick={() => updateDriverStatus(selectedDriver.id, 'pending')}
                          className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <Filter size={18} /> Reset to Pending
                        </button>
                      )}
                      <button className="flex-1 bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                        <Trash2 size={18} /> Delete Account
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Map */}
                <div className="relative min-h-[400px] lg:min-h-0 bg-gray-100">
                  <div className="absolute top-4 left-4 z-[1000] bg-white px-3 py-1.5 rounded-lg shadow-md border flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${selectedDriver.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {selectedDriver.is_online ? 'Live Tracking' : 'Last Known Location'}
                    </span>
                  </div>

                  {getDriverLocation(selectedDriver) ? (
                    <MapContainer 
                      center={[getDriverLocation(selectedDriver)!.lat, getDriverLocation(selectedDriver)!.lng]} 
                      zoom={15} 
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker position={[getDriverLocation(selectedDriver)!.lat, getDriverLocation(selectedDriver)!.lng]}>
                        <Popup>
                          <div className="text-sm">
                            <p className="font-bold">{selectedDriver.profiles.full_name}</p>
                            <p className="text-gray-500">{selectedDriver.is_online ? 'Online' : 'Offline'}</p>
                          </div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                      <MapPin size={48} className="mb-4 opacity-20" />
                      <p className="font-bold text-gray-900">No Location Data</p>
                      <p className="text-sm max-w-xs mx-auto mt-1">This driver hasn't shared their location yet. They must be online to be tracked.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button 
                onClick={() => setSelectedDriver(null)}
                className="px-8 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vehicle Modal */}
      {isEditingVehicle && selectedDriver && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Edit Vehicle Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Make</label>
                <input
                  type="text"
                  value={editVehicleForm.vehicle_make}
                  onChange={(e) => setEditVehicleForm({...editVehicleForm, vehicle_make: e.target.value})}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <input
                  type="text"
                  value={editVehicleForm.vehicle_model}
                  onChange={(e) => setEditVehicleForm({...editVehicleForm, vehicle_model: e.target.value})}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">License Plate</label>
                <input
                  type="text"
                  value={editVehicleForm.vehicle_plate}
                  onChange={(e) => setEditVehicleForm({...editVehicleForm, vehicle_plate: e.target.value})}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Color</label>
                <input
                  type="text"
                  value={editVehicleForm.vehicle_color}
                  onChange={(e) => setEditVehicleForm({...editVehicleForm, vehicle_color: e.target.value})}
                  className="w-full border rounded-lg p-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsEditingVehicle(false)} className="px-4 py-2 bg-gray-200 rounded-lg font-bold">Cancel</button>
              <button onClick={updateDriverVehicleDetails} className="px-4 py-2 bg-hail-green text-white rounded-lg font-bold">Save</button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
