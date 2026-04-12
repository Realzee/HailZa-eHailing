import { useState, useEffect } from 'react';

export default function Footer() {
  const [logoUrl, setLogoUrl] = useState('https://picsum.photos/seed/logo/50/50');

  useEffect(() => {
    const savedLogo = localStorage.getItem('appLogo');
    if (savedLogo) setLogoUrl(savedLogo);
  }, []);

  return (
    <footer className="bg-gray-900 text-white p-6 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-full" />
          <p className="text-sm text-gray-400">© {new Date().getFullYear()} eTaxiDriver. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
