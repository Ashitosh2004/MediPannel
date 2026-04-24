import React, { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot, getDocs, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  ShieldAlert, Lock, FileText, Eye,
  UserCheck, UserX, Search, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { WarningModal } from '../features/medlocker/WarningModal';
import { PasswordPromptModal } from '../features/medlocker/PasswordPromptModal';
import { CATEGORY_META, type MedReport, type LinkedDoctor } from '../features/medlocker/types';

// ─────────────────────────────────────────────────────────────────────────────
// AccessRow: per-doctor toggle inline
// ─────────────────────────────────────────────────────────────────────────────
function AccessRow({ reportId, doctor, granted, onToggle }: {
  reportId: string; doctor: LinkedDoctor; granted: boolean; onToggle: () => void;
}) {
  const [saving, setSaving] = useState(false);
  async function toggle() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'medlocker', reportId), {
        [`accessControl.${doctor.id}`]: !granted,
      });
      toast.success(granted ? `Access revoked from Dr. ${doctor.name}` : `Access granted to Dr. ${doctor.name}`);
      onToggle();
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  }
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">
          {doctor.name[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">Dr. {doctor.name}</p>
          {doctor.specialty && <p className="text-[10px] text-muted-foreground">{doctor.specialty}</p>}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 disabled:opacity-60 ${
          granted
            ? 'bg-green-500/10 text-green-700 border-green-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300'
        }`}
      >
        {saving ? <RefreshCw size={10} className="animate-spin" /> : granted ? <UserCheck size={11} /> : <UserX size={11} />}
        {saving ? '…' : granted ? 'Allowed' : 'Denied'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReportCard
// ─────────────────────────────────────────────────────────────────────────────
function ReportCard({ report, doctors }: { report: MedReport; doctors: LinkedDoctor[] }) {
  const [showWarn, setShowWarn] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [access, setAccess] = useState<Record<string, boolean>>(report.accessControl ?? {});

  const cat = CATEGORY_META[report.category] ?? CATEGORY_META.general;
  const grantedCount = Object.values(access).filter(Boolean).length;

  function openFile() {
    if (report.isRestricted) { setShowWarn(true); return; }
    window.open(report.fileUrl, '_blank');
  }

  return (
    <>
      {showWarn && <WarningModal onClose={() => setShowWarn(false)} onConfirm={() => { setShowWarn(false); setShowPw(true); }} />}
      {showPw && <PasswordPromptModal onClose={() => setShowPw(false)} onVerified={() => window.open(report.fileUrl, '_blank')} />}

      <div className={`bg-card border rounded-2xl overflow-hidden transition-all hover:shadow-md ${
        report.isRestricted ? 'border-destructive/20' : 'border-border'
      }`}>
        <div className="flex items-start gap-3 p-4">
          {/* Icon */}
          <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            report.isRestricted ? 'bg-destructive/10' : 'bg-primary/10'
          }`}>
            {report.isRestricted
              ? <Lock size={18} className="text-destructive" />
              : <FileText size={18} className="text-primary" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-foreground text-sm truncate max-w-[180px]">{report.fileName}</p>
              {report.isRestricted && (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-destructive/10 text-destructive shrink-0">
                  <ShieldAlert size={9} />Sensitive
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cat.color}`}>
                {cat.emoji} {cat.label}
              </span>
              {report.createdAt?.toDate && (
                <span className="text-xs text-muted-foreground">{format(report.createdAt.toDate(), 'MMM dd, yyyy')}</span>
              )}
              {report.uploadedByDoctor && (
                <span className="text-xs text-muted-foreground">by Dr. {report.uploadedByDoctor}</span>
              )}
            </div>

            {/* Access toggle trigger */}
            <button
              onClick={() => setShowAccess(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-1.5 transition-colors"
            >
              <UserCheck size={11} />
              {grantedCount} doctor{grantedCount !== 1 ? 's' : ''} can view
              {showAccess ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>

          {/* View button */}
          <button
            onClick={openFile}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0"
            title={report.isRestricted ? 'View (password required)' : 'View file'}
          >
            <Eye size={15} />
          </button>
        </div>

        {/* Expandable access control */}
        {showAccess && (
          <div className="border-t border-border px-4 pb-4 pt-3 bg-muted/20">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2.5">
              🔐 Who can see this file?
            </p>
            {doctors.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No doctors linked from your appointments.</p>
            ) : (
              <div className="space-y-1.5">
                {doctors.map(d => (
                  <AccessRow
                    key={d.id}
                    reportId={report.id}
                    doctor={d}
                    granted={access[d.id] === true}
                    onToggle={() => setAccess(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PatientMedLockerPage — main export
// ─────────────────────────────────────────────────────────────────────────────
export function PatientMedLockerPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<MedReport[]>([]);
  const [doctors, setDoctors] = useState<LinkedDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<'normal' | 'restricted'>('normal');

  /* Real-time reports */
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'medlocker'),
      where('userId', '==', user.uid),
      where('isDeleted', '==', false),
    );
    const unsub = onSnapshot(q, snap => {
      setReports(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as MedReport))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)),
      );
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  /* Linked doctors from appointments */
  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, 'appointments'), where('userId', '==', user.uid))).then(snap => {
      const seen = new Set<string>();
      const list: LinkedDoctor[] = [];
      snap.docs.forEach(d => {
        const { doctorId, doctorName, specialty } = d.data();
        if (doctorId && !seen.has(doctorId)) {
          seen.add(doctorId);
          list.push({ id: doctorId, name: doctorName ?? 'Doctor', specialty });
        }
      });
      setDoctors(list);
    });
  }, [user]);

  const normal = reports.filter(r => !r.isRestricted);
  const restricted = reports.filter(r => r.isRestricted);
  const pool = section === 'normal' ? normal : restricted;
  const shown = search
    ? pool.filter(r => r.fileName.toLowerCase().includes(search.toLowerCase()) || r.category.includes(search.toLowerCase()))
    : pool;

  const totalAllowed = new Set(
    reports.flatMap(r => Object.entries(r.accessControl ?? {}).filter(([, v]) => v).map(([k]) => k)),
  ).size;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
          🔒 MedLocker
        </h1>
        <p className="text-muted-foreground font-medium mt-1">
          Your secure medical record vault — you control who can access your files.
        </p>
      </div>

      {/* DPDP notice */}
      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert size={17} className="text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground">Your data, your control. </span>
          Reports uploaded by your doctor are stored here securely. Protected under the{' '}
          <span className="font-semibold text-foreground">DPDP Act 2023</span>, IT Act 2000 &amp; ABDM guidelines.
          Toggle each doctor's access using the controls on every report card.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', val: reports.length, color: 'text-foreground', bg: 'bg-card' },
          { label: 'Normal', val: normal.length, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Restricted', val: restricted.length, color: 'text-destructive', bg: 'bg-destructive/5' },
          { label: 'Doctors Allowed', val: totalAllowed, color: 'text-green-600', bg: 'bg-green-500/5' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-border rounded-2xl p-5`}>
            <div className={`text-3xl font-black ${s.color}`}>{s.val}</div>
            <div className="text-xs font-semibold text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Section tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl w-fit">
          {([
            ['normal', '📄 Normal', normal.length],
            ['restricted', '🔒 Restricted', restricted.length],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                section === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                section === key ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'
              }`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search reports…"
            className="pl-8 pr-4 h-9 w-52 bg-background border border-border text-foreground placeholder:text-muted-foreground rounded-xl text-xs focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
      </div>

      {/* Section heading */}
      <div className="flex items-center gap-2">
        {section === 'restricted' ? <Lock size={15} className="text-destructive" /> : <FileText size={15} className="text-primary" />}
        <h3 className="font-black text-foreground text-sm">
          {section === 'restricted' ? 'Restricted Reports' : 'Normal Reports'}
        </h3>
        {section === 'restricted' && (
          <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
            🔐 Password required to view
          </span>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            {section === 'restricted' ? <Lock size={24} className="text-muted-foreground" /> : <FileText size={24} className="text-muted-foreground" />}
          </div>
          <h3 className="font-bold text-foreground text-sm mb-1">
            No {section === 'restricted' ? 'restricted' : 'normal'} reports yet
          </h3>
          <p className="text-xs text-muted-foreground">
            {search ? `No results for "${search}"` : 'Your doctor will upload reports here after your consultation.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(r => <ReportCard key={r.id} report={r} doctors={doctors} />)}
        </div>
      )}
    </div>
  );
}
