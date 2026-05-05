import { useState, useEffect, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useBranding } from '../hooks/useBranding';
import { Loader2, AlertCircle, Phone, Mail, ArrowRight, Check } from 'lucide-react';

export default function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const { logoUrl: appLogo } = useBranding();
  const [step, setStep] = useState<'input' | 'profile'>('input');
  
  // Email State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');

  // Profile State (Shared)
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'rider' | 'driver' | 'owner' | 'admin'>('rider');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdminEmail = email === 'mzwelisto@gmail.com';

  // Check if user is already logged in but missing profile
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User is logged in, check if profile exists
        const { data } = await supabase.from('profiles').select('id').eq('id', session.user.id).single();
        if (!data) {
          setStep('profile');
          if (session.user.email === 'mzwelisto@gmail.com') {
            setRole('admin');
          }
        }
      }
    };
    checkSession();
  }, []);

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (emailMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        if (data.user && !data.session) {
          setError('Registration successful! Please check your email to confirm your account.');
          return;
        }

        if (data.session) {
          // Profile is created by DB trigger, so we can just succeed
          onAuthSuccess();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const updates = {
        id: session.user.id,
        email: session.user.email || '', // Might be empty for phone auth
        full_name: fullName,
        role: role,
        phone: session.user.phone,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;

      if (role === 'driver') {
        const { error: driverError } = await supabase.from('drivers').upsert({
          id: session.user.id,
          vehicle_make: 'Toyota', // Default
          vehicle_model: 'Corolla',
          vehicle_plate: 'GP 123 ZA',
          vehicle_color: 'White',
          is_online: false
        });
        if (driverError) throw driverError;
      }

      onAuthSuccess();
      // Force reload to ensure App.tsx picks up the new profile immediately
      window.location.reload(); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-navy p-6 transition-colors overflow-y-auto relative custom-scrollbar">
      {/* Abstract Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-[440px] glass rounded-3xl shadow-2xl p-10 border border-white/40 dark:border-white/5 relative z-10">
        <div className="text-center mb-12">
          {appLogo ? (
            <motion.img 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              src={appLogo} 
              alt="Logo" 
              className="h-40 w-auto object-contain mx-auto mb-6 drop-shadow-md" 
            />
          ) : (
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-6xl font-semibold text-navy dark:text-white mb-3 tracking-tighter font-display"
            >
              eTaxi
            </motion.h1>
          )}
          <p className="text-steel font-bold  tracking-[0.3em] text-xs opacity-80">Premium Mobility Solutions</p>
          
          <div className="mt-6 flex justify-center gap-2">
            {!isSupabaseConfigured && (
              <div className="px-3 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold rounded-full  tracking-wider border border-orange-500/20">
                Demo Platform
              </div>
            )}
            {isSupabaseConfigured && (
              <div className="px-3 py-1 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold rounded-full  tracking-wider border border-sky-500/20">
                Live Secure
              </div>
            )}
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 mb-6 text-sm font-medium"
          >
            <AlertCircle size={18} />
            {error}
          </motion.div>
        )}

        {step === 'profile' ? (
          <form onSubmit={handleSaveProfile} className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <h2 className="text-2xl font-semibold text-center mb-6 dark:text-white tracking-tight">Create Identity</h2>
            
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-steel  tracking-normal ml-1">Full Name</label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-white/50 dark:bg-navy/50 border border-mist dark:border-ocean-deep rounded-2xl focus:ring-2 focus:ring-secondary outline-none dark:text-white transition-all font-medium"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Thabo Molefe"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-steel  tracking-normal ml-1">Account Type</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'rider', label: 'Rider' },
                  { id: 'driver', label: 'Driver' },
                  { id: 'owner', label: 'Owner' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRole(item.id as any)}
                    className={`py-4 rounded-2xl border transition-all text-xs font-semibold  tracking-tight ${
                      role === item.id 
                        ? 'bg-secondary text-white border-secondary shadow-lg shadow-secondary/30 scale-105' 
                        : 'bg-white/50 dark:bg-navy/50 border-mist dark:border-ocean-deep text-steel hover:bg-mist dark:hover:bg-ocean'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary mt-4 flex justify-center items-center gap-3 text-lg py-4"
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Initialize App <ArrowRight size={20} /></>}
            </button>
          </form>
        ) : (
          <div className="space-y-8">
            <form onSubmit={handleEmailAuth} className="space-y-6">
              <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-steel  tracking-normal ml-1">Email Address</label>
                    <input
                      type="email"
                      required
                      className="w-full px-5 py-4 bg-white/50 dark:bg-navy/50 border border-mist dark:border-ocean-deep rounded-2xl focus:ring-2 focus:ring-secondary outline-none dark:text-white transition-all font-medium"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="driver@etaxi.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-steel  tracking-normal ml-1">Security Key</label>
                    <input
                      type="password"
                      required
                      className="w-full px-5 py-4 bg-white/50 dark:bg-navy/50 border border-mist dark:border-ocean-deep rounded-2xl focus:ring-2 focus:ring-secondary outline-none dark:text-white transition-all font-medium"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-4 text-lg"
                >
                  {loading ? <Loader2 className="animate-spin" /> : emailMode === 'login' ? 'Sign In' : 'Sign Up'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setEmailMode(emailMode === 'login' ? 'signup' : 'login')}
                    className="text-xs text-steel font-semibold  tracking-normal hover:text-secondary transition-colors"
                  >
                    {emailMode === 'login' ? "New member? Create account" : 'Existing member? Sign in'}
                  </button>
                </div>
              </form>
          </div>
        )}
      </div>
      
      <p className="mt-8 text-steel/50 text-xs font-semibold  tracking-[0.4em] relative z-10">
        © {new Date().getFullYear()} eTaxi Premium Mobility
      </p>
    </div>
  );
}
