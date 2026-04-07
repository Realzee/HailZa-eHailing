import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle, Phone, Mail, ArrowRight, Check } from 'lucide-react';

export default function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [step, setStep] = useState<'input' | 'otp' | 'profile'>('input');
  
  // Phone State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  
  // Email State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');

  // Profile State (Shared)
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'rider' | 'driver' | 'owner'>('rider');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in but missing profile
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User is logged in, check if profile exists
        const { data } = await supabase.from('profiles').select('id').eq('id', session.user.id).single();
        if (!data) {
          setStep('profile');
        }
      }
    };
    checkSession();
  }, []);

  const formatPhoneNumber = (input: string) => {
    // Remove non-digits
    let cleaned = input.replace(/\D/g, '');
    
    // Handle South African format
    if (cleaned.startsWith('27') && cleaned.length === 11) {
      return '+' + cleaned;
    }
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '+27' + cleaned.substring(1);
    }
    // If 9 digits, assume SA number without leading 0
    if (cleaned.length === 9) {
      return '+27' + cleaned;
    }
    return '+' + cleaned; // Assume international or already correct
  };

  const handlePhoneLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formattedPhone = formatPhoneNumber(phone);
      if (formattedPhone.length < 10) throw new Error('Invalid phone number');

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formattedPhone = formatPhoneNumber(phone);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;

      if (data.session) {
        // Check if profile exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.session.user.id)
          .single();

        if (profile) {
          onAuthSuccess();
        } else {
          setStep('profile');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
        if (data.user) {
          // For email signup, we can create profile immediately if we want, 
          // or let the profile step handle it. 
          // Let's go to profile step to be consistent.
          setStep('profile');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Check profile
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
           const { data: profile } = await supabase.from('profiles').select('id').eq('id', session.user.id).single();
           if (profile) onAuthSuccess();
           else setStep('profile');
        }
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-hail-green mb-2">HailZA</h1>
          <p className="text-gray-500">South Africa's Local Ride App</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 mb-4 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {step === 'profile' ? (
          <form onSubmit={handleSaveProfile} className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-semibold text-center mb-4">Complete your Profile</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-hail-green outline-none"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Thabo Molefe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">I am a</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('rider')}
                  className={`py-3 rounded-lg border font-medium transition-all text-sm ${
                    role === 'rider' 
                      ? 'bg-hail-green text-white border-hail-green shadow-md' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Rider
                </button>
                <button
                  type="button"
                  onClick={() => setRole('driver')}
                  className={`py-3 rounded-lg border font-medium transition-all text-sm ${
                    role === 'driver' 
                      ? 'bg-hail-green text-white border-hail-green shadow-md' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Driver
                </button>
                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  className={`py-3 rounded-lg border font-medium transition-all text-sm ${
                    role === 'owner' 
                      ? 'bg-hail-green text-white border-hail-green shadow-md' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Owner
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-hail-green text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition-colors flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Get Started <ArrowRight size={18} /></>}
            </button>
          </form>
        ) : (
          <>
            {/* Auth Method Tabs */}
            <div className="flex mb-6 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => { setAuthMethod('phone'); setStep('input'); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  authMethod === 'phone' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Phone size={16} /> Phone
              </button>
              <button
                onClick={() => { setAuthMethod('email'); setStep('input'); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  authMethod === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Mail size={16} /> Email
              </button>
            </div>

            {authMethod === 'phone' && (
              <form onSubmit={step === 'input' ? handlePhoneLogin : handleVerifyOtp} className="space-y-4">
                {step === 'input' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium border-r pr-2">
                        +27
                      </span>
                      <input
                        type="tel"
                        required
                        className="w-full pl-14 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-hail-green outline-none text-lg tracking-wide"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="82 123 4567"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">We'll send you a code to verify.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP Code</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-hail-green outline-none text-center text-2xl tracking-[0.5em] font-mono"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="••••••"
                      maxLength={6}
                    />
                    <button 
                      type="button" 
                      onClick={() => setStep('input')}
                      className="text-sm text-hail-green hover:underline mt-2 w-full text-center"
                    >
                      Change phone number
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-hail-green text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition-colors flex justify-center items-center"
                >
                  {loading ? <Loader2 className="animate-spin" /> : step === 'input' ? 'Send Code' : 'Verify Code'}
                </button>
              </form>
            )}

            {authMethod === 'email' && (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-hail-green outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-hail-green outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-hail-green text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition-colors flex justify-center items-center"
                >
                  {loading ? <Loader2 className="animate-spin" /> : emailMode === 'login' ? 'Sign In' : 'Sign Up'}
                </button>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setEmailMode(emailMode === 'login' ? 'signup' : 'login')}
                    className="text-hail-green hover:underline text-sm"
                  >
                    {emailMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
