import { useState, useEffect } from 'react';
import { supabase, type Profile, type Driver } from '@/lib/supabase';
import { Loader2, Users, CheckCircle, XCircle, Car, ShieldCheck, LogOut } from 'lucide-react';

export default function OwnerView({ user }: { user: any }) {
  const [drivers, setDrivers] = useState<(Driver & { profiles: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchDrivers();

    // Subscribe to changes in drivers table
    const subscription = supabase
      .channel('drivers_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        fetchDrivers();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          *,
          profiles:id (*)
        `);
      
      if (error) throw error;
      setDrivers(data as any);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (driverId: string) => {
    setActionLoading(driverId);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ 
          is_approved: true,
          owner_id: user.id 
        })
        .eq('id', driverId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error approving driver:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (driverId: string) => {
    setActionLoading(driverId);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ 
          is_approved: false,
          owner_id: null 
        })
        .eq('id', driverId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error declining driver:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-hail-green" size={48} />
      </div>
    );
  }

  const pendingDrivers = drivers.filter(d => !d.is_approved);
  const approvedDrivers = drivers.filter(d => d.is_approved && d.owner_id === user.id);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold text-hail-green">Owner Dashboard</h1>
          <p className="text-sm text-gray-500">Fleet Management & Onboarding</p>
        </div>
        <button 
          onClick={handleSignOut}
          className="p-2 text-gray-500 hover:text-red-600 transition-colors"
          title="Sign Out"
        >
          <LogOut size={24} />
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 text-hail-green mb-2">
              <Users size={20} />
              <span className="font-semibold">Pending</span>
            </div>
            <p className="text-3xl font-bold">{pendingDrivers.length}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 text-blue-600 mb-2">
              <ShieldCheck size={20} />
              <span className="font-semibold">My Fleet</span>
            </div>
            <p className="text-3xl font-bold">{approvedDrivers.length}</p>
          </div>
        </div>

        {/* Pending Onboarding */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Car size={20} className="text-orange-500" />
            Pending Onboarding
          </h2>
          {pendingDrivers.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center border border-dashed border-gray-300">
              <p className="text-gray-500">No drivers waiting for approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingDrivers.map((driver) => (
                <div key={driver.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold">
                      {driver.profiles.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold">{driver.profiles.full_name}</h3>
                      <p className="text-sm text-gray-500">
                        {driver.vehicle_make} {driver.vehicle_model} • {driver.vehicle_plate}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(driver.id)}
                      disabled={!!actionLoading}
                      className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                      title="Approve"
                    >
                      {actionLoading === driver.id ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                    </button>
                    <button
                      onClick={() => handleDecline(driver.id)}
                      disabled={!!actionLoading}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title="Decline"
                    >
                      {actionLoading === driver.id ? <Loader2 className="animate-spin" size={20} /> : <XCircle size={20} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My Fleet */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-500" />
            My Approved Fleet
          </h2>
          {approvedDrivers.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center border border-dashed border-gray-300">
              <p className="text-gray-500">You haven't approved any drivers yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedDrivers.map((driver) => (
                <div key={driver.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold">
                      {driver.profiles.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold">{driver.profiles.full_name}</h3>
                      <p className="text-sm text-gray-500">
                        {driver.vehicle_make} {driver.vehicle_model} • {driver.vehicle_plate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-bold">
                    <ShieldCheck size={14} />
                    Approved
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
