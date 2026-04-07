import { useState, useEffect } from 'react';
import { supabase, type Profile, type Driver, type Ride } from '@/lib/supabase';
import { Loader2, Users, Car, MapPin, LogOut, Shield, Search, Filter, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { formatZAR } from '@/lib/utils';

export default function AdminView({ user }: { user: any }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [drivers, setDrivers] = useState<(Driver & { profiles: Profile })[]>([]);
  const [rides, setRides] = useState<(Ride & { rider: Profile; driver?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'drivers' | 'rides'>('users');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [profilesRes, driversRes, ridesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*, profiles!id(*)'),
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
      <header className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-hail-green p-2 rounded-lg">
            <Shield size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">HaiZa Admin</h1>
            <p className="text-xs text-gray-400">System Overview & Management</p>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="p-2 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <span className="text-sm font-medium">Sign Out</span>
          <LogOut size={20} />
        </button>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b px-6 py-4 grid grid-cols-3 gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Users</span>
          <span className="text-2xl font-bold">{profiles.length}</span>
        </div>
        <div className="flex flex-col border-l pl-4">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Active Drivers</span>
          <span className="text-2xl font-bold">{drivers.filter(d => d.is_online).length}</span>
        </div>
        <div className="flex flex-col border-l pl-4">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Rides</span>
          <span className="text-2xl font-bold">{rides.length}</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* Tabs & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex bg-gray-200 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'users' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'drivers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Drivers
            </button>
            <button
              onClick={() => setActiveTab('rides')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'rides' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Rides
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-hail-green outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Data Tables */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {activeTab === 'users' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">User</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Joined</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredProfiles.map((profile) => (
                    <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">
                            {profile.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold">{profile.full_name}</p>
                            <p className="text-xs text-gray-500">{profile.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          profile.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          profile.role === 'owner' ? 'bg-blue-100 text-blue-700' :
                          profile.role === 'driver' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {profile.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {profile.role !== 'admin' && (
                            <button 
                              onClick={() => promoteToAdmin(profile.id)}
                              className="text-purple-600 hover:text-purple-800 transition-colors p-1"
                              title="Promote to Admin"
                            >
                              <Shield size={18} />
                            </button>
                          )}
                          <button className="text-gray-400 hover:text-red-600 transition-colors p-1">
                            <Trash2 size={18} />
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
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Driver</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Vehicle</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDrivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center font-bold text-green-600">
                            {driver.profiles.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold">{driver.profiles.full_name}</p>
                            <p className="text-xs text-gray-500">{driver.profiles.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium">{driver.vehicle_make} {driver.vehicle_model}</p>
                        <p className="text-xs text-gray-500">{driver.vehicle_plate}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${driver.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                          <span className="text-sm">{driver.is_online ? 'Online' : 'Offline'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {driver.is_approved ? (
                          <div className="flex items-center gap-1 text-green-600 text-xs font-bold uppercase">
                            <CheckCircle size={14} /> Approved
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-orange-600 text-xs font-bold uppercase">
                            <XCircle size={14} /> Pending
                          </div>
                        )}
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
                <tbody className="divide-y">
                  {filteredRides.map((ride) => (
                    <tr key={ride.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            <span className="truncate">{ride.pickup_address}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                            <span className="truncate">{ride.dropoff_address}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold">R: {ride.rider?.full_name}</p>
                        <p className="text-xs text-gray-500">D: {ride.driver?.full_name || 'Unassigned'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold">{formatZAR(ride.fare_amount)}</p>
                        <p className="text-xs text-gray-500">{ride.distance_km.toFixed(1)} km</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                          ride.status === 'completed' ? 'bg-green-100 text-green-700' :
                          ride.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          ride.status === 'requested' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {ride.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
