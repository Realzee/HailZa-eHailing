import { motion, AnimatePresence } from 'motion/react';
import { X, Phone, MapPin, Calendar, Banknote } from 'lucide-react';
import { formatZAR } from '@/lib/utils';

interface RideDetailsModalProps {
  isOpen: boolean;
  ride: any;
  onClose: () => void;
}

export function RideDetailsModal({ isOpen, ride, onClose }: RideDetailsModalProps) {
  if (!isOpen || !ride) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-white dark:bg-navy rounded-3xl p-8 shadow-2xl border border-white/10"
        >
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
          
          <h3 className="text-2xl font-bold mb-6 text-navy dark:text-white">Ride Details</h3>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full text-secondary">
                <Calendar />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold">Date</p>
                <p className="dark:text-white">{new Date(ride.created_at).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full text-secondary">
                    <Banknote />
                </div>
                <div>
                     <p className="text-xs text-gray-500 font-bold">Fare</p>
                     <p className="dark:text-white font-semibold">{formatZAR(ride.fare_amount)}</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full text-secondary">
                <MapPin />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold">Route</p>
                <p className="dark:text-white text-sm line-clamp-1">Pickup: {ride.pickup_address}</p>
                <p className="dark:text-white text-sm line-clamp-1">Dropoff: {ride.dropoff_address}</p>
              </div>
            </div>

            {ride.rider && (
              <div className="flex items-center justify-between bg-gray-50 dark:bg-ocean p-4 rounded-2xl mt-4">
                <div>
                  <p className="text-xs text-gray-500 font-bold">Rider</p>
                  <p className="font-semibold dark:text-white">{ride.rider.full_name}</p>
                </div>
                {ride.rider.phone && (
                  <a href={`tel:${ride.rider.phone}`} className="p-3 bg-secondary text-white rounded-full hover:bg-green-700 transition-colors">
                    <Phone size={20} />
                  </a>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
