import React, { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot, getDocs,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  ShieldAlert, Search, Upload, RefreshCw, Lock, FileText,
} from 'lucide-react';
import { UploadReportModal } from './UploadReportModal';
import { ReportList } from './ReportList';
import type { MedReport, LinkedDoctor } from './types';

const DPDP_NOTICE =
  'Your data is protected under the Digital Personal Data Protection Act, 2023, IT Act, 2000, ' +
  'and ABDM guidelines. You have full control over who can access your files.';

/**
 * MedLockerTab
 * ─────────────────────────────────────────────────────────────────────────────
 * Main patient-facing MedLocker tab.
 * • Real-time Firestore listener (only userId == currentUser.uid & isDeleted == false)
 * • Fetches linked doctors from past appointments
 * • Search across file names and categories
 * • Section tabs: Normal | Restricted
 * • Upload via UploadReportModal
 */
export function MedLockerTab() {
  const { user } = useAuth();

  const [reports, setReports] = useState<MedReport[]>([]);
  const [doctors, setDoctors] = useState<LinkedDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<'normal' | 'restricted'>('normal');

  /* ── Real-time reports listener ── */
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'medlocker'),
      where('userId', '==', user.uid),
      where('isDeleted', '==', false),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as MedReport))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setReports(docs);
        setLoading(false);
      },
      err => {
        console.error('MedLocker listener error:', err);
        toast.error('Failed to load MedLocker');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  /* ── Fetch linked doctors from appointments ── */
  useEffect(() => {
    if (!user) return;
    getDocs(
      query(collection(db, 'appointments'), where('userId', '==', user.uid)),
    ).then(snap => {
      const seen = new Set<string>();
      const list: LinkedDoctor[] = [];
      snap.docs.forEach(d => {
        const { doctorId, doctorName, specialty } = d.data();
        if (doctorId && !seen.has(doctorId)) {
          seen.add(doctorId);
          list.push({ id: doctorId, name: doctorName ?? 'Unknown', specialty });
        }
      });
      setDoctors(list);
    });
  }, [user]);

  /* ── Filter logic ── */
  const normal = reports.filter(r => !r.isRestricted);
  const restricted = reports.filter(r => r.isRestricted);
  const pool = section === 'normal' ? normal : restricted;
  const shown = search
    ? pool.filter(r =>
        r.fileName.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase()),
      )
    : pool;

  /* ── Stats ── */
  const totalDoctorsWithAccess = new Set(
    reports.flatMap(r =>
      Object.entries(r.accessControl ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k),
    ),
  ).size;

  return (
    <div className="space-y-6">
      {showUpload && <UploadReportModal onClose={() => setShowUpload(false)} />}

      {/* Privacy notice */}
      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert size={16} className="text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground">Your data, your control. </span>
          {DPDP_NOTICE}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Reports', val: reports.length, color: 'text-foreground', bg: 'bg-card' },
          { label: 'Normal', val: normal.length, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Restricted', val: restricted.length, color: 'text-destructive', bg: 'bg-destructive/5' },
          { label: 'Doctors Allowed', val: totalDoctorsWithAccess, color: 'text-green-600', bg: 'bg-green-500/5' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-border rounded-2xl p-4`}>
            <div className={`text-2xl font-black ${s.color}`}>{s.val}</div>
            <div className="text-xs font-semibold text-muted-foreground mt-0.5">{s.label}</div>
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
                section === key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                section === key ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Right side: search + upload */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reports…"
              className="pl-8 pr-4 h-8 w-48 bg-background border border-border text-foreground placeholder:text-muted-foreground rounded-xl text-xs focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 h-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm shadow-primary/20"
          >
            <Upload size={13} />Upload
          </button>
        </div>
      </div>

      {/* Section heading */}
      <div className="flex items-center gap-2">
        {section === 'restricted'
          ? <Lock size={15} className="text-destructive" />
          : <FileText size={15} className="text-primary" />
        }
        <h3 className="font-black text-foreground text-sm">
          {section === 'restricted' ? 'Restricted Reports' : 'Normal Reports'}
        </h3>
        {section === 'restricted' && (
          <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
            Sensitive Data — Password Required
          </span>
        )}
      </div>

      {/* Report list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <ReportList reports={shown} doctors={doctors} section={section} />
      )}
    </div>
  );
}
