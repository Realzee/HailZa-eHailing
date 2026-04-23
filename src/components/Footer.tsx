import { useState, useEffect } from 'react';

export default function Footer() {
  const [logoUrl, setLogoUrl] = useState('https://picsum.photos/seed/logo/50/50');

  useEffect(() => {
    const savedLogo = localStorage.getItem('appLogo');
    if (savedLogo) setLogoUrl(savedLogo);
  }, []);

  return (
    <footer className="bg-gray-900 text-white p-8 mt-auto border-t border-gray-800">
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-full shadow-lg" />
          <p className="text-sm text-gray-400 font-medium tracking-wide">
            © {new Date().getFullYear()} eTaxiDriver. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
