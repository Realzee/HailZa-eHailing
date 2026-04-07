import { useState, useEffect } from 'react';
import { supabase, type Profile, isSupabaseConfigured } from '@/lib/supabase';
import Auth from '@/components/Auth';
import RiderView from '@/components/RiderView';
import DriverView from '@/components/DriverView';
import OwnerView from '@/components/OwnerView';
import AdminView from '@/components/AdminView';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Check Configuration First
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="text-orange-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">App Configuration Missing</h1>
          <p className="text-gray-500 text-sm mb-6">
            The Supabase connection details are not set. If you are the developer, please add 
            <code className="bg-gray-100 px-1 rounded mx-1">VITE_SUPABASE_URL</code> and 
            <code className="bg-gray-100 px-1 rounded mx-1">VITE_SUPABASE_ANON_KEY</code> 
            to the project settings.
          </p>
          <div className="text-xs text-gray-400 border-t pt-4">
            End users should not see this. Please ensure environment variables are configured in the platform settings.
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        // If profile doesn't exist, it will be handled by Auth component
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-hail-green" size={48} />
      </div>
    );
  }

  if (!session || !profile) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  return (
    <main className="w-full h-screen overflow-hidden bg-gray-100">
      {profile.role === 'admin' ? (
        <AdminView user={session.user} />
      ) : profile.role === 'driver' ? (
        <DriverView user={session.user} />
      ) : profile.role === 'owner' ? (
        <OwnerView user={session.user} />
      ) : (
        <RiderView user={session.user} />
      )}
    </main>
  );
}
