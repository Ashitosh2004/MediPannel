import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from '@tanstack/react-router';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  orderBy,
} from 'firebase/firestore';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  FileText,
  Pill,
  Activity,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { db } from '../../lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PatientData {
  name: string;
  email: string;
  phone?: string;
  createdAt?: any;
  photoURL?: string;
}

interface AppointmentDoc {
  id: string;
  date?: any;
  appointmentDate?: any;
  scheduledAt?: any;
  time?: string;
  status?: string;
  type?: string;
  notes?: string;
  reason?: string;
}

interface PrescriptionDoc {
  id: string;
  createdAt?: any;
  date?: any;
  medicines?: string[] | Array<{ name: string; dosage?: string; frequency?: string }>;
  medications?: string[];
  notes?: string;
  diagnosis?: string;
}

interface RecordDoc {
  id: string;
  title?: string;
  type?: string;
  date?: any;
  createdAt?: any;
  description?: string;
}

type TabKey = 'appointments' | 'prescriptions' | 'records';

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

function formatDateTime(value: any): string {
  if (!value) return '—';
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    return format(date, 'MMM d, yyyy · h:mm a');
  } catch {
    return '—';
  }
}

function statusColor(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'confirmed':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'cancelled':
    case 'canceled':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonDetail() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header card skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-slate-200 rounded w-1/3" />
            <div className="h-3 bg-slate-200 rounded w-1/4" />
            <div className="h-3 bg-slate-200 rounded w-1/5" />
          </div>
        </div>
      </div>
      {/* Tab content skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab button
// ─────────────────────────────────────────────────────────────────────────────

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}

function TabButton({ active, onClick, icon, label, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 whitespace-nowrap',
        active
          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
      <span
        className={[
          'px-1.5 py-0.5 text-xs rounded-md font-bold',
          active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600',
        ].join(' ')}
      >
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Appointments tab
// ─────────────────────────────────────────────────────────────────────────────

function AppointmentsTab({ appointments }: { appointments: AppointmentDoc[] }) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
          <Calendar size={22} className="text-slate-400" />
        </div>
        <p className="text-slate-600 font-semibold text-sm">No appointments found</p>
        <p className="text-slate-400 text-xs mt-1">No shared appointments with this patient yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appt) => {
        const dateVal = appt.date || appt.appointmentDate || appt.scheduledAt;
        return (
          <div
            key={appt.id}
            className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-start gap-4"
          >
            {/* Date block */}
            <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 bg-white rounded-xl border border-slate-200 shadow-sm">
              <Calendar size={14} className="text-emerald-600 mb-0.5" />
              <span className="text-[9px] font-bold text-slate-500 uppercase leading-none">
                {dateVal
                  ? (() => {
                      try {
                        const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
                        return format(d, 'MMM');
                      } catch {
                        return '—';
                      }
                    })()
                  : '—'}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <span className="text-sm font-semibold text-slate-800">
                  {formatDateTime(dateVal)}
                </span>
                {appt.time && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={11} />
                    {appt.time}
                  </span>
                )}
              </div>
              <div className="flex items-center flex-wrap gap-2">
                {appt.status && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border ${statusColor(appt.status)}`}
                  >
                    {appt.status}
                  </span>
                )}
                {appt.type && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
                    {appt.type}
                  </span>
                )}
              </div>
              {(appt.notes || appt.reason) && (
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                  {appt.notes || appt.reason}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prescriptions tab
// ─────────────────────────────────────────────────────────────────────────────

function PrescriptionsTab({ prescriptions }: { prescriptions: PrescriptionDoc[] }) {
  if (prescriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
          <Pill size={22} className="text-slate-400" />
        </div>
        <p className="text-slate-600 font-semibold text-sm">No prescriptions yet</p>
        <p className="text-slate-400 text-xs mt-1">Prescriptions you issue will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prescriptions.map((rx) => {
        const dateVal = rx.createdAt || rx.date;
        // Normalise medicines to a flat string array
        const meds: string[] = (() => {
          const raw = rx.medicines || rx.medications || [];
          return raw.map((m: any) =>
            typeof m === 'string' ? m : [m.name, m.dosage, m.frequency].filter(Boolean).join(' · '),
          );
        })();

        return (
          <div
            key={rx.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
          >
            {/* Card header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <FileText size={15} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    {formatDate(dateVal)}
                  </p>
                  {rx.diagnosis && (
                    <p className="text-sm font-semibold text-slate-700">{rx.diagnosis}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Medicines as badges */}
            {meds.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Medicines
                </p>
                <div className="flex flex-wrap gap-2">
                  {meds.map((med, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold"
                    >
                      <Pill size={11} />
                      {med}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {rx.notes && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-slate-600 leading-relaxed">{rx.notes}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Medical Records tab
// ─────────────────────────────────────────────────────────────────────────────

function MedicalRecordsTab({ records }: { records: RecordDoc[] }) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
          <Activity size={22} className="text-slate-400" />
        </div>
        <p className="text-slate-600 font-semibold text-sm">No medical records</p>
        <p className="text-slate-400 text-xs mt-1">Patient medical records will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((rec) => {
        const dateVal = rec.date || rec.createdAt;
        return (
          <div
            key={rec.id}
            className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
              <Activity size={15} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {rec.title || 'Medical Record'}
                </span>
                {rec.type && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
                    {rec.type}
                  </span>
                )}
              </div>
              {rec.description && (
                <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                  {rec.description}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1.5">{formatDate(dateVal)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function DoctorPatientDetail() {
  const { patientId } = useParams({ from: '/doctor/patients/$patientId' });
  const { doctorUser } = useDoctorAuth();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionDoc[]>([]);
  const [records, setRecords] = useState<RecordDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('appointments');

  useEffect(() => {
    if (!doctorUser || !patientId) return;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      const uid = doctorUser.uid;

      try {
        // 1. Patient doc
        const patientSnap = await getDoc(doc(db, 'users', patientId));
        if (patientSnap.exists()) {
          setPatient(patientSnap.data() as PatientData);
        }

        // 2. Appointments
        let apptDocs: AppointmentDoc[] = [];
        try {
          const apptQuery = query(
            collection(db, 'appointments'),
            where('doctorId', '==', uid),
            where('userId', '==', patientId),
            orderBy('date', 'desc'),
          );
          const apptSnap = await getDocs(apptQuery);
          apptDocs = apptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppointmentDoc));
        } catch {
          // Fallback if composite index missing — unordered query
          try {
            const apptFallback = query(
              collection(db, 'appointments'),
              where('doctorId', '==', uid),
              where('userId', '==', patientId),
            );
            const apptSnap = await getDocs(apptFallback);
            apptDocs = apptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppointmentDoc));
          } catch {
            apptDocs = [];
          }
        }
        setAppointments(apptDocs);

        // 3. Prescriptions
        let rxDocs: PrescriptionDoc[] = [];
        try {
          const rxQuery = query(
            collection(db, 'prescriptions'),
            where('doctorId', '==', uid),
            where('userId', '==', patientId),
            orderBy('createdAt', 'desc'),
          );
          const rxSnap = await getDocs(rxQuery);
          rxDocs = rxSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PrescriptionDoc));
        } catch {
          try {
            const rxFallback = query(
              collection(db, 'prescriptions'),
              where('doctorId', '==', uid),
              where('userId', '==', patientId),
            );
            const rxSnap = await getDocs(rxFallback);
            rxDocs = rxSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PrescriptionDoc));
          } catch {
            rxDocs = [];
          }
        }
        setPrescriptions(rxDocs);

        // 4. Medical records
        let recDocs: RecordDoc[] = [];
        try {
          const recQuery = query(
            collection(db, 'records'),
            where('userId', '==', patientId),
          );
          const recSnap = await getDocs(recQuery);
          recDocs = recSnap.docs.map((d) => ({ id: d.id, ...d.data() } as RecordDoc));
        } catch {
          recDocs = [];
        }
        setRecords(recDocs);
      } catch (err: any) {
        setError('Failed to load patient details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [doctorUser, patientId]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Back button skeleton */}
        <div className="h-8 w-36 bg-slate-200 rounded-xl animate-pulse" />
        <SkeletonDetail />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate({ to: '/doctor/patients' })}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Patients
        </button>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Back button ── */}
      <button
        onClick={() => navigate({ to: '/doctor/patients' })}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600 transition-colors group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
        Back to Patients
      </button>

      {/* ── Patient header card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Large avatar */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shrink-0 select-none shadow-md shadow-emerald-600/20">
            {getInitials(patient?.name)}
          </div>

          {/* Patient info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-800">
              {patient?.name || 'Unknown Patient'}
            </h2>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
              {patient?.email && (
                <div className="flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-600">{patient.email}</span>
                </div>
              )}
              {patient?.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={13} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-600">{patient.phone}</span>
                </div>
              )}
              {patient?.createdAt && (
                <div className="flex items-center gap-1.5">
                  <User size={13} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-500">
                    Joined {formatDate(patient.createdAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex sm:flex-col gap-3 shrink-0">
            <div className="text-center px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
              <p className="text-lg font-bold text-emerald-700">{appointments.length}</p>
              <p className="text-xs text-emerald-600 font-medium">Visits</p>
            </div>
            <div className="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-lg font-bold text-slate-700">{prescriptions.length}</p>
              <p className="text-xs text-slate-500 font-medium">Rx</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="px-5 pt-4 pb-0 flex items-center gap-2 flex-wrap border-b border-slate-100">
          <TabButton
            active={activeTab === 'appointments'}
            onClick={() => setActiveTab('appointments')}
            icon={<Calendar size={14} />}
            label="Appointments"
            count={appointments.length}
          />
          <TabButton
            active={activeTab === 'prescriptions'}
            onClick={() => setActiveTab('prescriptions')}
            icon={<Pill size={14} />}
            label="Prescriptions"
            count={prescriptions.length}
          />
          <TabButton
            active={activeTab === 'records'}
            onClick={() => setActiveTab('records')}
            icon={<Activity size={14} />}
            label="Medical Records"
            count={records.length}
          />
        </div>

        {/* Tab content */}
        <div className="p-5">
          {activeTab === 'appointments' && (
            <AppointmentsTab appointments={appointments} />
          )}
          {activeTab === 'prescriptions' && (
            <PrescriptionsTab prescriptions={prescriptions} />
          )}
          {activeTab === 'records' && (
            <MedicalRecordsTab records={records} />
          )}
        </div>
      </div>
    </div>
  );
}
