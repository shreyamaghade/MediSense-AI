import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Stethoscope, 
  Search, 
  AlertTriangle, 
  ChevronRight, 
  Activity, 
  Clock, 
  ShieldAlert,
  ShieldCheck,
  Plus,
  X,
  Loader2,
  Info,
  CheckCircle2,
  ArrowRight,
  Thermometer,
  Heart,
  Wind,
  Droplets,
  User as UserIcon,
  Users,
  History,
  Trash2,
  Calendar,
  FileDown,
  Download,
  ExternalLink,
  Mic,
  MicOff
} from 'lucide-react';
import { getDiagnosis, type DiagnosisResponse, type Vitals, type Demographics, getCsrfToken } from './services/geminiService';
import { COMMON_SYMPTOMS, BODY_REGIONS, type BodyRegion } from './constants';
import { cn } from './lib/utils';
import { BodyMap } from './components/BodyMap';
import { Auth } from './components/Auth';
import { AdminDashboard } from './components/AdminDashboard';
import { BookingModal } from './components/BookingModal';
import { WearableSync } from './components/WearableSync';
import { auth } from './lib/firebase';
import { User } from 'firebase/auth';
import { generatePDFReport } from './lib/pdfGenerator';

export default function App() {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [activeRegion, setActiveRegion] = useState<BodyRegion | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [vitals, setVitals] = useState<Vitals>({
    temperature: '',
    bloodPressure: '',
    heartRate: '',
    spO2: ''
  });
  const [demographics, setDemographics] = useState<Demographics>({
    age: '',
    gender: '',
    preExistingConditions: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DiagnosisResponse | null>(null);
  const [error, setError] = useState<{ message: string, suggestion?: string, code?: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [wearableData, setWearableData] = useState<any>(null);

  const isAdmin = user?.email === "shreya.cs23068@sstcollege.edu.in";

  // Simple anonymization to remove potential PII (emails and common name patterns)
  const anonymizeData = (text: string) => {
    return text
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REMOVED]")
      .replace(/\b(my name is|i am|this is)\s+([A-Z][a-z]+)\b/gi, "$1 [NAME_REMOVED]")
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ID_REMOVED]"); // SSN-like patterns
  };

  // Voice Input Logic
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError({
        message: "Speech recognition is not supported in this browser.",
        suggestion: "Please use a modern browser like Chrome or Safari."
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAdditionalContext(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setError({
        message: "Speech recognition error.",
        suggestion: `Error: ${event.error}. Please ensure your microphone is connected and allowed.`
      });
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const fetchHistory = async () => {
    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) {
        setHistory([]);
        return;
      }
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const saveToHistory = async (diagnosis: DiagnosisResponse) => {
    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) return;

      const [csrfToken, idToken] = await Promise.all([
        getCsrfToken(),
        currentUser.getIdToken()
      ]);

      // Find the highest urgency among conditions
      const topUrgency = diagnosis.possibleConditions.reduce((prev, curr) => {
        const levels = { 'Emergency': 3, 'Urgent': 2, 'Routine': 1 };
        return levels[curr.urgency] > levels[prev] ? curr.urgency : prev;
      }, 'Routine' as any);

      await fetch('/api/history', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          symptoms: selectedSymptoms,
          vitals,
          demographics,
          summary: diagnosis.summary,
          conditions: diagnosis.possibleConditions,
          urgency: topUrgency,
          consentTimestamp: new Date().toISOString()
        })
      });
      fetchHistory();
    } catch (err) {
      console.error("Failed to save history", err);
    }
  };

  const deleteHistoryItem = async (id: number) => {
    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) return;

      const [csrfToken, idToken] = await Promise.all([
        getCsrfToken(),
        currentUser.getIdToken()
      ]);

      await fetch(`/api/history/${id}`, { 
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken || '',
          'Authorization': `Bearer ${idToken}`
        }
      });
      fetchHistory();
    } catch (err) {
      console.error("Failed to delete history item", err);
    }
  };

  React.useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        fetchHistory();
      } else {
        setHistory([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom) 
        : [...prev, symptom]
    );
  };

  const handleAnalyze = async () => {
    if (selectedSymptoms.length === 0) {
      setError({ 
        message: "Please select at least one symptom.",
        suggestion: "Use the body map or the list below to select your symptoms."
      });
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const anonymizedContext = anonymizeData(additionalContext);
      const diagnosis = await getDiagnosis(
        selectedSymptoms, 
        anonymizedContext, 
        vitals, 
        demographics,
        wearableData
      );
      setResult(diagnosis);
      saveToHistory(diagnosis);
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError({
          code: "NETWORK_ERROR",
          message: "Network connection unstable.",
          suggestion: "Please check your internet connection and try again."
        });
      } else if (err.error) {
        setError({
          code: err.code,
          message: err.error,
          suggestion: err.suggestion
        });
      } else {
        setError({ 
          message: "An unexpected error occurred while analyzing symptoms.",
          suggestion: "Please try again in a few moments."
        });
      }
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setSelectedSymptoms([]);
    setActiveRegion(null);
    setAdditionalContext('');
    setVitals({
      temperature: '',
      bloodPressure: '',
      heartRate: '',
      spO2: ''
    });
    setDemographics({
      age: '',
      gender: '',
      preExistingConditions: ''
    });
    setResult(null);
    setError(null);
  };

  const handleDownloadPDF = () => {
    if (result) {
      generatePDFReport(result, selectedSymptoms, vitals, demographics);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Stethoscope size={24} />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-slate-900">MediSense AI</h1>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Diagnostic Assistant</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {isAdmin && (
              <button 
                onClick={() => {
                  setShowAdmin(true);
                  setShowHistory(false);
                }}
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  showAdmin ? "text-emerald-600" : "hover:text-emerald-600"
                )}
              >
                <ShieldCheck size={18} /> Admin
              </button>
            )}
            <Auth onUserChange={setUser} />
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "flex items-center gap-2 transition-colors",
                showHistory ? "text-emerald-600" : "hover:text-emerald-600"
              )}
            >
              <History size={18} /> History
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-8">
        <AnimatePresence mode="wait">
          {showAdmin ? (
            <AdminDashboard key="admin" onClose={() => setShowAdmin(false)} />
          ) : showHistory ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <History className="text-emerald-600" /> Diagnosis History
                </h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-xs font-bold hover:bg-slate-200 transition-all"
                >
                  Back to Checker
                </button>
              </div>

              {history.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
                  <Clock size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-500">No history found yet. Run a diagnosis to see it here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {history.map((item) => (
                    <div key={item.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:border-emerald-100 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-white",
                            item.urgency === 'Emergency' ? "bg-red-500" :
                            item.urgency === 'Urgent' ? "bg-amber-500" : "bg-emerald-500"
                          )}>
                            <Calendar size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              {new Date(item.timestamp).toLocaleDateString('en-US', { 
                                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                              })}
                            </p>
                            <h3 className="font-bold text-slate-900">{item.conditions[0]?.condition || "Assessment"}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => generatePDFReport(
                              { 
                                possibleConditions: item.conditions, 
                                summary: item.summary, 
                                disclaimer: "This is a historical report. Please consult a doctor for current symptoms." 
                              }, 
                              item.symptoms, 
                              item.vitals, 
                              item.demographics
                            )}
                            className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"
                            title="Download PDF Report"
                          >
                            <FileDown size={18} />
                          </button>
                          <button 
                            onClick={() => deleteHistoryItem(item.id)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1">
                          {item.symptoms.map((s: string) => (
                            <span key={s} className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded-lg text-[10px] border border-slate-100">
                              {s}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2 italic">
                          "{item.summary}"
                        </p>
                        <div className="flex items-center gap-4 pt-3 border-t border-slate-50">
                          {item.vitals.temperature && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Thermometer size={12} /> {item.vitals.temperature}°C
                            </div>
                          )}
                          {item.demographics.age && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <UserIcon size={12} /> Age {item.demographics.age}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="checker"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
          
          {/* Left Column: Input */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Activity size={20} />
                </div>
                <h2 className="font-semibold text-lg">Symptom Checker</h2>
              </div>

              <div className="space-y-6">
                {!user && (
                  <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl text-center">
                    <p className="text-sm text-amber-700 font-medium mb-4">
                      Sign in to save your diagnosis history and access it from any device.
                    </p>
                    <div className="flex justify-center">
                      <Auth onUserChange={setUser} />
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                    Symptom Mapping
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <BodyMap 
                      onRegionSelect={(region) => setActiveRegion(region === activeRegion ? null : region)} 
                      selectedRegionId={activeRegion?.id || null} 
                    />
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 h-full">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          {activeRegion ? `${activeRegion.label} Symptoms` : "Select a region"}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {activeRegion ? (
                            activeRegion.symptoms.map(s => (
                              <button
                                key={s}
                                onClick={() => toggleSymptom(s)}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[11px] transition-all border",
                                  selectedSymptoms.includes(s)
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-emerald-200"
                                )}
                              >
                                {s}
                              </button>
                            ))
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">
                              Click a hotspot on the map to filter symptoms by body area.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                    All Symptoms
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_SYMPTOMS.map((symptom) => (
                      <button
                        key={symptom}
                        onClick={() => toggleSymptom(symptom)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm transition-all border",
                          selectedSymptoms.includes(symptom)
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100"
                            : "bg-white border-slate-200 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50"
                        )}
                      >
                        {symptom}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                    Patient Details (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="number"
                        placeholder="Age"
                        value={demographics.age}
                        onChange={(e) => setDemographics(prev => ({ ...prev, age: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <select
                        value={demographics.gender}
                        onChange={(e) => setDemographics(prev => ({ ...prev, gender: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
                      >
                        <option value="">Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Pre-existing conditions (e.g. Diabetes, Asthma)"
                    value={demographics.preExistingConditions}
                    onChange={(e) => setDemographics(prev => ({ ...prev, preExistingConditions: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                    Vitals (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="Temp (°C)"
                        value={vitals.temperature}
                        onChange={(e) => setVitals(prev => ({ ...prev, temperature: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="BP (e.g. 120/80)"
                        value={vitals.bloodPressure}
                        onChange={(e) => setVitals(prev => ({ ...prev, bloodPressure: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Heart className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="HR (bpm)"
                        value={vitals.heartRate}
                        onChange={(e) => setVitals(prev => ({ ...prev, heartRate: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Wind className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="SpO2 (%)"
                        value={vitals.spO2}
                        onChange={(e) => setVitals(prev => ({ ...prev, spO2: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Additional Details
                    </label>
                    <button
                      onClick={toggleListening}
                      className={cn(
                        "p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold",
                        isListening 
                          ? "bg-red-100 text-red-600 animate-pulse" 
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {isListening ? (
                        <>
                          <MicOff size={14} /> Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic size={14} /> Describe by Voice
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="Describe how you feel, when it started, etc..."
                    className="w-full h-32 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm"
                  />
                </div>

                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <input
                    id="consent-checkbox"
                    type="checkbox"
                    checked={hasConsented}
                    onChange={(e) => setHasConsented(e.target.checked)}
                    className="mt-1 w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <label htmlFor="consent-checkbox" className="text-xs text-slate-500 leading-relaxed">
                    I consent to the processing of my anonymized medical data for the purpose of AI analysis. 
                    I understand that no personally identifiable information (PII) like names or emails will be shared.
                  </label>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || selectedSymptoms.length === 0 || !hasConsented}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-semibold shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Analyzing Symptoms...
                    </>
                  ) : (
                    <>
                      <Search size={20} />
                      Run AI Diagnosis
                    </>
                  )}
                </button>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-2">
                    <div className="flex items-start gap-3 text-red-600 text-sm font-bold">
                      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                      <p>{error.message}</p>
                    </div>
                    {error.suggestion && (
                      <div className="pl-7 text-xs text-red-500 italic">
                        Tip: {error.suggestion}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Wearable Sync Section */}
            {user && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                <WearableSync onDataSync={setWearableData} />
              </section>
            )}

            {/* Disclaimer Card */}
            <section className="bg-amber-50 rounded-3xl p-6 border border-amber-100">
              <div className="flex items-start gap-3">
                <ShieldAlert className="text-amber-600 shrink-0" size={20} />
                <div>
                  <h3 className="font-bold text-amber-900 text-sm mb-1">Medical Disclaimer</h3>
                  <p className="text-amber-800/80 text-xs leading-relaxed">
                    This tool is for informational purposes only and does not constitute medical advice. 
                    Always seek the advice of a qualified health provider with any questions you may have 
                    regarding a medical condition. Never disregard professional medical advice.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {!result && !isAnalyzing ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-dashed border-slate-200"
                >
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                    <Stethoscope size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Ready to Analyze</h3>
                  <p className="text-slate-500 max-w-xs mx-auto text-sm">
                    Select your symptoms and provide details to get an AI-powered preliminary assessment.
                  </p>
                </motion.div>
              ) : isAnalyzing ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm"
                >
                  <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-emerald-100 rounded-full animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                      <Loader2 size={40} className="animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing Data</h3>
                  <div className="space-y-2 w-full max-w-xs">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-emerald-500"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 4, ease: "easeInOut" }}
                      />
                    </div>
                    <p className="text-slate-400 text-xs text-center">Consulting medical database...</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {/* Summary Header */}
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-slate-900">Analysis Results</h2>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={handleDownloadPDF}
                          className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-2"
                        >
                          <FileDown size={16} /> Export PDF
                        </button>
                        <button 
                          onClick={reset}
                          className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
                        >
                          <X size={16} /> Clear
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50 rounded-2xl mb-8">
                      <p className="text-slate-600 text-sm leading-relaxed italic">
                        "{result.summary}"
                      </p>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Possible Conditions</h3>
                      {result.possibleConditions.map((condition, idx) => (
                        <motion.div
                          key={condition.condition}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="group bg-white border border-slate-100 rounded-2xl p-5 hover:border-emerald-200 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-lg text-slate-900">{condition.condition}</h4>
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                  condition.probability === 'High' ? "bg-red-100 text-red-700" :
                                  condition.probability === 'Moderate' ? "bg-amber-100 text-amber-700" :
                                  "bg-blue-100 text-blue-700"
                                )}>
                                  {condition.probability} Match
                                </span>
                              </div>
                              <p className="text-slate-500 text-sm leading-relaxed">
                                {condition.description}
                              </p>
                            </div>
                            <div className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase",
                              condition.urgency === 'Emergency' ? "bg-red-600 text-white" :
                              condition.urgency === 'Urgent' ? "bg-amber-500 text-white" :
                              "bg-slate-100 text-slate-600"
                            )}>
                              {condition.urgency === 'Emergency' && <AlertTriangle size={10} />}
                              {condition.urgency}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-50">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Common Symptoms</span>
                              <div className="flex flex-wrap gap-1">
                                {condition.commonSymptoms.map(s => (
                                  <span key={s} className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-[10px]">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Next Steps</span>
                              <ul className="space-y-1">
                                {condition.nextSteps.map((step, i) => (
                                  <li key={i} className="text-[10px] text-slate-600 flex items-center gap-1">
                                    <CheckCircle2 size={10} className="text-emerald-500" />
                                    {step}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {(condition.urgency === 'Urgent' || condition.urgency === 'Emergency') && (
                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <Stethoscope size={14} className="text-emerald-500" />
                                <span>Recommended: <span className="font-bold">{condition.probableSpecialty}</span></span>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedSpecialty(condition.probableSpecialty);
                                  setShowBookingModal(true);
                                }}
                                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
                              >
                                <Calendar size={14} /> Book Appointment
                              </button>
                            </div>
                          )}

                          {condition.urgency === 'Routine' && condition.otcSuggestions && condition.otcSuggestions.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-50 space-y-4">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Suggested OTC Medications</span>
                                <div className="flex flex-wrap gap-2">
                                  {condition.otcSuggestions.map(otc => (
                                    <span key={otc} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-medium border border-emerald-100">
                                      {otc}
                                    </span>
                                  ))}
                                </div>
                                <p className="mt-2 text-[9px] text-slate-400 italic">
                                  * Non-prescription only. Consult a pharmacist for guidance. No dosage provided.
                                </p>
                              </div>
                              
                              {condition.pharmacyLinks && condition.pharmacyLinks.length > 0 && (
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Order Online:</span>
                                  <div className="flex gap-2">
                                    {condition.pharmacyLinks.map(link => (
                                      <a 
                                        key={link.name}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center gap-1"
                                      >
                                        <ExternalLink size={10} /> {link.name}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Call to Action */}
                  <div className="bg-slate-900 rounded-3xl p-8 text-white flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold mb-2">Need professional help?</h3>
                      <p className="text-slate-400 text-sm">Connect with a verified doctor in minutes.</p>
                    </div>
                    <button className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-bold transition-all flex items-center gap-2">
                      Book Consultation <ArrowRight size={18} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="max-w-5xl mx-auto px-4 mt-12 text-center text-slate-400 text-xs">
        <p>© 2024 MediSense AI. All rights reserved.</p>
        <p className="mt-2">Powered by Gemini AI • HIPAA Compliant Infrastructure • Secure Data Encryption</p>
      </footer>
      <AnimatePresence>
        {showBookingModal && (
          <BookingModal 
            specialty={selectedSpecialty} 
            onClose={() => setShowBookingModal(false)}
            patientName={user?.displayName || undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
