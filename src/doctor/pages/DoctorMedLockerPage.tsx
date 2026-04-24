import React, { useEffect, useRef, useState } from 'react';
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { toast } from 'react-hot-toast';
import {
  Upload, ShieldAlert, Lock, FileText, Eye, Trash2, Search,
  ChevronDown, X, CheckCircle2, Users, Shield,
} from 'lucide-react';
import { format } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────
type MedCat = 'general' | 'genetic' | 'mental_health' | 'sexual_health' | 'hiv' | 'pregnancy';
const MCAT: Record<MedCat, { label: string; color: string; emoji: string }> = {
  general:      { label: 'General',       color: 'bg-blue-100 text-blue-700',    emoji: '📋' },
  genetic:      { label: 'Genetic',       color: 'bg-purple-100 text-purple-700', emoji: '🧬' },
  mental_health:{ label: 'Mental Health', color: 'bg-teal-100 text-teal-700',    emoji: '🧠' },
  sexual_health:{ label: 'Sexual Health', color: 'bg-pink-100 text-pink-700',    emoji: '🩺' },
  hiv:          { label: 'HIV',           color: 'bg-red-100 text-red-700',      emoji: '🔴' },
  pregnancy:    { label: 'Pregnancy',     color: 'bg-green-100 text-green-700',  emoji: '🤰' },
};
interface MLPatient { id: string; name: string; }
interface MLReport {
  id: string; userId: string; fileUrl: string; fileName: string;
  category: MedCat; isRestricted: boolean; isDeleted: boolean;
  createdAt: any; accessControl: Record<string, boolean>;
  uploadedByDoctorId?: string; uploadedByDoctor?: string; fileSize?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Modal
// ─────────────────────────────────────────────────────────────────────────────
function UploadModal({ patients, doctorId, doctorName, onClose }: {
  patients: MLPatient[]; doctorId: string; doctorName: string; onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [patient, setPatient] = useState<MLPatient | null>(patients[0] ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [cat, setCat] = useState<MedCat>('general');
  const [restricted, setRestricted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function upload() {
    if (!patient) { toast.error('Select a patient first'); return; }
    if (!file) { toast.error('Select a file'); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error('File must be under 20 MB'); return; }
    setUploading(true);
    try {
      const fileId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const path = `medlocker/${patient.id}/${fileId}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file, {
        contentType: file.type,
        customMetadata: { uploadedBy: doctorId },
      });
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          s => setProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
          reject,
          () => resolve(),
        );
      });
      const url = await getDownloadURL(task.snapshot.ref);
      await addDoc(collection(db, 'medlocker'), {
        userId: patient.id,
        fileUrl: url,
        fileName: file.name,
        fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        storagePath: path,
        category: cat,
        isRestricted: restricted,
        createdAt: serverTimestamp(),
        isDeleted: false,
        // Doctor auto-gets access; patient controls others
        accessControl: { [doctorId]: true },
        uploadedByDoctorId: doctorId,
        uploadedByDoctor: doctorName,
      });
      toast.success(`Report uploaded for ${patient.name}`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Upload size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-black text-slate-800 text-sm">Upload Medical Report</p>
              <p className="text-xs text-slate-400">Stored in patient's secure MedLocker</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Patient dropdown */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Select Patient</p>
            <div className="relative">
              <select
                value={patient?.id ?? ''}
                onChange={e => setPatient(patients.find(p => p.id === e.target.value) ?? null)}
                disabled={uploading}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:border-emerald-400 appearance-none pr-8 disabled:opacity-60"
              >
                <option value="">— Choose patient —</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* File drop zone */}
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all group ${
              file ? 'border-emerald-400/50 bg-emerald-50/50' : 'border-slate-200 hover:border-emerald-400/50 hover:bg-slate-50'
            } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
          >
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="flex items-center gap-2 justify-center">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate max-w-[240px]">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                {!uploading && (
                  <button onClick={e => { e.stopPropagation(); setFile(null); }} className="ml-auto text-slate-400 hover:text-red-500 transition-colors">
                    <X size={13} />
                  </button>
                )}
              </div>
            ) : (
              <>
                <Upload size={20} className="text-slate-300 group-hover:text-emerald-500 mx-auto mb-2 transition-colors" />
                <p className="text-sm text-slate-400 font-medium">Click to select file (PDF, image, doc — max 20 MB)</p>
              </>
            )}
          </div>

          {/* Progress */}
          {uploading && (
            <div className="space-y-1">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-400 text-right">{progress}%</p>
            </div>
          )}

          {/* Category */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Category</p>
            <div className="relative">
              <select
                value={cat}
                onChange={e => setCat(e.target.value as MedCat)}
                disabled={uploading}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:border-emerald-400 disabled:opacity-60"
              >
                {(Object.entries(MCAT) as [MedCat, typeof MCAT[MedCat]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sensitivity */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Sensitivity</p>
            <div className="grid grid-cols-2 gap-2">
              {([false, true] as const).map(val => (
                <button
                  key={String(val)}
                  onClick={() => setRestricted(val)}
                  disabled={uploading}
                  className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all ${
                    restricted === val
                      ? val ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  } disabled:opacity-60`}
                >
                  {val ? <Lock size={13} /> : <Shield size={13} />}
                  {val ? 'Restricted' : 'Normal'}
                </button>
              ))}
            </div>
            {restricted && <p className="text-xs text-amber-600 mt-1.5">⚠️ Patient must verify identity to view this file.</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={uploading} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
              Cancel
            </button>
            <button onClick={upload} disabled={uploading || !file || !patient}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
              {uploading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Uploading…</>
                : <><Upload size={13} />Upload Report</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DoctorMedLockerPage — main export
// ─────────────────────────────────────────────────────────────────────────────
export function DoctorMedLockerPage() {
  const { doctorUser, doctorData } = useDoctorAuth();
  const [patients, setPatients] = useState<MLPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<MLPatient | null>(null);
  const [reports, setReports] = useState<MLReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');

  const doctorId = doctorUser?.uid ?? '';
  const doctorName = doctorData?.name ?? 'Doctor';

  /* Fetch patients from appointments */
  useEffect(() => {
    if (!doctorId) return;
    getDocs(query(collection(db, 'appointments'), where('doctorId', '==', doctorId))).then(snap => {
      const seen = new Set<string>();
      const list: MLPatient[] = [];
      snap.docs.forEach(d => {
        const { userId, patientName } = d.data();
        if (userId && !seen.has(userId)) { seen.add(userId); list.push({ id: userId, name: patientName || 'Patient' }); }
      });
      setPatients(list);
    });
  }, [doctorId]);

  /* Real-time reports for selected patient */
  useEffect(() => {
    if (!selectedPatient || !doctorId) { setReports([]); return; }
    setLoading(true);
    const q = query(
      collection(db, 'medlocker'),
      where('userId', '==', selectedPatient.id),
      where('isDeleted', '==', false),
    );
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as MLReport))
        .filter(r => r.accessControl?.[doctorId] === true || r.uploadedByDoctorId === doctorId)
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setReports(all);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [selectedPatient, doctorId]);

  async function softDelete(id: string) {
    if (!confirm('Delete this report?')) return;
    try {
      await updateDoc(doc(db, 'medlocker', id), { isDeleted: true });
      toast.success('Report deleted');
    } catch { toast.error('Delete failed'); }
  }

  const shown = search
    ? reports.filter(r => r.fileName.toLowerCase().includes(search.toLowerCase()))
    : reports;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {showUpload && (
        <UploadModal
          patients={patients}
          doctorId={doctorId}
          doctorName={doctorName}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">🔒 MedLocker</h1>
          <p className="text-sm text-slate-500 mt-0.5">Upload &amp; manage secure medical reports for your patients.</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm shadow-emerald-500/20"
        >
          <Upload size={15} />Upload Report
        </button>
      </div>

      {/* DPDP notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5">
        <ShieldAlert size={15} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          Reports you upload are stored in the patient's MedLocker. You automatically receive access. Governed by{' '}
          <strong>DPDP Act 2023</strong> &amp; ABDM guidelines. Patients control access for other doctors.
        </p>
      </div>

      {/* Patient filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={selectedPatient?.id ?? ''}
            onChange={e => setSelectedPatient(patients.find(p => p.id === e.target.value) ?? null)}
            className="w-full border border-slate-200 rounded-xl pl-8 pr-8 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:border-emerald-400 appearance-none"
          >
            <option value="">— All patients —</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files…"
            className="pl-8 pr-4 h-[42px] w-full bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl text-sm focus:outline-none focus:border-emerald-400"
          />
        </div>
        {selectedPatient && (
          <button onClick={() => setSelectedPatient(null)} className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 shrink-0">
            Clear
          </button>
        )}
      </div>

      {/* Report list */}
      {!selectedPatient ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <Users size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600 mb-1">Select a patient to view their reports</p>
          <p className="text-xs text-slate-400">Or click "Upload Report" to upload for any patient.</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-18 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
      ) : shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
          <Lock size={24} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600 mb-1">No reports found</p>
          <p className="text-xs text-slate-400">
            {search ? `No results for "${search}"` : `No reports accessible for ${selectedPatient.name} yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(r => {
            const cat = MCAT[r.category] ?? MCAT.general;
            const mine = r.uploadedByDoctorId === doctorId;
            return (
              <div key={r.id} className={`bg-white border rounded-2xl p-4 flex items-start gap-3 hover:shadow-md transition-all ${
                r.isRestricted ? 'border-amber-200' : 'border-slate-200'
              }`}>
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${r.isRestricted ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                  {r.isRestricted ? <Lock size={17} className="text-amber-600" /> : <FileText size={17} className="text-emerald-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{r.fileName}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cat.color}`}>
                      {cat.emoji} {cat.label}
                    </span>
                    {r.isRestricted && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Restricted</span>}
                    {mine && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Uploaded by you</span>}
                    {r.fileSize && <span className="text-xs text-slate-400">{r.fileSize}</span>}
                    {r.createdAt?.toDate && <span className="text-xs text-slate-400">{format(r.createdAt.toDate(), 'MMM dd, yyyy')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => window.open(r.fileUrl, '_blank')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all" title="View">
                    <Eye size={14} />
                  </button>
                  {mine && (
                    <button onClick={() => softDelete(r.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
