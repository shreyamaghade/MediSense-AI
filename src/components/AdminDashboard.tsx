import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  Users, 
  Database, 
  Clock,
  ChevronLeft,
  RefreshCw
} from 'lucide-react';

interface AuditLog {
  id: number;
  user_uid: string;
  model_used: string;
  input_hash: string;
  response_hash: string;
  timestamp: string;
}

interface Stats {
  totalRequests: number;
  modelUsage: { model_used: string; count: number }[];
  uniqueUsers: number;
  anomalies: { input_hash: string; user_count: number; request_count: number }[];
}

export const AdminDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();

      const [logsRes, statsRes] = await Promise.all([
        fetch('/api/admin/audit-logs', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!logsRes.ok || !statsRes.ok) throw new Error("Failed to fetch admin data");

      const [logsData, statsData] = await Promise.all([
        logsRes.json(),
        statsRes.json()
      ]);

      setLogs(logsData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500 mb-6">{error}</p>
        <button 
          onClick={onClose}
          className="px-6 py-2 bg-slate-900 text-white rounded-xl font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft size={20} /> Back to App
        </button>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
          <ShieldCheck size={14} /> Admin Access
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Activity size={20} />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Requests</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats?.totalRequests}</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Users size={20} />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Unique Users</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats?.uniqueUsers}</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Anomalies</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats?.anomalies.length}</div>
        </div>
      </div>

      {stats && stats.anomalies.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-3xl p-6">
          <h3 className="text-red-800 font-bold flex items-center gap-2 mb-4">
            <AlertTriangle size={18} /> Potential Anomalies Detected
          </h3>
          <div className="space-y-3">
            {stats.anomalies.map((a, i) => (
              <div key={i} className="bg-white/50 p-4 rounded-2xl text-xs text-red-700 flex justify-between items-center">
                <div>
                  <span className="font-mono">{a.input_hash.substring(0, 16)}...</span>
                  <p className="mt-1 opacity-70">Same input from {a.user_count} different users ({a.request_count} total requests)</p>
                </div>
                <div className="font-bold">High Risk</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Database size={18} className="text-slate-400" /> Recent AI Audit Logs
          </h3>
          <button onClick={fetchData} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User UID</th>
                <th className="px-6 py-4">Model</th>
                <th className="px-6 py-4">Input Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="opacity-30" />
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">
                    {log.user_uid === 'anonymous' ? (
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">ANON</span>
                    ) : (
                      log.user_uid.substring(0, 8) + '...'
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      log.model_used.includes('pro') ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {log.model_used.replace('gemini-', '')}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-[10px] text-slate-400">
                    {log.input_hash.substring(0, 12)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
