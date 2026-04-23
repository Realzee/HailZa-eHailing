import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { 
  ShieldCheck, 
  UserCheck, 
  Smartphone, 
  Camera, 
  IdCard, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  X,
  ChevronRight,
  ArrowLeft,
  Mail,
  Send,
  Check
} from 'lucide-react';

interface VerificationFlowProps {
  user: any;
  onComplete: () => void;
  onClose: () => void;
}

type Step = 'intro' | 'id_upload' | 'selfie' | 'phone' | 'pending';

export default function VerificationFlow({ user, onComplete, onClose }: VerificationFlowProps) {
  const [step, setStep] = useState<Step>(user.verification_status === 'pending' ? 'pending' : 'intro');
  const [isUploading, setIsUploading] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [phone, setPhone] = useState(user.phone || '');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [showResendSuccess, setShowResendSuccess] = useState(false);
  const [correctOtp] = useState('1234'); // Simulated OTP for demo

  // Timer logic for resend button
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const sendOtp = async () => {
    if (!phone) return alert('Please enter a valid phone number');
    setIsUploading(true);
    // Simulate API call to SMS provider
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsOtpSent(true);
    setResendTimer(30);
    setShowResendSuccess(true);
    setTimeout(() => setShowResendSuccess(false), 3000);
    setIsUploading(false);
  };

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const verifyOtp = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 4) return alert('Please enter the full 4-digit code');
    
    if (enteredOtp !== correctOtp) {
      alert('Invalid verification code. Please try again.');
      setOtp(['', '', '', '']);
      document.getElementById('otp-0')?.focus();
      return;
    }

    updateVerificationStatus('pending', { phone });
  };

  const updateVerificationStatus = async (status: string, data = {}) => {
    setIsUploading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          verification_status: status,
          ...data
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      if (status === 'pending') {
        setStep('pending');
      }
    } catch (err) {
      console.error('Update error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleNext = () => {
    if (step === 'intro') setStep('id_upload');
    else if (step === 'id_upload') setStep('selfie');
    else if (step === 'selfie') setStep('phone');
    else if (step === 'phone') {
      if (!isOtpSent) {
        sendOtp();
      } else {
        verifyOtp();
      }
    }
  };

  const containerVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  };

  const stepVariants = {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative border border-gray-100 dark:border-gray-700 transition-colors">
        {/* Header */}
        <div className="p-6 flex justify-between items-center border-b border-gray-50 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            {step !== 'intro' && step !== 'pending' && (
              <button 
                onClick={() => {
                  if (step === 'id_upload') setStep('intro');
                  if (step === 'selfie') setStep('id_upload');
                  if (step === 'phone') setStep('selfie');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <ArrowLeft size={20} className="dark:text-gray-300" />
              </button>
            )}
            <h2 className="font-black text-xl tracking-tight dark:text-white">Verification</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 dark:text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 flex">
           <motion.div 
             className="h-full bg-hail-green"
             animate={{ 
               width: step === 'intro' ? '20%' : 
                      step === 'id_upload' ? '40%' : 
                      step === 'selfie' ? '60%' : 
                      step === 'phone' ? '80%' : '100%' 
             }}
           />
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 'intro' && (
              <motion.div key="intro" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                <div className="w-20 h-20 bg-hail-green/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck size={40} className="text-hail-green" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black mb-2 dark:text-white">Security First</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                    To keep our community safe, all users must verify their identity before they can book or complete trips.
                  </p>
                </div>
                <div className="space-y-4 pt-4">
                  {[
                    { icon: IdCard, text: 'Government Issued ID' },
                    { icon: Camera, text: 'Clear Selfie Verification' },
                    { icon: Smartphone, text: 'Phone Number OTP' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border dark:border-gray-600">
                        <item.icon size={18} className="text-hail-green" />
                      </div>
                      <span className="font-bold text-sm text-gray-700 dark:text-gray-200 uppercase tracking-widest">{item.text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'id_upload' && (
              <motion.div key="id" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-black mb-2 dark:text-white">Identity Document</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Upload a clear photo of your ID, Driver's License or Passport.</p>
                </div>
                <div className="aspect-[3/2] bg-gray-50 dark:bg-gray-700 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center gap-4 hover:border-hail-green dark:hover:border-hail-green transition-colors cursor-pointer group">
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-lg group-hover:scale-110 transition-transform border dark:border-gray-600">
                    <IdCard size={32} className="text-gray-400 dark:text-gray-500 group-hover:text-hail-green transition-colors" />
                  </div>
                  <p className="font-bold text-sm text-gray-400 dark:text-gray-500 uppercase tracking-widest">Click to Upload</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl flex gap-3 border border-orange-100 dark:border-orange-800">
                  <AlertCircle size={20} className="text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-700 dark:text-orange-300 font-medium leading-relaxed">
                    Ensure all four corners are visible and text is readable. Documents are encrypted and secure.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'selfie' && (
              <motion.div key="selfie" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-6 text-center">
                <h3 className="text-xl font-black dark:text-white">Live Selfie</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Position your face within the circle and look directly at the camera.</p>
                <div className="relative w-64 h-64 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-hail-green border-dashed animate-[spin_10s_linear_infinite]" />
                  <div className="absolute inset-2 rounded-full border-4 border-gray-100 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-700">
                     <div className="absolute inset-0 flex items-center justify-center">
                        <Camera size={48} className="text-gray-300 dark:text-gray-500" />
                     </div>
                  </div>
                </div>
                <ul className="text-left space-y-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-4">
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-hail-green" /> Good lighting</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-hail-green" /> No glasses or hats</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-hail-green" /> Neutral expression</li>
                </ul>
              </motion.div>
            )}

            {step === 'phone' && (
              <motion.div key="phone" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-black mb-2 dark:text-white">Phone Verification</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isOtpSent 
                      ? `We've sent a code to ${phone}` 
                      : 'Enter your phone number to receive a 4-digit security code.'}
                  </p>
                </div>
                <div className="space-y-4">
                  {showResendSuccess && (
                     <motion.div 
                       initial={{ opacity: 0, y: -10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg flex items-center justify-center gap-2 border border-green-100 dark:border-green-800"
                     >
                       <Check size={14} className="text-green-600 dark:text-green-400" />
                       <span className="text-[10px] font-bold text-green-700 dark:text-green-300 uppercase tracking-widest">Code sent successfully</span>
                     </motion.div>
                  )}
                  <div className="relative">
                    <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isOtpSent ? 'text-hail-green' : 'text-gray-400'}`} size={20} />
                    <input 
                      type="tel"
                      disabled={isOtpSent || isUploading}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g., +27 12 345 6789"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-hail-green font-bold dark:text-white dark:placeholder-gray-500 border dark:border-gray-600 disabled:opacity-70 transition-all"
                    />
                    {isOtpSent && !isUploading && (
                       <button 
                         onClick={() => setIsOtpSent(false)}
                         className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-hail-green uppercase"
                       >
                         Change
                       </button>
                    )}
                  </div>

                  {isOtpSent && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-between gap-3 px-4"
                    >
                      {otp.map((digit, i) => (
                        <input 
                          key={i}
                          id={`otp-${i}`}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(e.target.value, i)}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !digit && i > 0) {
                              document.getElementById(`otp-${i - 1}`)?.focus();
                            }
                          }}
                          className="w-12 h-16 text-center text-2xl font-black bg-white dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl focus:border-hail-green outline-none dark:text-white transition-all focus:scale-105"
                          placeholder="-"
                        />
                      ))}
                    </motion.div>
                  )}
                </div>
                
                {isOtpSent && (
                  <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                    Didn't get a code? {resendTimer > 0 ? (
                      <span className="text-gray-400">Resend in {resendTimer}s</span>
                    ) : (
                      <button onClick={sendOtp} className="text-hail-green hover:underline">Resend OTP</button>
                    )}
                  </p>
                )}
              </motion.div>
            )}

            {step === 'pending' && (
              <motion.div key="pending" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-6 text-center py-4">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 relative">
                   <Loader2 size={40} className="text-blue-600 animate-spin" />
                   <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-full border-2 border-white dark:border-gray-800">
                      <Clock size={12} />
                   </div>
                </div>
                <div className="space-y-4 px-2">
                  <h3 className="text-2xl font-black dark:text-white leading-tight">Documents Under Review</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                    Our safety team is verifying your details. This usually takes less than 24 hours. We will notify you once approved.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl flex items-center gap-3 border dark:border-gray-700">
                    <UserCheck className="text-gray-400 dark:text-gray-500" size={20} />
                    <div className="text-left">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Status</p>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter">Review In Progress</p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all mt-4"
                >
                  Got it
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {step !== 'pending' && (
            <div className="mt-8">
              <button 
                onClick={handleNext}
                disabled={isUploading || (step === 'phone' && isOtpSent && otp.join('').length < 4)}
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-5 rounded-2xl font-black text-lg shadow-xl shadow-gray-200 dark:shadow-black/20 flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="animate-spin" /> : (
                  <>
                    {step === 'phone' ? (isOtpSent ? 'Verify & Submit' : 'Send Code') : 'Continue'}
                    <ChevronRight size={20} />
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-6 flex items-center justify-center gap-1">
                 <ShieldCheck size={12} className="text-hail-green" /> Secure 256-bit Encryption
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Clock({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  );
}
