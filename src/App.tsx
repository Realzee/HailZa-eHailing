import { useState, useEffect } from 'react';
import { supabase, type Profile, isSupabaseConfigured } from '@/lib/supabase';
import Auth from '@/components/Auth';
import RiderView from '@/components/RiderView';
import DriverView from '@/components/DriverView';
import OwnerView from '@/components/OwnerView';
import Setup from '@/components/Setup';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Check Configuration First
  if (!isSupabaseConfigured) {
    return <Setup />;
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
      
      if (error) throw error;
      setProfile(data);
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
      {profile.role === 'driver' ? (
        <DriverView user={session.user} />
      ) : profile.role === 'owner' ? (
        <OwnerView user={session.user} />
      ) : (
        <RiderView user={session.user} />
      )}
    </main>
  );
}
