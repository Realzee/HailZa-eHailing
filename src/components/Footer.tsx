import { useState, useEffect } from 'react';

export default function Footer() {
  const [logoUrl, setLogoUrl] = useState('https://picsum.photos/seed/logo/50/50');

  useEffect(() => {
    const savedLogo = localStorage.getItem('appLogo');
    if (savedLogo) setLogoUrl(savedLogo);
  }, []);

  return (
    <footer className="bg-transparent pt-3 pb-1 px-4 mt-auto border-t border-mist/20 dark:border-white/5 relative overflow-hidden transition-colors shrink-0">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-px bg-gradient-to-r from-transparent via-secondary/5 to-transparent" />
      
      <div className="max-w-5xl mx-auto flex flex-row items-center justify-between gap-4 relative z-10 w-full opacity-60">
        <div className="flex items-center gap-2 group">
          <div className="bg-mist/50 dark:bg-ocean-deep p-1 rounded-md transition-transform group-hover:scale-105">
            <img src={logoUrl} alt="Logo" className="w-5 h-5 rounded shadow-xs" />
          </div>
          <p className="text-[10px] text-steel font-black uppercase tracking-widest opacity-80">
            © {new Date().getFullYear()} eTaxi Premium
          </p>
        </div>
        
        <div className="flex gap-2 opacity-20 hover:opacity-100 transition-opacity">
          <div className="h-1 w-1 rounded-full bg-secondary" />
          <div className="h-1 w-1 rounded-full bg-steel" />
          <div className="h-1 w-1 rounded-full bg-secondary" />
        </div>
      </div>
    </footer>
  );
}
