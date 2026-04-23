import { useState, useEffect } from 'react';

export default function Footer() {
  const [logoUrl, setLogoUrl] = useState('https://picsum.photos/seed/logo/50/50');

  useEffect(() => {
    const savedLogo = localStorage.getItem('appLogo');
    if (savedLogo) setLogoUrl(savedLogo);
  }, []);

  return (
    <footer className="bg-white dark:bg-navy p-12 mt-auto border-t border-mist dark:border-white/5 relative overflow-hidden transition-colors">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-secondary/20 to-transparent" />
      
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-6 text-center relative z-10">
        <div className="flex items-center gap-4 group">
          <div className="bg-mist p-2 rounded-xl transition-transform group-hover:scale-110">
            <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          </div>
          <p className="text-sm text-steel font-black uppercase tracking-widest">
            © {new Date().getFullYear()} eTaxi Premium Mobility
          </p>
        </div>
        <div className="flex gap-4 opacity-40 hover:opacity-100 transition-opacity">
          <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
          <div className="h-1.5 w-1.5 rounded-full bg-steel" />
          <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
        </div>
      </div>
    </footer>
  );
}
