import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TriangleAlert, 
  X, 
  Loader2, 
  Info,
  MapPin,
  Construction,
  ShieldAlert,
  Droplets,
  AlertOctagon,
  CarFront,
  Zap
} from 'lucide-react';
import { HazardType, supabase } from '../lib/supabase';

interface HazardsPanelProps {
  onClose: () => void;
  currentLat: number;
  currentLng: number;
  reporterId: string;
}

const HAZARD_TYPES: { type: HazardType; label: string; icon: any; color: string; description: string }[] = [
  { 
    type: 'pothole', 
    label: 'Pothole', 
    icon: AlertOctagon, 
    color: 'bg-orange-500', 
    description: 'Damaged road surface' 
  },
  { 
    type: 'roadblock', 
    label: 'Roadblock', 
    icon: ShieldAlert, 
    color: 'bg-red-600', 
    description: 'Illegal or police roadblock' 
  },
  { 
    type: 'flooding', 
    label: 'Flooding', 
    icon: Droplets, 
    color: 'bg-blue-600', 
    description: 'Water covering the road' 
  },
  { 
    type: 'hijack_hotspot', 
    label: 'Hijack Hotspot', 
    icon: Zap, 
    color: 'bg-red-800', 
    description: 'High risk hijacking area' 
  },
  { 
    type: 'accident', 
    label: 'Accident', 
    icon: CarFront, 
    color: 'bg-orange-600', 
    description: 'Vehicle collision' 
  },
  { 
    type: 'construction', 
    label: 'Construction', 
    icon: Construction, 
    color: 'bg-yellow-600', 
    description: 'Road works and barriers' 
  }
];

export const HazardsPanel: React.FC<HazardsPanelProps> = ({ onClose, currentLat, currentLng, reporterId }) => {
  const [selectedType, setSelectedType] = useState<HazardType | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) return;
    
    setSubmitting(true);
    try {
      // Set expiration (e.g., 4 hours for most, longer for hijack hotspots)
      const durationHours = selectedType === 'hijack_hotspot' ? 72 : 4;
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from('hazards').insert({
        type: selectedType,
        description: description || HAZARD_TYPES.find(h => h.type === selectedType)?.description,
        lat: currentLat,
        lng: currentLng,
        reported_by: reporterId,
        expires_at: expiresAt
      });

      if (error) throw error;
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error reporting hazard:', err);
      alert('Failed to report hazard. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-t-[3rem] sm:rounded-[3rem] p-8 max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-700"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <TriangleAlert className="text-red-600" />
              Report Hazard
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Keep our community safe</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl transition-all active:scale-95"
          >
            <X size={24} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
              <TriangleAlert className="text-green-600" size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Hazard Reported!</h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Thank you for alerting other drivers.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 gap-3 mb-8">
              {HAZARD_TYPES.map((h) => {
                const Icon = h.icon;
                return (
                  <button
                    key={h.type}
                    onClick={() => setSelectedType(h.type)}
                    className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-3 group ${
                      selectedType === h.type
                        ? 'border-red-600 bg-red-50 dark:bg-red-900/20 shadow-md scale-[1.02]'
                        : 'border-gray-100 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-900/40 bg-gray-50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className={`${h.color} w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-110`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className={`font-black text-xs uppercase tracking-widest ${selectedType === h.type ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {h.label}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5 line-clamp-1">{h.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4 mb-8">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Details (Optional)</label>
              <textarea
                placeholder="Briefly describe the hazard..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-5 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none min-h-[100px] font-medium text-gray-700 dark:text-white transition-all"
              />
            </div>

            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-start gap-3 mb-8">
              <Info className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
              <p className="text-[10px] text-red-700 dark:text-red-300 font-bold leading-tight">
                Reporting false hazards or using this tool to disrupt operations will result in account suspension. Please report accurately based on your current location.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!selectedType || submitting}
              className="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-red-700 transition-all active:scale-[0.98] shadow-xl disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 flex items-center justify-center gap-3"
            >
              {submitting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>Submit Hazard Report</>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
