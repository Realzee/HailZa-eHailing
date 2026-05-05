import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useBranding() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const { data, error } = await supabase.storage.from('branding').list();
        if (error) {
          // Keep default if bucket doesnt exist or restricts access
          return;
        }
        
        if (data) {
          const logoFile = data.find(f => f.name === 'appLogo.png');
          if (logoFile) {
            const { data: publicData } = supabase.storage.from('branding').getPublicUrl('appLogo.png');
            setLogoUrl(`${publicData.publicUrl}?t=${new Date(logoFile.updated_at).getTime()}`);
          }
          const iconFile = data.find(f => f.name === 'appIcon.png');
          if (iconFile) {
            const { data: publicData } = supabase.storage.from('branding').getPublicUrl('appIcon.png');
            setIconUrl(`${publicData.publicUrl}?t=${new Date(iconFile.updated_at).getTime()}`);
            
            // Set favicon
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = `${publicData.publicUrl}?t=${new Date(iconFile.updated_at).getTime()}`;
          }
        }
      } catch (err) {
        console.warn('Could not fetch branding:', err);
      }
    };
    
    fetchBranding();
  }, []);

  return { logoUrl, iconUrl, setLogoUrl, setIconUrl };
}
