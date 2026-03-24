import { useState, type FormEvent } from 'react';
import { Loader2, Database } from 'lucide-react';

export default function Setup() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (url && key) {
      localStorage.setItem('hailza_supabase_url', url);
      localStorage.setItem('hailza_supabase_key', key);
      // Reload to re-initialize Supabase client with new keys
      window.location.reload();
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="bg-hail-green/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="text-hail-green" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect Supabase</h1>
          <p className="text-gray-500 text-sm">
            Please enter your Supabase project credentials to start the app.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project URL</label>
            <input
              type="url"
              required
              placeholder="https://your-project.supabase.co"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-hail-green outline-none"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anon Public Key</label>
            <input
              type="text"
              required
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-hail-green outline-none font-mono text-xs"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg text-xs text-blue-800">
            <p className="font-bold mb-1">How to get these:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to your Supabase Dashboard</li>
              <li>Select your project</li>
              <li>Go to <strong>Settings &gt; API</strong></li>
              <li>Copy the <strong>URL</strong> and <strong>anon public</strong> key</li>
            </ol>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-hail-green text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition-colors flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Save & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
