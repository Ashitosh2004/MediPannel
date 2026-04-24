import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Plus,
  X,
  FileText,
  Pill,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
  UserRound,
  StickyNote,
  Pencil,
} from 'lucide-react';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { db } from '../../lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface Prescription {
  id: string;
  patientName: string;
  userId: string;
  medicines: Medicine[];
  notes: string;
  createdAt: any;
  status?: string;
}

interface PatientOption {
  id: string;
  name: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function emptyMedicine(): Medicine {
  return { name: '', dosage: '', frequency: '', duration: '' };
}

function formatDate(ts: any): string {
  if (!ts) return '—';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return format(date, 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Medicine Row
// ─────────────────────────────────────────────────────────────────────────────

interface MedicineRowProps {
  medicine: Medicine;
  index: number;
  onChange: (index: number, field: keyof Medicine, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function MedicineRow({ medicine, index, onChange, onRemove, canRemove }: MedicineRowProps) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-start">
      {(['name', 'dosage', 'frequency', 'duration'] as (keyof Medicine)[]).map((field) => (
        <div key={field}>
          {index === 0 && (
            <label className="block text-xs font-semibold text-slate-500 mb-1 capitalize">
              {field}
            </label>
          )}
          <input
            type="text"
            placeholder={
              field === 'name'
                ? 'e.g. Amoxicillin'
                : field === 'dosage'
                ? 'e.g. 500mg'
                : field === 'frequency'
                ? 'e.g. Twice daily'
                : 'e.g. 7 days'
            }
            value={medicine[field]}
            onChange={(e) => onChange(index, field, e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 placeholder:text-slate-300"
          />
        </div>
      ))}
      <div>
        {index === 0 && <div className="h-5 mb-1" />}
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New Prescription Modal
// ─────────────────────────────────────────────────────────────────────────────

interface NewPrescriptionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  patients: PatientOption[];
  doctorId: string;
  doctorName: string;
}

function NewPrescriptionModal({
  onClose,
  onSuccess,
  patients,
  doctorId,
  doctorName,
}: NewPrescriptionModalProps) {
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([emptyMedicine()]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase())
  );

  function handleMedicineChange(index: number, field: keyof Medicine, value: string) {
    setMedicines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function handleAddMedicine() {
    setMedicines((prev) => [...prev, emptyMedicine()]);
  }

  function handleRemoveMedicine(index: number) {
    setMedicines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    const validMedicines = medicines.filter((m) => m.name.trim());
    if (validMedicines.length === 0) {
      toast.error('Please add at least one medicine');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'prescriptions'), {
        doctorId,
        doctorName,
        userId: selectedPatient.id,
        patientName: selectedPatient.name,
        medicines: validMedicines,
        notes: notes.trim(),
        createdAt: serverTimestamp(),
      });
      toast.success('Prescription created successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Failed to create prescription. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FileText size={16} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">New Prescription</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Step 1: Patient Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold">1</span>
              <h3 className="text-sm font-bold text-slate-700">Select Patient</h3>
            </div>
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Patient
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={selectedPatient ? selectedPatient.name : patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setSelectedPatient(null);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 placeholder:text-slate-400"
                />
                {selectedPatient && (
                  <button
                    type="button"
                    onClick={() => { setSelectedPatient(null); setPatientSearch(''); setShowPatientDropdown(true); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {showPatientDropdown && !selectedPatient && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                  {filteredPatients.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                      <UserRound size={14} />
                      No patients found
                    </div>
                  ) : (
                    filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearch('');
                          setShowPatientDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        {p.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Medicines */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold">2</span>
              <h3 className="text-sm font-bold text-slate-700">Add Medicines</h3>
            </div>
            <div className="space-y-2">
              {medicines.map((medicine, index) => (
                <MedicineRow
                  key={index}
                  medicine={medicine}
                  index={index}
                  onChange={handleMedicineChange}
                  onRemove={handleRemoveMedicine}
                  canRemove={medicines.length > 1}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddMedicine}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <Plus size={15} />
              Add Medicine
            </button>
          </div>

          {/* Step 3: Notes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold">3</span>
              <h3 className="text-sm font-bold text-slate-700">Notes (Optional)</h3>
            </div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Additional notes
            </label>
            <textarea
              rows={3}
              placeholder="Any special instructions or notes for the patient..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 resize-none placeholder:text-slate-300"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedPatient}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><Loader2 size={15} className="animate-spin" />Creating...</>
            ) : (
              <><FileText size={15} />Create Prescription</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Prescription Modal
// ─────────────────────────────────────────────────────────────────────────────

interface EditPrescriptionModalProps {
  prescription: Prescription;
  onClose: () => void;
  onSuccess: () => void;
}

function EditPrescriptionModal({ prescription, onClose, onSuccess }: EditPrescriptionModalProps) {
  const [medicines, setMedicines] = useState<Medicine[]>(
    prescription.medicines?.length ? prescription.medicines.map(m => ({ ...m })) : [emptyMedicine()]
  );
  const [notes, setNotes] = useState(prescription.notes || '');
  const [submitting, setSubmitting] = useState(false);

  function handleMedicineChange(index: number, field: keyof Medicine, value: string) {
    setMedicines(prev => { const u = [...prev]; u[index] = { ...u[index], [field]: value }; return u; });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const validMedicines = medicines.filter(m => m.name.trim());
    if (!validMedicines.length) { toast.error('Add at least one medicine'); return; }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'prescriptions', prescription.id), {
        medicines: validMedicines,
        notes: notes.trim(),
      });
      toast.success('Prescription updated!');
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Edit Prescription</h2>
              <p className="text-xs text-slate-400">{prescription.patientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Medicines */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
              <h3 className="text-sm font-bold text-slate-700">Medicines</h3>
            </div>
            <div className="space-y-2">
              {medicines.map((medicine, index) => (
                <MedicineRow
                  key={index}
                  medicine={medicine}
                  index={index}
                  onChange={handleMedicineChange}
                  onRemove={i => setMedicines(prev => prev.filter((_, idx) => idx !== i))}
                  canRemove={medicines.length > 1}
                />
              ))}
            </div>
            <button type="button" onClick={() => setMedicines(prev => [...prev, emptyMedicine()])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              <Plus size={15} /> Add Medicine
            </button>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">2</span>
              <h3 className="text-sm font-bold text-slate-700">Notes (Optional)</h3>
            </div>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Special instructions for the patient..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none placeholder:text-slate-300"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors inline-flex items-center gap-2 disabled:opacity-60">
            {submitting ? <><Loader2 size={15} className="animate-spin" />Saving...</> : <><FileText size={15} />Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prescription Card
// ─────────────────────────────────────────────────────────────────────────────

interface PrescriptionCardProps {
  prescription: Prescription;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (prescription: Prescription) => void;
}

function PrescriptionCard({ prescription, onStatusChange, onEdit }: PrescriptionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center shrink-0">
            {prescription.patientName?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{prescription.patientName}</p>
            <p className="text-xs text-slate-400">{formatDate(prescription.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(prescription)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-blue-50"
            title="Edit prescription"
          >
            <Pencil size={13} />
            Edit
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-emerald-50"
          >
            {expanded ? (
              <><ChevronUp size={14} /> Hide</>
            ) : (
              <><ChevronDown size={14} /> Details</>
            )}
          </button>
        </div>
      </div>

      {/* Status controls */}
      <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Status:</span>
        {(['active', 'completed', 'expired'] as const).map(s => {
          const active = (prescription.status || 'active') === s;
          const colors: Record<string, string> = {
            active:    active ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-600',
            completed: active ? 'bg-blue-500 text-white border-blue-600'      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600',
            expired:   active ? 'bg-red-500 text-white border-red-600'        : 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-500',
          };
          return (
            <button
              key={s}
              onClick={() => !active && onStatusChange(prescription.id, s)}
              disabled={active}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${colors[s]} ${active ? 'cursor-default' : 'cursor-pointer active:scale-95'}`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Medicines Pills */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Pill size={13} className="text-emerald-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Medicines</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {prescription.medicines.map((med, i) => (
            <span
              key={i}
              className="bg-emerald-50 text-emerald-700 rounded-full px-3 py-1 text-xs font-semibold"
            >
              {med.name}
              {med.dosage ? ` · ${med.dosage}` : ''}
            </span>
          ))}
        </div>

        {/* Notes preview */}
        {prescription.notes && !expanded && (
          <p className="mt-3 text-xs text-slate-500 line-clamp-1 italic">
            "{prescription.notes}"
          </p>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
          {/* Full medicines table */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">Prescription Details</p>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold">Medicine</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold">Dosage</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold">Frequency</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {prescription.medicines.map((med, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-700">{med.name || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{med.dosage || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{med.frequency || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{med.duration || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {prescription.notes && (
            <div>
              <p className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <StickyNote size={12} className="text-slate-400" />
                Notes
              </p>
              <p className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 leading-relaxed">
                {prescription.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DoctorPrescriptions — Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function DoctorPrescriptions() {
  const { doctorUser, doctorData, loading: authLoading } = useDoctorAuth();
  const uid = doctorUser?.uid ?? '';
  const originalDocId = doctorData?.originalDocId;

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState<Prescription | null>(null);
  const [search, setSearch] = useState('');

  // ── Fetch prescriptions ───────────────────────────────────────
  async function fetchPrescriptions() {
    if (!uid) return;
    try {
      const q = query(
        collection(db, 'prescriptions'),
        where('doctorId', '==', uid),
      );
      const snap = await getDocs(q);
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Prescription, 'id'>) }))
        .sort((a, b) => {
          const aMs = (a.createdAt?.toMillis?.() ?? 0);
          const bMs = (b.createdAt?.toMillis?.() ?? 0);
          return bMs - aMs;
        });
      setPrescriptions(sorted);
    } catch {
      toast.error('Failed to load prescriptions');
    }
  }

  async function handleStatusChange(prescId: string, newStatus: string) {
    try {
      await updateDoc(doc(db, 'prescriptions', prescId), { status: newStatus });
      setPrescriptions(prev => prev.map(p => p.id === prescId ? { ...p, status: newStatus } : p));
      toast.success(`Prescription marked as ${newStatus}`);
    } catch {
      toast.error('Failed to update status.');
    }
  }

  // ── Fetch patients (via appointments → unique userIds → user docs) ─────────
  async function fetchPatients() {
    if (!uid) return;
    try {
      // Query using ALL known doctor IDs to catch appointments stored with docId or authUID
      const doctorIds = [uid];
      if (originalDocId && originalDocId !== uid) doctorIds.push(originalDocId);

      const apptQuery = query(
        collection(db, 'appointments'),
        where('doctorId', 'in', doctorIds)
      );
      const apptSnap = await getDocs(apptQuery);

      const userIdSet = new Set<string>();
      apptSnap.docs.forEach((d) => {
        const userId = d.data().userId;
        if (userId) userIdSet.add(userId);
      });

      const patientList: PatientOption[] = [];
      await Promise.all(
        Array.from(userIdSet).map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const data = userDoc.data();
              patientList.push({
                id: userId,
                name: data.name ?? data.displayName ?? 'Unknown Patient',
              });
            }
          } catch {
            // skip unavailable user docs
          }
        })
      );

      patientList.sort((a, b) => a.name.localeCompare(b.name));
      setPatients(patientList);
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    if (!uid || authLoading) return;
    async function init() {
      setLoading(true);
      await Promise.all([fetchPrescriptions(), fetchPatients()]);
      setLoading(false);
    }
    init();
  }, [uid, originalDocId, authLoading]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Prescriptions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} issued
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors inline-flex items-center gap-2"
        >
          <Plus size={16} />
          New Prescription
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by patient name or medicine..."
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-28 bg-slate-100 rounded animate-pulse" />
                  <div className="h-2.5 w-20 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-24 bg-slate-100 rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-emerald-500" />
          </div>
          <h3 className="text-base font-bold text-slate-700 mb-1">No prescriptions yet</h3>
          <p className="text-sm text-slate-400 mb-5">
            Create your first prescription for a patient.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors inline-flex items-center gap-2 mx-auto"
          >
            <Plus size={15} />
            New Prescription
          </button>
        </div>
      ) : (() => {
        const filtered = prescriptions.filter(rx => {
          if (!search) return true;
          const q = search.toLowerCase();
          return (
            rx.patientName?.toLowerCase().includes(q) ||
            rx.medicines?.some(m => m.name?.toLowerCase().includes(q))
          );
        });
        return filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-slate-400 text-sm">No results for <span className="font-semibold text-slate-600">"{search}"</span></p>
            <button onClick={() => setSearch('')} className="mt-3 text-emerald-600 text-xs font-semibold hover:underline">Clear search</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((rx) => (
              <PrescriptionCard
                key={rx.id}
                prescription={rx}
                onStatusChange={handleStatusChange}
                onEdit={setEditingPrescription}
              />
            ))}
          </div>
        );
      })()}

      {/* New Prescription Modal */}
      {showModal && (
        <NewPrescriptionModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchPrescriptions}
          patients={patients}
          doctorId={uid}
          doctorName={doctorData?.name ?? ''}
        />
      )}

      {/* Edit Prescription Modal */}
      {editingPrescription && (
        <EditPrescriptionModal
          prescription={editingPrescription}
          onClose={() => setEditingPrescription(null)}
          onSuccess={fetchPrescriptions}
        />
      )}
    </div>
  );
}
