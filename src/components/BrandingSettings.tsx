import React, { useState } from 'react';

export default function BrandingSettings() {
  const [logo, setLogo] = useState(localStorage.getItem('appLogo') || '');
  const [icon, setIcon] = useState(localStorage.getItem('appIcon') || '');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    localStorage.setItem('appLogo', logo);
    localStorage.setItem('appIcon', icon);
    
    // Immediately update favicon
    if (icon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = icon;
    }
    
    alert('Branding updated! Changes applied.');
  };

  return (
    <div className="bg-ice dark:bg-navy p-6 rounded-2xl shadow-xl border border-mist dark:border-ocean-deep transition-colors">
      <h3 className="text-xl font-black mb-6 dark:text-white tracking-tight uppercase">Branding Settings</h3>
      <div className="space-y-6">
        <div className="bg-mist/30 dark:bg-ocean-deep/30 p-4 rounded-xl border border-mist dark:border-ocean-deep">
          <label className="block text-xs font-black text-ocean dark:text-steel uppercase tracking-widest mb-2">App Logo (Sidebar/Auth)</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setLogo)} className="w-full text-sm text-navy dark:text-steel file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-secondary file:text-white hover:file:bg-sky-bright transition-all" />
          {logo && (
            <div className="mt-4 p-4 bg-white dark:bg-navy/50 rounded-xl border border-mist dark:border-ocean-deep inline-block">
              <img src={logo} alt="Logo Preview" className="h-12 w-auto" />
            </div>
          )}
        </div>
        <div className="bg-mist/30 dark:bg-ocean-deep/30 p-4 rounded-xl border border-mist dark:border-ocean-deep">
          <label className="block text-xs font-black text-ocean dark:text-steel uppercase tracking-widest mb-2">App Icon (Browser Favicon)</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setIcon)} className="w-full text-sm text-navy dark:text-steel file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-secondary file:text-white hover:file:bg-sky-bright transition-all" />
          {icon && (
            <div className="mt-4 p-4 bg-white dark:bg-navy/50 rounded-xl border border-mist dark:border-ocean-deep inline-block">
              <img src={icon} alt="Icon Preview" className="w-8 h-8" />
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          className="w-full bg-navy dark:bg-secondary text-white dark:text-navy py-4 rounded-xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
        >
          Save Branding
        </button>
      </div>
    </div>
  );
}
