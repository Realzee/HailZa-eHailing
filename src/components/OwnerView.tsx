import { useState, useEffect } from 'react';
import { supabase, type Profile, type Driver } from '@/lib/supabase';
import { Loader2, Users, CheckCircle, XCircle, Car, ShieldCheck, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';

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
      <div className="h-screen flex items-center justify-center bg-ice dark:bg-navy transition-colors">
        <Loader2 className="animate-spin text-secondary" size={48} />
      </div>
    );
  }

  const pendingDrivers = drivers.filter(d => !d.is_approved);
  const approvedDrivers = drivers.filter(d => d.is_approved && d.owner_id === user.id);

  return (
    <div className="min-h-screen bg-ice dark:bg-navy pb-20 transition-colors relative overflow-x-hidden custom-scrollbar overflow-y-auto">
      {/* Abstract Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="bg-white/80 dark:bg-navy/80 backdrop-blur-md border-b border-mist dark:border-white/5 px-8 py-6 flex justify-between items-center sticky top-0 z-20 transition-all">
        <div className="flex items-center gap-4">
          <div className="bg-mist dark:bg-ocean-deep p-2.5 rounded-2xl shadow-sm border border-mist dark:border-white/5">
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="h-8 w-auto" />
            ) : (
              <ShieldCheck size={28} className="text-secondary" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black text-navy dark:text-white tracking-tight font-display">Owner Dashboard</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-steel font-bold">Fleet Command Center</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button 
            onClick={handleSignOut}
            className="p-3 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-8 space-y-12 relative z-10">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium p-8 border-l-4 border-l-orange-500 flex justify-between items-center"
          >
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-steel mb-2 block">Pending Approval</span>
              <p className="text-5xl font-black tracking-tighter dark:text-white font-display leading-none">{pendingDrivers.length}</p>
            </div>
            <div className="bg-orange-500/10 p-4 rounded-2xl">
              <Users size={32} className="text-orange-500" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-premium p-8 border-l-4 border-l-secondary flex justify-between items-center"
          >
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-steel mb-2 block">My Active Fleet</span>
              <p className="text-5xl font-black tracking-tighter dark:text-white font-display leading-none">{approvedDrivers.length}</p>
            </div>
            <div className="bg-secondary/10 p-4 rounded-2xl">
              <Car size={32} className="text-secondary" />
            </div>
          </motion.div>
        </div>

        {/* Pending Onboarding */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="text-xl font-black tracking-tight text-navy dark:text-white">Pending Onboarding</h2>
          </div>
          
          {pendingDrivers.length === 0 ? (
            <div className="bg-mist/20 dark:bg-ocean-deep/20 p-12 rounded-[2.5rem] text-center border-2 border-dashed border-mist/50 dark:border-white/5 transition-colors">
              <p className="text-steel font-bold italic">Clear for now. No drivers are currently waiting for validation.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingDrivers.map((driver, idx) => (
                <motion.div 
                  key={driver.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="card-premium p-6 flex flex-col sm:flex-row items-center justify-between gap-6"
                >
                  <div className="flex items-center gap-6 w-full">
                    <div className="w-16 h-16 bg-mist dark:bg-ocean-deep rounded-2xl flex items-center justify-center text-navy dark:text-white font-black text-2xl border border-mist dark:border-white/5 shadow-inner">
                      {driver.profiles.full_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-navy dark:text-white tracking-tight leading-tight mb-1">{driver.profiles.full_name}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-xs text-steel font-bold uppercase tracking-wider">{driver.vehicle_make} {driver.vehicle_model}</span>
                        <span className="text-[10px] bg-navy dark:bg-white/10 text-white px-2 py-0.5 rounded font-mono tracking-wider">{driver.vehicle_plate}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => handleApprove(driver.id)}
                      disabled={!!actionLoading}
                      className="flex-1 sm:flex-none py-3 px-6 bg-secondary text-white rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-secondary/20"
                    >
                      {actionLoading === driver.id ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecline(driver.id)}
                      disabled={!!actionLoading}
                      className="flex-1 sm:flex-none py-3 px-6 bg-red-600/10 text-red-600 rounded-xl font-bold text-sm hover:bg-red-600 hover:text-white active:scale-95 transition-all flex items-center justify-center gap-2 border border-red-600/20"
                    >
                      {actionLoading === driver.id ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                      Decline
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* My Fleet */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-2 w-2 rounded-full bg-secondary" />
            <h2 className="text-xl font-black tracking-tight text-navy dark:text-white">Active Fleet Inventory</h2>
          </div>

          {approvedDrivers.length === 0 ? (
            <div className="bg-mist/20 dark:bg-ocean-deep/20 p-12 rounded-[2.5rem] text-center border-2 border-dashed border-mist/50 dark:border-white/5 transition-all">
              <p className="text-steel font-bold italic">Your inventory is empty. Start onboarding drivers to build your fleet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approvedDrivers.map((driver, idx) => (
                <motion.div 
                  key={driver.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="card-premium p-6 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-mist dark:bg-ocean-deep rounded-2xl flex items-center justify-center text-secondary font-black text-xl border border-mist dark:border-white/5 transition-transform group-hover:scale-110">
                      {driver.profiles.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-navy dark:text-white leading-tight mb-1">{driver.profiles.full_name}</h3>
                      <p className="text-[10px] text-steel font-bold uppercase tracking-widest">
                        {driver.vehicle_make} {driver.vehicle_model}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-secondary bg-secondary/10 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-secondary/20 transition-all group-hover:bg-secondary group-hover:text-white">
                    <ShieldCheck size={14} />
                    Verified
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
