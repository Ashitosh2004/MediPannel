import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { CalendarDays, Users, Clock, Calendar, TrendingUp, RefreshCw } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  patientName?: string;
  patientEmail?: string;
  userId?: string;
  date: string;
  time?: string;
  status: string;
  type?: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, 'MMM dd, yyyy') : dateStr;
  } catch {
    return dateStr;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">{status}</span>;
    case 'confirmed':
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">{status}</span>;
    case 'completed':
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{status}</span>;
    case 'cancelled':
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600">{status}</span>;
    default:
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 capitalize">{status}</span>;
  }
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeletons
// ─────────────────────────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3.5 w-28 bg-slate-100 rounded-xl" />
          <div className="h-8 w-16 bg-slate-100 rounded-xl" />
        </div>
        <div className="h-11 w-11 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 px-5 animate-pulse border-b border-slate-50 last:border-0">
      <div className="h-9 w-9 bg-slate-100 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-32 bg-slate-100 rounded-xl" />
        <div className="h-3 w-20 bg-slate-100 rounded-xl" />
      </div>
      <div className="h-6 w-16 bg-slate-100 rounded-full" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DoctorDashboard
// ─────────────────────────────────────────────────────────────────────────────

export function DoctorDashboard() {
  const { doctorUser, doctorData, loading: authLoading } = useDoctorAuth();

  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [allAppts, setAllAppts] = useState<Appointment[]>([]);
  const [upcomingAppts, setUpcomingAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const today = getTodayString();

  useEffect(() => {
    // Wait until auth context finishes loading so originalDocId is guaranteed
    if (!doctorUser?.uid || authLoading) return;
    const uid = doctorUser.uid;

    // Include the Firestore original doc ID so we catch appointments stored
    // with the old ID (created before the UID was synced back to Firestore)
    const doctorIds = [uid];
    if (doctorData?.originalDocId && doctorData.originalDocId !== uid) {
      doctorIds.push(doctorData.originalDocId);
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [todaySnap, allSnap, upcomingSnap] = await Promise.all([
          // Today's appointments
          getDocs(
            query(
              collection(db, 'appointments'),
              where('doctorId', 'in', doctorIds),
              where('date', '==', today),
            ),
          ),
          // All appointments (for unique patient count)
          getDocs(
            query(
              collection(db, 'appointments'),
              where('doctorId', 'in', doctorIds),
            ),
          ),
          // Upcoming (non-cancelled)
          getDocs(
            query(
              collection(db, 'appointments'),
              where('doctorId', 'in', doctorIds),
              limit(20),
            ),
          ),
        ]);

        const todayList = todaySnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Appointment))
          .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

        const allList = allSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));

        const upcomingList = upcomingSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Appointment))
          .filter((a) => a.status !== 'cancelled')
          .sort((a, b) => (a.date > b.date ? 1 : -1))
          .slice(0, 5);

        setTodayAppts(todayList);
        setAllAppts(allList);
        setUpcomingAppts(upcomingList);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [doctorUser?.uid, doctorData?.originalDocId, authLoading, today]);

  // Unique patient count by userId
  const totalPatients = useMemo(() => {
    const ids = new Set(allAppts.map((a) => a.userId).filter(Boolean));
    return ids.size;
  }, [allAppts]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const stats = [
    {
      label: "Today's Appointments",
      value: loading ? '—' : todayAppts.length,
      icon: CalendarDays,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      valueCls: 'text-emerald-600',
    },
    {
      label: 'Total Patients',
      value: loading ? '—' : totalPatients,
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      valueCls: 'text-blue-500',
    },
    {
      label: 'Upcoming Appointments',
      value: loading ? '—' : upcomingAppts.length,
      icon: Clock,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-500',
      valueCls: 'text-violet-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {greeting}, Dr. {(doctorData?.name?.replace(/^Dr\.?\s*/i, '') || 'Doctor').split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Here's your schedule overview for {format(new Date(), 'EEEE, MMMM dd yyyy')}.
        </p>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading
          ? [1, 2, 3].map((i) => <StatCardSkeleton key={i} />)
          : stats.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-medium">{s.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${s.valueCls}`}>{s.value}</p>
                  </div>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.iconBg} shrink-0`}>
                    <s.icon size={20} className={s.iconColor} />
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* ── Today's Schedule ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CalendarDays size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Today's Schedule</h2>
              <p className="text-slate-500 text-xs">{format(new Date(), 'EEEE, MMM dd')}</p>
            </div>
          </div>
          {!loading && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              {todayAppts.length} appt{todayAppts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="-mx-5 -my-5 divide-y divide-slate-50">
              {[1, 2, 3].map((i) => <RowSkeleton key={i} />)}
            </div>
          ) : todayAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
                <Calendar size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-600 text-sm font-medium">No appointments today</p>
              <p className="text-slate-500 text-xs mt-1">Enjoy your day off or check upcoming schedule below.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayAppts.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 select-none">
                    {getInitials(appt.patientName)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {appt.patientName || `Patient #${(appt.userId ?? appt.id).slice(-6)}`}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {appt.time && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={11} />
                          {appt.time}
                        </span>
                      )}
                      {appt.type && (
                        <span className="text-xs text-slate-400 capitalize">· {appt.type}</span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  {statusBadge(appt.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Upcoming Appointments ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <TrendingUp size={16} className="text-violet-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Upcoming Appointments</h2>
            <p className="text-slate-500 text-xs">Next scheduled visits</p>
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-50">
            {[1, 2, 3, 4, 5].map((i) => <RowSkeleton key={i} />)}
          </div>
        ) : upcomingAppts.length === 0 ? (
          <div className="p-5 flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
              <Clock size={24} className="text-slate-300" />
            </div>
            <p className="text-slate-600 text-sm font-medium">No upcoming appointments</p>
            <p className="text-slate-500 text-xs mt-1">Your upcoming schedule is clear.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Patient</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Time</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Type</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {upcomingAppts.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 select-none">
                          {getInitials(appt.patientName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">
                            {appt.patientName || `Patient #${(appt.userId ?? appt.id).slice(-6)}`}
                          </p>
                          {appt.patientEmail && (
                            <p className="text-xs text-slate-400 truncate">{appt.patientEmail}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDate(appt.date)}</td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{appt.time ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500 capitalize whitespace-nowrap">{appt.type ?? '—'}</td>
                    <td className="px-5 py-3">{statusBadge(appt.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
