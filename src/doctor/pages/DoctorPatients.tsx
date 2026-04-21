import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from 'firebase/firestore';
import { Users, Search, User, Calendar, Mail, ChevronRight, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { db } from '../../lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PatientRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt?: any;
  photoURL?: string;
}

interface PatientWithStats extends PatientRecord {
  appointmentCount: number;
  lastAppointmentDate: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name?: string): string {
  if (!name) return 'PT';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(value: any): string {
  if (!value) return '—';
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    return format(date, 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-2/5" />
        </div>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-8 bg-slate-200 rounded-xl w-28" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Patient card
// ─────────────────────────────────────────────────────────────────────────────

interface PatientCardProps {
  patient: PatientWithStats;
  onViewDetails: (id: string) => void;
}

function PatientCard({ patient, onViewDetails }: PatientCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-emerald-200 transition-all duration-200 group">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 select-none shadow-sm">
          {getInitials(patient.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 text-sm truncate">{patient.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <Mail size={12} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 truncate">{patient.email || '—'}</span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2.5">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-lg">
              <Calendar size={11} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">
                {patient.appointmentCount} appt{patient.appointmentCount !== 1 ? 's' : ''}
              </span>
            </div>
            {patient.lastAppointmentDate && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">Last:</span>
                <span className="text-xs font-medium text-slate-600">{patient.lastAppointmentDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Joined {formatDate(patient.createdAt)}
        </span>
        <button
          onClick={() => onViewDetails(patient.id)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-1.5 group-hover:shadow-md group-hover:shadow-emerald-600/20"
        >
          View Details
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyPatients({ filtered }: { filtered: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        {filtered ? <Search size={28} className="text-slate-400" /> : <UserX size={28} className="text-slate-400" />}
      </div>
      <h3 className="text-slate-700 font-semibold text-base mb-1">
        {filtered ? 'No patients found' : 'No patients yet'}
      </h3>
      <p className="text-slate-400 text-sm max-w-xs">
        {filtered
          ? 'Try adjusting your search query.'
          : 'Patients will appear here once they book an appointment with you.'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function DoctorPatients() {
  const { doctorUser, doctorData, loading: authLoading } = useDoctorAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<PatientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Wait for auth to fully load so originalDocId is guaranteed in doctorData
    if (!doctorUser || authLoading) return;

    const fetchPatients = async () => {
      setLoading(true);
      setError(null);
      try {
        const uid = doctorUser.uid;

        // Include the old Firestore doc ID so patients from older appointments are found
        const doctorIds = [uid];
        if (doctorData?.originalDocId && doctorData.originalDocId !== uid) {
          doctorIds.push(doctorData.originalDocId);
        }

        // Step 1: fetch all appointments for this doctor
        const apptQuery = query(
          collection(db, 'appointments'),
          where('doctorId', 'in', doctorIds),
        );
        const apptSnap = await getDocs(apptQuery);

        // Step 2: extract unique patientIds
        const allAppts = apptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        const patientIds = [
          ...new Set<string>(
            allAppts
              .map((a: any) => a.userId || a.patientId)
              .filter(Boolean),
          ),
        ];

        if (patientIds.length === 0) {
          setPatients([]);
          return;
        }

        // Step 3: fetch each patient doc in parallel
        const patientDocs = await Promise.all(
          patientIds.map((pid) => getDoc(doc(db, 'users', pid))),
        );

        // Step 4: build enriched patient list
        const enriched: PatientWithStats[] = patientDocs
          .filter((snap) => snap.exists())
          .map((snap) => {
            const data = snap.data() as PatientRecord;
            const pid = snap.id;

            // Filter appointments for this patient
            const patientAppts = allAppts.filter(
              (a: any) => (a.userId || a.patientId) === pid,
            );

            // Find latest appointment date
            let lastDate: Date | null = null;
            for (const appt of patientAppts) {
              const raw = appt.date || appt.appointmentDate || appt.scheduledAt;
              if (!raw) continue;
              try {
                const d = raw?.toDate ? raw.toDate() : new Date(raw);
                if (!lastDate || d > lastDate) lastDate = d;
              } catch {
                // skip invalid dates
              }
            }

            return {
              id: pid,
              name: data.name || 'Unknown Patient',
              email: data.email || '',
              phone: (data as any).phone || '',
              createdAt: data.createdAt,
              photoURL: (data as any).photoURL || '',
              appointmentCount: patientAppts.length,
              lastAppointmentDate: lastDate ? format(lastDate, 'MMM d, yyyy') : null,
            };
          });

        // Sort by appointment count descending
        enriched.sort((a, b) => b.appointmentCount - a.appointmentCount);
        setPatients(enriched);
      } catch (err: any) {
        setError('Failed to load patients. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [doctorUser, doctorData, authLoading]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    );
  }, [patients, search]);

  const handleViewDetails = (patientId: string) => {
    navigate({ to: '/doctor/patients/$patientId', params: { patientId } } as any);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Users size={22} className="text-emerald-600" />
            My Patients
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {loading ? 'Loading…' : `${patients.length} patient${patients.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-72">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Summary strip */}
      {!loading && !error && patients.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Patients</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{patients.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Appointments</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {patients.reduce((s, p) => s + p.appointmentCount, 0)}
            </p>
          </div>
          <div className="hidden sm:block bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm px-5 py-4">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Showing</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{filtered.length}</p>
          </div>
        </div>
      )}

      {/* Patient grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.length === 0
          ? <EmptyPatients filtered={search.trim().length > 0} />
          : filtered.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onViewDetails={handleViewDetails}
              />
            ))}
      </div>
    </div>
  );
}
