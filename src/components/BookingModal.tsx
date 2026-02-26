import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Star, 
  ChevronRight,
  Stethoscope
} from 'lucide-react';
import { getDoctorsBySpecialty, bookAppointment, type Doctor } from '../services/bookingService';
import { cn } from '../lib/utils';

interface BookingModalProps {
  specialty: string;
  onClose: () => void;
  patientName?: string;
}

export const BookingModal: React.FC<BookingModalProps> = ({ specialty, onClose, patientName }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoading(true);
        const data = await getDoctorsBySpecialty(specialty);
        setDoctors(data);
      } catch (err) {
        setError("Failed to fetch available doctors. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [specialty]);

  const handleBook = async () => {
    if (!selectedDoctor || !selectedTime) return;

    try {
      setBooking(true);
      setError(null);
      const result = await bookAppointment({
        doctorId: selectedDoctor.id,
        date: new Date().toLocaleDateString(),
        time: selectedTime,
        patientName: patientName || 'Anonymous Patient',
        specialty
      });
      setSuccess(result.message);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during booking.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all z-10"
        >
          <X size={20} />
        </button>

        {success ? (
          <div className="p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Appointment Confirmed!</h2>
              <p className="text-slate-500">{success}</p>
            </div>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-[80vh] max-h-[600px]">
            <div className="p-8 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <Stethoscope size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Book an Appointment</h2>
              </div>
              <p className="text-sm text-slate-500">
                Recommended specialty: <span className="font-bold text-emerald-600">{specialty}</span>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                  <Loader2 className="animate-spin text-emerald-600" size={32} />
                  <p className="text-sm text-slate-400 font-medium">Finding available specialists...</p>
                </div>
              ) : error ? (
                <div className="p-6 bg-red-50 border border-red-100 rounded-3xl text-center space-y-4">
                  <AlertCircle className="mx-auto text-red-500" size={32} />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="text-xs font-bold text-red-600 underline"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select a Specialist</h3>
                    <div className="space-y-3">
                      {doctors.map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => {
                            setSelectedDoctor(doc);
                            setSelectedTime(null);
                          }}
                          className={cn(
                            "w-full p-4 rounded-3xl border transition-all flex items-center gap-4 text-left",
                            selectedDoctor?.id === doc.id 
                              ? "bg-emerald-50 border-emerald-200 shadow-sm" 
                              : "bg-white border-slate-100 hover:border-emerald-100"
                          )}
                        >
                          <img 
                            src={doc.image} 
                            alt={doc.name} 
                            className="w-12 h-12 rounded-2xl object-cover border border-slate-100"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 truncate">{doc.name}</h4>
                            <p className="text-xs text-slate-500">{doc.specialty}</p>
                          </div>
                          <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                            <Star size={12} fill="currentColor" /> {doc.rating}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedDoctor && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available Slots</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedDoctor.availability.map(time => (
                          <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                              "py-3 rounded-2xl text-xs font-bold transition-all border",
                              selectedTime === time 
                                ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                                : "bg-white border-slate-100 text-slate-600 hover:border-emerald-200"
                            )}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            <div className="p-8 bg-white border-t border-slate-50">
              <button
                disabled={!selectedDoctor || !selectedTime || booking}
                onClick={handleBook}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg",
                  !selectedDoctor || !selectedTime || booking
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
                )}
              >
                {booking ? (
                  <><Loader2 className="animate-spin" size={20} /> Booking...</>
                ) : (
                  <><Calendar size={20} /> Confirm Booking</>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
