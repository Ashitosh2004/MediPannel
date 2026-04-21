import React, { useEffect, useState } from 'react';
import { collection, getDocs, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import {
  Users, Stethoscope, Calendar, MessageSquare,
  Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw
} from 'lucide-react';

interface Stats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  totalMessages: number;
  upcomingAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
}

/** Safely fetch count from a Firestore collection — returns 0 on any error */
async function safeCount(collectionName: string): Promise<number> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.size;
  } catch {
    return 0;
  }
}

/** Safely fetch all docs from a collection — returns [] on any error */
async function safeDocs(collectionName: string): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map(d => d.data());
  } catch {
    return [];
  }
}

export function AdminDashboard() {
  const { adminData } = useAdminAuth();
  const [stats, setStats] = useState<Stats>({
    totalPatients: 0, totalDoctors: 0, totalAppointments: 0, totalMessages: 0,
    upcomingAppointments: 0, completedAppointments: 0, cancelledAppointments: 0
  });
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [recentDoctors, setRecentDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch each collection independently so one failure doesn't break all counts
      const [totalPatients, totalDoctors, totalMessages, appts] = await Promise.all([
        safeCount('users'),
        safeCount('doctors'),
        safeCount('messages'),
        safeDocs('appointments'),
      ]);

      setStats({
        totalPatients,
        totalDoctors,
        totalAppointments: appts.length,
        totalMessages,
        upcomingAppointments: appts.filter(a => a.status === 'upcoming').length,
        completedAppointments: appts.filter(a => a.status === 'completed').length,
        cancelledAppointments: appts.filter(a => a.status === 'cancelled').length,
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Real-time recent appointments — order by date (string field, no composite index needed)
    const unsubAppts = onSnapshot(
      query(collection(db, 'appointments'), limit(5)),
      (snap) => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => {
            // Sort by createdAt or date descending, client-side
            const aTime = a.createdAt?.toMillis?.() ?? new Date(a.date || 0).getTime();
            const bTime = b.createdAt?.toMillis?.() ?? new Date(b.date || 0).getTime();
            return bTime - aTime;
          });
        setRecentAppointments(docs);
      },
      (err) => {
        if (err.code !== 'permission-denied') console.warn('Recent appointments:', err.message);
        setRecentAppointments([]);
      }
    );

    // Real-time recent doctors — order by createdAt desc
    const unsubDoctors = onSnapshot(
      query(collection(db, 'doctors'), orderBy('createdAt', 'desc'), limit(5)),
      (snap) => setRecentDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => {
        if (err.code !== 'permission-denied') console.warn('Recent doctors:', err.message);
        // Fallback: fetch without ordering
        getDocs(query(collection(db, 'doctors'), limit(5)))
          .then(snap => setRecentDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
          .catch(() => setRecentDoctors([]));
      }
    );

    return () => { unsubAppts(); unsubDoctors(); };
  }, []);

  const statCards = [
    { label: 'Total Patients',      value: stats.totalPatients,      icon: Users,         color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   glow: 'hover:border-blue-400/40' },
    { label: 'Total Doctors',       value: stats.totalDoctors,       icon: Stethoscope,   color: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',glow: 'hover:border-emerald-400/40' },
    { label: 'Total Appointments',  value: stats.totalAppointments,  icon: Calendar,      color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  glow: 'hover:border-amber-400/40' },
    { label: 'Total Messages',      value: stats.totalMessages,      icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', glow: 'hover:border-purple-400/40' },
  ];

  const apptStatus = [
    { label: 'Upcoming',   value: stats.upcomingAppointments,   icon: Clock,         color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Completed',  value: stats.completedAppointments,  icon: CheckCircle2,  color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Cancelled',  value: stats.cancelledAppointments,  icon: XCircle,       color: 'text-red-400 bg-red-500/10' },
  ];

  const statusColor: Record<string, string> = {
    upcoming:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  const doctorStatusColor: Record<string, string> = {
    active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="space-y-7 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Welcome back, <span className="text-red-400 font-semibold">{adminData?.name || adminData?.email}</span>. Here's the system overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-gray-600 font-semibold">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 active:scale-95"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`bg-gray-900 border ${s.border} ${s.glow} rounded-2xl p-5 transition-all duration-300 group`}
          >
            <div className="flex justify-between items-start">
              <div>
                {loading ? (
                  <div className="h-9 w-16 bg-gray-800 rounded-lg animate-pulse mb-2" />
                ) : (
                  <div className="text-3xl font-black text-white tabular-nums">{s.value.toLocaleString()}</div>
                )}
                <div className="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-wider">{s.label}</div>
              </div>
              <div className={`p-3 rounded-xl ${s.bg} group-hover:scale-110 transition-transform duration-300`}>
                <s.icon size={20} className={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Appointment status breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {apptStatus.map((a) => (
          <div key={a.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4 hover:border-gray-600 transition-all">
            <div className={`p-3 rounded-xl ${a.color}`}>
              <a.icon size={20} />
            </div>
            <div>
              {loading ? (
                <div className="h-6 w-10 bg-gray-800 rounded animate-pulse mb-1" />
              ) : (
                <div className="text-xl font-black text-white tabular-nums">{a.value}</div>
              )}
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{a.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent data tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Appointments */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white">Recent Appointments</h3>
            </div>
            <a href="/admin/appointments" className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors">
              View All →
            </a>
          </div>
          <div className="divide-y divide-gray-800/60">
            {recentAppointments.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar size={24} className="mx-auto mb-2 text-gray-800" />
                <p className="text-sm text-gray-600 font-semibold">No appointments yet</p>
              </div>
            ) : recentAppointments.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-800/30 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{a.patientName || a.doctorName || '—'}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {a.date}{a.time ? ` · ${a.time}` : ''}{a.doctorName ? ` · Dr. ${a.doctorName}` : ''}
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusColor[a.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                  {a.status || 'pending'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Doctors */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope size={16} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Recent Doctors</h3>
            </div>
            <a href="/admin/doctors" className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors">
              Manage →
            </a>
          </div>
          <div className="divide-y divide-gray-800/60">
            {recentDoctors.length === 0 ? (
              <div className="p-8 text-center">
                <Stethoscope size={24} className="mx-auto mb-2 text-gray-800" />
                <p className="text-sm text-gray-600 font-semibold">No doctors added yet</p>
                <p className="text-xs text-gray-700 mt-1">Add doctors via Doctor Management</p>
              </div>
            ) : recentDoctors.map(d => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 bg-emerald-600/20 rounded-lg flex items-center justify-center text-emerald-400 font-black text-sm shrink-0 border border-emerald-600/20">
                    {d.name?.charAt(0) || 'D'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{d.name}</div>
                    <div className="text-xs text-gray-500">{d.specialty}</div>
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${doctorStatusColor[d.status] || doctorStatusColor['active']}`}>
                  {d.status || 'active'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
