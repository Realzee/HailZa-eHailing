import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, HelpCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'success' | 'error' | 'confirm' | 'info' | 'loading' | 'warning';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

export function StatusModal({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm
}: StatusModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-green-500" size={48} />;
      case 'error': return <AlertCircle className="text-red-500" size={48} />;
      case 'warning': return <AlertTriangle className="text-orange-500" size={48} />;
      case 'confirm': return <HelpCircle className="text-blue-500" size={48} />;
      case 'loading': return <Loader2 className="text-secondary animate-spin" size={48} />;
      default: return <AlertCircle className="text-blue-500" size={48} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={type !== 'loading' ? onClose : undefined}
            className="absolute inset-0 bg-navy/60 dark:bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-white/10 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-hail-green/20 to-transparent" />
            
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-full">
                {getIcon()}
              </div>
              
              <h3 className="text-xl font-semibold text-navy dark:text-white mb-2  tracking-tight">
                {title}
              </h3>
              
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-relaxed mb-8">
                {message}
              </p>
              
              <div className="flex flex-col w-full gap-3">
                {type === 'confirm' ? (
                  <>
                    <button
                      onClick={() => {
                        onConfirm?.();
                        onClose();
                      }}
                      className="w-full py-4 bg-secondary text-navy font-semibold rounded-2xl hover:brightness-105 active:scale-95 transition-all  tracking-normal text-xs"
                    >
                      {confirmLabel}
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full py-4 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-slate-700 active:scale-95 transition-all  tracking-normal text-xs"
                    >
                      {cancelLabel}
                    </button>
                  </>
                ) : (
                  type !== 'loading' && (
                    <button
                      onClick={onClose}
                      className="w-full py-4 bg-navy dark:bg-secondary dark:text-navy text-white font-semibold rounded-2xl hover:brightness-110 active:scale-95 transition-all  tracking-normal text-xs"
                    >
                      Dismiss
                    </button>
                  )
                )}
              </div>
            </div>
            
            {type !== 'loading' && (
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default StatusModal;
