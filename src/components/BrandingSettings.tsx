import React, { useState } from 'react';
import { motion } from 'motion/react';
import { StatusModal } from './StatusModal';
import { useBranding } from '../hooks/useBranding';
import { supabase } from '../lib/supabase';

export default function BrandingSettings() {
  const { logoUrl: initialLogo, iconUrl: initialIcon, setLogoUrl: setGlobalLogo, setIconUrl: setGlobalIcon } = useBranding();
  const [logo, setLogo] = useState('');
  const [icon, setIcon] = useState('');

  React.useEffect(() => {
    if (initialLogo && !logo) setLogo(initialLogo);
    if (initialIcon && !icon) setIcon(initialIcon);
  }, [initialLogo, initialIcon]);

  // Modal state
  const [modal, setModal] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'confirm' | 'info' | 'loading' | 'warning';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    show: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showModal = (
    type: 'success' | 'error' | 'confirm' | 'info' | 'loading' | 'warning',
    title: string,
    message: string,
    onConfirm?: () => void
  ) => {
    setModal({ show: true, type, title, message, onConfirm });
  };

  const closeModal = () => {
    setModal((prev) => ({ ...prev, show: false }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void, globalSetter: (val: string) => void, fileName: string) => {
    const file = e.target.files?.[0];
    if (file) {
      showModal('loading', 'Uploading...', 'Uploading to cloud storage...');
      
      const { data, error } = await supabase.storage.from('branding').upload(fileName, file, { upsert: true });
      
      if (error) {
        showModal('error', 'Upload Failed', error.message + ' (Please create a public "branding" bucket in Supabase storage)');
      } else {
        const { data: { publicUrl } } = supabase.storage.from('branding').getPublicUrl(fileName);
        const urlWithCache = `${publicUrl}?t=${Date.now()}`;
        setter(urlWithCache);
        globalSetter(urlWithCache);
        
        if (fileName === 'appIcon.png') {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = urlWithCache;
        }
        
        showModal('success', 'Upload Successful', 'File uploaded to storage successfully.');
      }
    }
  };

  return (
    <div className="bg-white dark:bg-navy p-8 rounded-3xl shadow-2xl border border-mist dark:border-white/5 transition-colors">
      <h3 className="text-2xl font-semibold mb-8 dark:text-white tracking-tight  font-display leading-none">Branding & Identity</h3>
      <div className="space-y-8">
        <div className="bg-mist/20 dark:bg-ocean-deep/30 p-6 rounded-[2rem] border border-mist dark:border-white/5 transition-all">
          <label className="block text-xs font-semibold text-steel  tracking-wide mb-4">Master Application Logo</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setLogo, setGlobalLogo, 'appLogo.png')} className="w-full text-sm text-navy dark:text-steel file:mr-6 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-white hover:file:bg-sky-bright file: file:tracking-normal transition-all cursor-pointer" />
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
          <label className="block text-xs font-semibold text-steel  tracking-wide mb-4">Browser Interface Icon (Favicon)</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setIcon, setGlobalIcon, 'appIcon.png')} className="w-full text-sm text-navy dark:text-steel file:mr-6 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-white hover:file:bg-sky-bright file: file:tracking-normal transition-all cursor-pointer" />
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
      </div>

      <StatusModal
        isOpen={modal.show}
        onClose={closeModal}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
      />
    </div>
  );
}
