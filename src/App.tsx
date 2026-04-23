import { useState, useEffect } from 'react';
import { supabase, type Profile, isSupabaseConfigured } from '@/lib/supabase';
import Auth from '@/components/Auth';
import RiderView from '@/components/RiderView';
import DriverView from '@/components/DriverView';
import OwnerView from '@/components/OwnerView';
import AdminView from '@/components/AdminView';
import VerificationFlow from '@/components/VerificationFlow';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVerification, setShowVerification] = useState(false);

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

  useEffect(() => {
    const appIcon = localStorage.getItem('appIcon');
    if (appIcon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = appIcon;
    }
  }, []);

  useEffect(() => {
    if (profile && profile.verification_status === 'unverified') {
      setShowVerification(true);
    }
  }, [profile]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error || !data) {
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
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <Loader2 className="animate-spin text-hail-green" size={48} />
      </div>
    );
  }

  return (
    <main className="w-full h-screen overflow-hidden bg-gray-100 dark:bg-gray-900 relative transition-colors">
      {!isSupabaseConfigured && (
        <div className="absolute top-0 left-0 right-0 bg-orange-500 text-white text-[10px] py-1 px-2 text-center z-[9999] font-bold uppercase tracking-widest">
          Demo Mode (No Backend Connected)
        </div>
      )}
      
      {!session || !profile ? (
        <Auth onAuthSuccess={() => {}} />
      ) : showVerification ? (
        <VerificationFlow 
          user={profile} 
          onClose={() => setShowVerification(false)} 
          onComplete={() => {
            fetchProfile(session.user.id);
            setShowVerification(false);
          }} 
        />
      ) : profile.role === 'admin' ? (
        <AdminView user={session.user} />
      ) : profile.role === 'driver' ? (
        <DriverView user={session.user} onShowVerification={() => setShowVerification(true)} profile={profile} />
      ) : profile.role === 'owner' ? (
        <OwnerView user={session.user} />
      ) : (
        <RiderView user={session.user} onShowVerification={() => setShowVerification(true)} profile={profile} />
      )}
    </main>
  );
}
