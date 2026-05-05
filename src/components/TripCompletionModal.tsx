import { motion, AnimatePresence } from 'motion/react';
import { Check, Star } from 'lucide-react';
import { useState } from 'react';
import { formatZAR } from '@/lib/utils';

interface TripCompletionModalProps {
  isOpen: boolean;
  ride: any;
  onClose: () => void;
  onComplete: (rating: number) => void;
}

export function TripCompletionModal({ isOpen, ride, onClose, onComplete }: TripCompletionModalProps) {
  const [rating, setRating] = useState(5);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-white dark:bg-navy rounded-3xl p-8 shadow-2xl border border-white/10"
        >
          <div className="flex flex-col items-center">
            <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
              <Check className="text-green-500" size={48} />
            </div>
            <h3 className="text-2xl font-bold text-navy dark:text-white mb-2">Trip Completed!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center">
                Fare: {formatZAR(ride?.fare_amount || 0)}
            </p>
            
            <div className="flex gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)} className={`p-1 ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}>
                  <Star size={32} fill={rating >= star ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>

            <button
              onClick={() => onComplete(rating)}
              className="w-full py-4 bg-secondary text-white font-semibold rounded-2xl hover:brightness-105 active:scale-95 transition-all"
            >
              Finish Trip
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
