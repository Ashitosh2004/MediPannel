import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { Search, FileText, Edit3, X, Calendar } from 'lucide-react';
import { format, parseISO, isToday, isFuture, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';

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
  updatedAt?: any;
}

type TabKey = 'All' | 'Today' | 'Upcoming' | 'Completed' | 'Cancelled';

const TABS: TabKey[] = ['All', 'Today', 'Upcoming', 'Completed', 'Cancelled'];

const STATUS_OPTIONS: Appointment['status'][] = ['pending', 'confirmed', 'completed', 'cancelled'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 capitalize">{status}</span>;
    case 'confirmed':
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 capitalize">{status}</span>;
    case 'completed':
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 capitalize">{status}</span>;
    case 'cancelled':
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600 capitalize">{status}</span>;
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
// Loading skeleton row
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-50 animate-pulse">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-slate-100 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-28 bg-slate-100 rounded-xl" />
            <div className="h-3 w-20 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5"><div className="h-3.5 w-24 bg-slate-100 rounded-xl" /></td>
      <td className="px-5 py-3.5"><div className="h-3.5 w-16 bg-slate-100 rounded-xl" /></td>
      <td className="px-5 py-3.5"><div className="h-6 w-20 bg-slate-100 rounded-full" /></td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-24 bg-slate-100 rounded-lg" />
          <div className="h-7 w-7 bg-slate-100 rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes Modal
// ─────────────────────────────────────────────────────────────────────────────

interface NotesModalProps {
  appointment: Appointment;
  onClose: () => void;
  onSaved: (id: string, notes: string) => void;
}

function NotesModal({ appointment, onClose, onSaved }: NotesModalProps) {
  const [notes, setNotes] = useState(appointment.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'appointments', appointment.id), {
        notes,
        updatedAt: serverTimestamp(),
      });
      toast.success('Notes saved');
      onSaved(appointment.id, notes);
      onClose();
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  // Trap scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <FileText size={16} className="text-emerald-600" />
              Appointment Notes
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              {appointment.patientName || `Patient #${(appointment.userId ?? appointment.id).slice(-6)}`}
              {' · '}
              {formatDate(appointment.date)}
              {appointment.time ? ` · ${appointment.time}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Clinical Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter appointment notes, observations, treatment plan…"
            rows={6}
            className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
          />
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DoctorAppointments
// ─────────────────────────────────────────────────────────────────────────────

export function DoctorAppointments() {
  const { doctorUser, doctorData, loading: authLoading } = useDoctorAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('All');
  const [search, setSearch] = useState('');
  const [notesTarget, setNotesTarget] = useState<Appointment | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Wait for auth to fully load so originalDocId is guaranteed in doctorData
    if (!doctorUser?.uid || authLoading) return;

    const fetchAppts = async () => {
      setLoading(true);
      try {
        const uid = doctorUser.uid;
        const doctorIds = [uid];
        if (doctorData?.originalDocId) {
          doctorIds.push(doctorData.originalDocId);
        }

        const snap = await getDocs(
          query(
            collection(db, 'appointments'),
            where('doctorId', 'in', doctorIds),
          ),
        );
        // Sort client-side to avoid requiring composite Firestore index
        const sorted = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Appointment))
          .sort((a, b) => (b.date > a.date ? 1 : -1));
        setAppointments(sorted);
      } catch (error) {
        console.error('Error fetching appointments:', error);
        toast.error('Failed to load appointments');
      } finally {
        setLoading(false);
      }
    };

    fetchAppts();
  }, [doctorUser?.uid, doctorData?.originalDocId, authLoading]);

  // ── Tab filtering ────────────────────────────────────────────────────────

  const tabFiltered = useMemo(() => {
    return appointments.filter((a) => {
      switch (activeTab) {
        case 'Today':
          try { return isToday(parseISO(a.date)); } catch { return false; }
        case 'Upcoming':
          try { const d = parseISO(a.date); return (isToday(d) || isFuture(d)) && a.status !== 'cancelled'; } catch { return false; }
        case 'Completed':
          return a.status === 'completed';
        case 'Cancelled':
          return a.status === 'cancelled';
        default:
          return true;
      }
    });
  }, [appointments, activeTab]);

  // ── Search filtering ─────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search.trim()) return tabFiltered;
    const q = search.toLowerCase();
    return tabFiltered.filter(
      (a) =>
        a.patientName?.toLowerCase().includes(q) ||
        a.patientEmail?.toLowerCase().includes(q) ||
        a.userId?.toLowerCase().includes(q),
    );
  }, [tabFiltered, search]);

  // ── Tab counts ───────────────────────────────────────────────────────────

  const tabCounts = useMemo(() => {
    const todayCount = appointments.filter((a) => { try { return isToday(parseISO(a.date)); } catch { return false; } }).length;
    const upcomingCount = appointments.filter((a) => { try { const d = parseISO(a.date); return (isToday(d) || isFuture(d)) && a.status !== 'cancelled'; } catch { return false; } }).length;
    return {
      All: appointments.length,
      Today: todayCount,
      Upcoming: upcomingCount,
      Completed: appointments.filter((a) => a.status === 'completed').length,
      Cancelled: appointments.filter((a) => a.status === 'cancelled').length,
    } as Record<TabKey, number>;
  }, [appointments]);

  // ── Status update ────────────────────────────────────────────────────────

  const handleStatusChange = async (appt: Appointment, newStatus: string) => {
    if (newStatus === appt.status) return;
    setUpdatingId(appt.id);
    try {
      await updateDoc(doc(db, 'appointments', appt.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setAppointments((prev) =>
        prev.map((a) => (a.id === appt.id ? { ...a, status: newStatus } : a)),
      );
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Notes saved callback ─────────────────────────────────────────────────

  const handleNotesSaved = (id: string, notes: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, notes } : a)),
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Appointments</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manage your patient appointments, update statuses and add clinical notes.
        </p>
      </div>

      {/* ── Main card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* ── Toolbar ── */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={
                    activeTab === tab
                      ? 'bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all flex items-center gap-1.5'
                      : 'text-slate-600 hover:bg-slate-100 rounded-xl px-4 py-2 text-sm font-medium transition-all flex items-center gap-1.5'
                  }
                >
                  {tab}
                  {!loading && (
                    <span
                      className={`text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-semibold ${
                        activeTab === tab
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tabCounts[tab]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative sm:ml-auto">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient name or email…"
                className="pl-9 pr-3 h-9 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors w-full sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Patient</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Date & Time</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Type</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1, 2, 3, 4, 5, 6].map((i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
                        <Calendar size={24} className="text-slate-300" />
                      </div>
                      <p className="text-slate-600 text-sm font-medium">
                        {search ? 'No appointments match your search' : `No ${activeTab.toLowerCase()} appointments`}
                      </p>
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          className="mt-2 text-xs text-emerald-600 hover:underline font-medium"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50 transition-colors group">
                    {/* Patient */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 select-none">
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

                    {/* Date & Time */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="text-slate-700 text-sm">{formatDate(appt.date)}</p>
                      {appt.time && (
                        <p className="text-xs text-slate-400 mt-0.5">{appt.time}</p>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-5 py-3.5">
                      <span className="text-slate-500 capitalize text-sm">{appt.type ?? '—'}</span>
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-3.5">{statusBadge(appt.status)}</td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {/* Status dropdown */}
                        <div className="relative">
                          {updatingId === appt.id ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 border border-slate-200 rounded-lg text-xs text-slate-400">
                              <span className="w-3 h-3 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
                              Updating…
                            </div>
                          ) : (
                            <select
                              value={appt.status}
                              onChange={(e) => handleStatusChange(appt, e.target.value)}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:border-emerald-500 outline-none hover:border-slate-300 transition-colors cursor-pointer"
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s} className="capitalize">
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Notes button */}
                        <button
                          onClick={() => setNotesTarget(appt)}
                          title={appt.notes ? 'Edit notes' : 'Add notes'}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            appt.notes
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                          }`}
                        >
                          {appt.notes ? <Edit3 size={13} /> : <FileText size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer count ── */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-600">{filtered.length}</span> appointment{filtered.length !== 1 ? 's' : ''}
              {search && <> matching "<span className="font-semibold text-slate-600">{search}</span>"</>}
            </p>
          </div>
        )}
      </div>

      {/* ── Notes Modal ── */}
      {notesTarget && (
        <NotesModal
          appointment={notesTarget}
          onClose={() => setNotesTarget(null)}
          onSaved={handleNotesSaved}
        />
      )}
    </div>
  );
}
