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
    alert('Branding updated! Please refresh the page.');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border">
      <h3 className="text-lg font-bold mb-4">Branding Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">App Logo</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setLogo)} className="w-full mt-1" />
          {logo && <img src={logo} alt="Logo" className="mt-2 h-16" />}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">App Icon</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setIcon)} className="w-full mt-1" />
          {icon && <img src={icon} alt="Icon" className="mt-2 h-16" />}
        </div>
        <button
          onClick={handleSave}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800"
        >
          Save Branding
        </button>
      </div>
    </div>
  );
}
