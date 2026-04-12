import { useState } from 'react';

export default function BrandingSettings() {
  const [logoUrl, setLogoUrl] = useState(localStorage.getItem('appLogo') || '');

  const handleSave = () => {
    localStorage.setItem('appLogo', logoUrl);
    alert('Branding updated! Please refresh the page.');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border">
      <h3 className="text-lg font-bold mb-4">Branding Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Logo URL</label>
          <input
            type="text"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="w-full p-2 border rounded-lg mt-1"
            placeholder="https://example.com/logo.png"
          />
        </div>
        <button
          onClick={handleSave}
          className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-opacity-90"
        >
          Save Branding
        </button>
      </div>
    </div>
  );
}
