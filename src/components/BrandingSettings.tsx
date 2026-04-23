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
    <div className="bg-white dark:bg-navy p-8 rounded-[2.5rem] shadow-2xl border border-mist dark:border-white/5 transition-colors">
      <h3 className="text-2xl font-black mb-8 dark:text-white tracking-tight uppercase font-display leading-none">Branding & Identity</h3>
      <div className="space-y-8">
        <div className="bg-mist/20 dark:bg-ocean-deep/30 p-6 rounded-[2rem] border border-mist dark:border-white/5 transition-all">
          <label className="block text-[10px] font-black text-steel uppercase tracking-[0.2em] mb-4">Master Application Logo</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setLogo)} className="w-full text-sm text-navy dark:text-steel file:mr-6 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-secondary file:text-white hover:file:bg-sky-bright file:uppercase file:tracking-widest transition-all cursor-pointer" />
          {logo && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mt-6 p-4 bg-white dark:bg-navy rounded-2xl border border-mist dark:border-white/5 inline-flex items-center justify-center shadow-inner"
            >
              <img src={logo} alt="Logo Preview" className="h-10 w-auto" />
            </motion.div>
          )}
        </div>
        <div className="bg-mist/20 dark:bg-ocean-deep/30 p-6 rounded-[2rem] border border-mist dark:border-white/5 transition-all">
          <label className="block text-[10px] font-black text-steel uppercase tracking-[0.2em] mb-4">Browser Interface Icon (Favicon)</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setIcon)} className="w-full text-sm text-navy dark:text-steel file:mr-6 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-secondary file:text-white hover:file:bg-sky-bright file:uppercase file:tracking-widest transition-all cursor-pointer" />
          {icon && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mt-6 p-4 bg-white dark:bg-navy rounded-2xl border border-mist dark:border-white/5 inline-flex items-center justify-center shadow-inner"
            >
              <img src={icon} alt="Icon Preview" className="w-8 h-8 rounded-md" />
            </motion.div>
          )}
        </div>
        <button
          onClick={handleSave}
          className="w-full bg-navy dark:bg-secondary text-white dark:text-navy py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-navy/10 dark:shadow-secondary/10"
        >
          Synchronize Branding
        </button>
      </div>
    </div>
  );
}
