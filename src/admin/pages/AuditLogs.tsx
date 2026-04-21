import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { FileText, Search, ShieldCheck, Stethoscope, Calendar, Users, Settings, Megaphone } from 'lucide-react';
import { format } from 'date-fns';

const ACTION_STYLES: Record<string, { color: string; icon: any }> = {
  CREATE_DOCTOR: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: Stethoscope },
  DELETE_DOCTOR: { color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: Stethoscope },
  SUSPEND_DOCTOR: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Stethoscope },
  UPDATE_DOCTOR: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: Stethoscope },
  DELETE_APPOINTMENT: { color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: Calendar },
  UPDATE_APPOINTMENT: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: Calendar },
  FLAG_PATIENT: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Users },
  DEACTIVATE_PATIENT: { color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: Users },
  UPDATE_SETTINGS: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: Settings },
  SET_HOLIDAY: { color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: Calendar },
  OVERRIDE_AVAILABILITY: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Calendar },
  BROADCAST_MESSAGE: { color: 'text-teal-400 bg-teal-500/10 border-teal-500/20', icon: Megaphone },
};

export function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(200)),
      (snap) => { setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { if (err.code !== 'permission-denied') console.error('Audit logs error:', err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const filtered = logs.filter(l => {
    const matchSearch = !search || l.action?.toLowerCase().includes(search.toLowerCase()) || l.target?.toLowerCase().includes(search.toLowerCase()) || l.details?.toLowerCase().includes(search.toLowerCase());
    const matchAction = filterAction === 'all' || l.action === filterAction;
    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-white">Audit Logs</h1>
        <p className="text-gray-400 text-sm mt-0.5">Complete history of all administrative actions.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-2xl font-black text-white">{logs.length}</div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Total Entries</div>
        </div>
        {['CREATE_DOCTOR', 'DELETE_DOCTOR', 'UPDATE_SETTINGS'].map(action => (
          <div key={action} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className={`text-2xl font-black ${ACTION_STYLES[action]?.color.split(' ')[0]}`}>{logs.filter(l => l.action === action).length}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{action.replace(/_/g, ' ')}</div>
          </div>
        ))}
      </div>

      {/* Filter + Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-400" />
            <span className="text-sm font-bold text-white">Event Log</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="h-8 px-3 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-xs focus:outline-none"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map(a => <option key={a} value={a}>{a?.replace(/_/g, ' ')}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={13} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..." className="pl-9 h-8 bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 rounded-xl text-xs focus:outline-none focus:border-red-500 w-48" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-14 text-center text-gray-500 text-sm">
            <div className="animate-spin h-7 w-7 border-2 border-gray-700 border-t-red-500 rounded-full mx-auto mb-3" />Loading logs...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-14 text-center text-gray-600 text-sm"><FileText size={28} className="mx-auto mb-3 text-gray-800" />No audit logs found</div>
        ) : (
          <div className="divide-y divide-gray-800 max-h-[60vh] overflow-y-auto">
            {filtered.map(log => {
              const style = ACTION_STYLES[log.action] || { color: 'text-gray-400 bg-gray-800 border-gray-700', icon: ShieldCheck };
              const Icon = style.icon;
              return (
                <div key={log.id} className="px-5 py-3.5 flex items-start gap-4 hover:bg-gray-800/30 transition-all">
                  <div className={`p-2 rounded-lg border ${style.color} shrink-0 mt-0.5`}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${style.color}`}>{log.action?.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-400 truncate max-w-xs">{log.target}</span>
                    </div>
                    {log.details && <p className="text-xs text-gray-500 mt-1 truncate">{log.details}</p>}
                  </div>
                  <div className="text-[10px] text-gray-600 shrink-0">
                    {log.timestamp ? format(log.timestamp.toDate(), 'MMM dd, h:mm a') : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
