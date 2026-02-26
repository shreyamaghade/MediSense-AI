import React, { useState } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';
import { auth, googleProvider, isConfigValid } from '../lib/firebase';
import { LogIn, LogOut, Mail, Lock, UserPlus, Chrome, AlertCircle } from 'lucide-react';

interface AuthProps {
  onUserChange: (user: User | null) => void;
}

export const Auth: React.FC<AuthProps> = ({ onUserChange }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  React.useEffect(() => {
    if (!auth) return;
    return auth.onAuthStateChanged((u) => {
      setUser(u);
      onUserChange(u);
    });
  }, [onUserChange]);

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setError(null);
    setLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  if (!isConfigValid) {
    return (
      <div className="w-full max-w-sm p-6 bg-amber-50 rounded-3xl border border-amber-100 text-center">
        <AlertCircle className="mx-auto mb-3 text-amber-600" size={32} />
        <h2 className="text-lg font-bold text-amber-900 mb-2">Authentication Unavailable</h2>
        <p className="text-xs text-amber-700 leading-relaxed">
          Firebase API keys are missing or invalid. Please configure the environment variables in the project settings to enable authentication.
        </p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-4 p-2 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/20">
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-slate-900">{user.displayName || user.email}</span>
          <button 
            onClick={handleSignOut}
            className="text-[10px] text-red-500 hover:underline flex items-center gap-1"
          >
            <LogOut size={10} /> Sign Out
          </button>
        </div>
        {user.photoURL ? (
          <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">
            {user.email?.[0].toUpperCase()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm p-6 bg-white rounded-3xl shadow-xl border border-slate-100">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">Welcome to MediSense</h2>
        <p className="text-sm text-slate-500">Sign in to access your diagnosis history</p>
      </div>

      <form onSubmit={handleEmailAuth} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            required
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            required
          />
        </div>

        {error && <p className="text-xs text-red-500 text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-slate-900 text-white rounded-2xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
        >
          {loading ? 'Processing...' : isRegistering ? <><UserPlus size={18} /> Create Account</> : <><LogIn size={18} /> Sign In</>}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-500">Or continue with</span>
        </div>
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-semibold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 mb-4"
      >
        <Chrome size={18} className="text-blue-500" /> Google
      </button>

      <p className="text-center text-xs text-slate-500">
        {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button 
          onClick={() => setIsRegistering(!isRegistering)}
          className="text-emerald-600 font-bold hover:underline"
        >
          {isRegistering ? 'Sign In' : 'Sign Up'}
        </button>
      </p>
    </div>
  );
};
