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

  const appLogo = localStorage.getItem('appLogo');

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <Loader2 className="animate-spin text-hail-green" size={48} />
      </div>
    );
  }

  const pendingDrivers = drivers.filter(d => !d.is_approved);
  const approvedDrivers = drivers.filter(d => d.is_approved && d.owner_id === user.id);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center sticky top-0 z-10 transition-colors">
        <div className="flex items-center gap-3">
          {appLogo ? (
            <img src={appLogo} alt="Logo" className="h-10 w-auto" />
          ) : (
            <div className="w-10 h-10 bg-hail-green rounded-xl flex items-center justify-center text-white">
              <ShieldCheck size={24} />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-hail-green">Owner Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fleet Management & Onboarding</p>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title="Sign Out"
        >
          <LogOut size={24} />
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
            <div className="flex items-center gap-3 text-hail-green mb-2">
              <Users size={20} />
              <span className="font-semibold">Pending</span>
            </div>
            <p className="text-3xl font-bold dark:text-white">{pendingDrivers.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-2">
              <ShieldCheck size={20} />
              <span className="font-semibold">My Fleet</span>
            </div>
            <p className="text-3xl font-bold dark:text-white">{approvedDrivers.length}</p>
          </div>
        </div>

        {/* Pending Onboarding */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 dark:text-white">
            <Car size={20} className="text-orange-500" />
            Pending Onboarding
          </h2>
          {pendingDrivers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl text-center border border-dashed border-gray-300 dark:border-gray-600 transition-colors">
              <p className="text-gray-500 dark:text-gray-400">No drivers waiting for approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingDrivers.map((driver) => (
                <div key={driver.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold">
                      {driver.profiles.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold dark:text-white">{driver.profiles.full_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {driver.vehicle_make} {driver.vehicle_model} • {driver.vehicle_plate}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(driver.id)}
                      disabled={!!actionLoading}
                      className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                      title="Approve"
                    >
                      {actionLoading === driver.id ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                    </button>
                    <button
                      onClick={() => handleDecline(driver.id)}
                      disabled={!!actionLoading}
                      className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
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
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 dark:text-white">
            <ShieldCheck size={20} className="text-blue-500" />
            My Approved Fleet
          </h2>
          {approvedDrivers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl text-center border border-dashed border-gray-300 dark:border-gray-600 transition-colors">
              <p className="text-gray-500 dark:text-gray-400">You haven't approved any drivers yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedDrivers.map((driver) => (
                <div key={driver.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                      {driver.profiles.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold dark:text-white">{driver.profiles.full_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {driver.vehicle_make} {driver.vehicle_model} • {driver.vehicle_plate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full text-xs font-bold transition-colors">
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
