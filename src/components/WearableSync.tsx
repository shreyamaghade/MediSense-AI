import React, { useState, useEffect } from 'react';
import { 
  Watch, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Trash2,
  ExternalLink,
  Activity,
  Heart,
  Moon
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { getCsrfToken } from '../services/geminiService';
import { cn } from '../lib/utils';

interface WearableData {
  avgSteps: number;
  avgHeartRate: number;
  sleepHours: number;
}

export const WearableSync: React.FC<{ onDataSync: (data: WearableData | null) => void }> = ({ onDataSync }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<WearableData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/wearable/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { connected } = await res.json();
      setIsConnected(connected);
      if (connected) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to check wearable status", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setSyncing(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/wearable/data', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const wearableData = await res.json();
        setData(wearableData);
        onDataSync(wearableData);
      }
    } catch (err) {
      setError("Failed to sync wearable data");
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/google/url', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { url } = await res.json();
      
      const authWindow = window.open(url, 'google_fit_sync', 'width=600,height=700');
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'WEARABLE_SYNC_SUCCESS') {
          setIsConnected(true);
          fetchData();
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (err) {
      setError("Failed to start sync process");
    }
  };

  const handleRevoke = async () => {
    if (!confirm("Are you sure you want to disconnect your wearable? This will remove access to your health data.")) return;
    
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const csrfToken = await getCsrfToken();
      
      await fetch('/api/wearable/revoke', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        }
      });
      
      setIsConnected(false);
      setData(null);
      onDataSync(null);
    } catch (err) {
      setError("Failed to revoke permissions");
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (loading) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-xl",
            isConnected ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
          )}>
            <Watch size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Wearable Sync</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              {isConnected ? "Connected to Google Fit" : "Not Connected"}
            </p>
          </div>
        </div>
        
        {isConnected ? (
          <button 
            onClick={handleRevoke}
            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
            title="Revoke Permissions"
          >
            <Trash2 size={16} />
          </button>
        ) : (
          <button 
            onClick={handleConnect}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            <ExternalLink size={14} /> Connect
          </button>
        )}
      </div>

      {isConnected && (
        <div className="space-y-4">
          {data ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-2xl text-center">
                <Activity size={14} className="mx-auto text-blue-500 mb-1" />
                <div className="text-xs font-bold text-slate-900">{Math.round(data.avgSteps)}</div>
                <div className="text-[8px] text-slate-400 uppercase font-bold">Steps</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl text-center">
                <Heart size={14} className="mx-auto text-red-500 mb-1" />
                <div className="text-xs font-bold text-slate-900">{Math.round(data.avgHeartRate)}</div>
                <div className="text-[8px] text-slate-400 uppercase font-bold">BPM</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl text-center">
                <Moon size={14} className="mx-auto text-purple-500 mb-1" />
                <div className="text-xs font-bold text-slate-900">{data.sleepHours.toFixed(1)}h</div>
                <div className="text-[8px] text-slate-400 uppercase font-bold">Sleep</div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center">
              <RefreshCw className="animate-spin text-slate-300 mx-auto mb-2" size={20} />
              <p className="text-[10px] text-slate-400">Syncing health data...</p>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-medium">
            <ShieldCheck size={14} />
            Data synced for AI diagnosis. You can revoke access anytime.
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-500 text-[10px] font-bold">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </div>
  );
};
