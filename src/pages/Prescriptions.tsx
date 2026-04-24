import React, { useState, useEffect } from 'react';
import {
  Pill, Calendar, X, CalendarDays, Stethoscope,
  ChevronDown, ChevronUp, Search, StickyNote,
  AlertTriangle, CheckCircle2, Clock, FileText, Plus
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';

// ── Utility ───────────────────────────────────────────────────────────────────
function safeDate(val: any, fmt = 'MMM dd, yyyy'): string {
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return isValid(d) ? format(d, fmt) : '—';
  } catch { return '—'; }
}

// ── Auto-expire logic ─────────────────────────────────────────────────────────
/** Parse "7 days" / "2 weeks" / "1 month" → total days */
function parseDurationDays(duration: string): number {
  if (!duration) return 0;
  const lower = duration.toLowerCase().trim();
  const num = parseFloat(lower.replace(/[^0-9.]/g, '')) || 0;
  if (lower.includes('month')) return Math.round(num * 30);
  if (lower.includes('week'))  return Math.round(num * 7);
  return Math.round(num);
}

/** Longest medicine duration in days across a prescription */
function maxDurationDays(medicines: any[]): number {
  if (!medicines?.length) return 0;
  return Math.max(0, ...medicines.map((m: any) => parseDurationDays(m.duration || '')));
}

/** Compute effective status — auto-expires by duration, respects manual 'completed' */
function getEffectiveStatus(rx: any): string {
  if (rx.status === 'completed') return 'completed';
  const days = maxDurationDays(rx.medicines || []);
  if (days > 0 && rx.createdAt) {
    try {
      const created: Date = rx.createdAt.toDate ? rx.createdAt.toDate() : new Date(rx.createdAt);
      if (new Date() > new Date(created.getTime() + days * 86400000)) return 'expired';
    } catch { /**/ }
  }
  return rx.status || 'active';
}

/** Returns the computed expiry Date, or null if duration unknown */
function getExpiryDate(rx: any): Date | null {
  const days = maxDurationDays(rx.medicines || []);
  if (!days || !rx.createdAt) return null;
  try {
    const created: Date = rx.createdAt.toDate ? rx.createdAt.toDate() : new Date(rx.createdAt);
    return new Date(created.getTime() + days * 86400000);
  } catch { return null; }
}

// ── Status config (using app's existing colour palette) ───────────────────────
const STATUS_STYLE: Record<string, { label: string; badge: string; dot: string; pulse: boolean }> = {
  active:    { label: 'Active',    badge: 'bg-primary/10 text-primary border-primary/20',               dot: 'bg-primary',     pulse: true  },
  completed: { label: 'Completed', badge: 'bg-green-500/10 text-green-600 border-green-500/20',          dot: 'bg-green-500',   pulse: false },
  expired:   { label: 'Expired',   badge: 'bg-destructive/10 text-destructive border-destructive/20',    dot: 'bg-destructive', pulse: false },
};
const getStyle = (s: string) => STATUS_STYLE[s] ?? STATUS_STYLE.active;

// ── Expired Modal (light theme) ───────────────────────────────────────────────
function ExpiredModal({ rx, onClose }: { rx: any; onClose: () => void }) {
  const meds: any[] = rx.medicines || (rx.medication ? [{ name: rx.medication }] : []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative max-w-sm w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Red top accent */}
        <div className="h-1 bg-gradient-to-r from-destructive/60 via-destructive to-destructive/60" />

        <div className="p-6 text-center">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <X size={15} />
          </button>

          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4 relative">
            <Pill size={24} className="text-destructive/40 absolute" />
            <div className="w-8 h-0.5 bg-destructive rotate-45 rounded-full absolute" />
          </div>

          <h2 className="text-xl font-black text-foreground mb-1">Prescription Expired</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-destructive mb-4">Access Restricted</p>

          <p className="text-muted-foreground text-sm leading-relaxed mb-3">
            The prescription issued by{' '}
            <span className="text-foreground font-semibold">Dr. {rx.doctorName || 'your doctor'}</span>{' '}
            on{' '}
            <span className="text-foreground font-semibold">{safeDate(rx.createdAt)}</span>{' '}
            has been <span className="text-destructive font-semibold">marked as expired</span>.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed mb-5">
            Your wellbeing matters to us 💙 — this may mean your treatment is complete or your prescription needs renewal. Book a fresh consultation with your doctor.
          </p>

          {/* Info rows */}
          <div className="bg-muted/40 border border-border rounded-xl p-3.5 mb-5 text-left space-y-2">
            {[
              { icon: <Stethoscope size={11} />, label: 'Doctor',     val: `Dr. ${rx.doctorName || '—'}` },
              { icon: <Calendar size={11} />,    label: 'Prescribed', val: safeDate(rx.createdAt) },
              { icon: <Pill size={11} />,        label: 'Medicines',  val: meds.map((m: any) => m.name).filter(Boolean).join(', ') || '—' },
            ].map(({ icon, label, val }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
                <span className="text-foreground font-semibold text-right max-w-[55%] truncate">{val}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { onClose(); window.location.href = '/appointments'; }}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 mb-2"
          >
            <CalendarDays size={14} /> Book a New Appointment
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors rounded-xl hover:bg-muted"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Prescription Card ─────────────────────────────────────────────────────────
function PrescriptionCard({ rx, index }: { rx: any; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const status = getEffectiveStatus(rx);
  const st = getStyle(status);
  const isExpired = status === 'expired';
  const meds: any[] = rx.medicines || (rx.medication ? [{ name: rx.medication, dosage: rx.dosage, frequency: rx.frequency, duration: '' }] : []);
  const expiryDate = getExpiryDate(rx);

  return (
    <>
      {showExpired && <ExpiredModal rx={rx} onClose={() => setShowExpired(false)} />}

      <div className={`bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md ${isExpired ? 'opacity-70' : ''}`}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-border/60">
          <div className="flex items-center gap-3 min-w-0">
            {/* Rx number */}
            <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center">
              <span className="text-[8px] font-black text-primary/60 uppercase leading-none">Rx</span>
              <span className="text-sm font-black text-primary leading-none">{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">Dr. {rx.doctorName || '—'}</p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <Calendar size={10} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Issued {safeDate(rx.createdAt)}</span>
                </div>
                {expiryDate && (
                  <div className="flex items-center gap-1">
                    <Clock size={10} className={isExpired ? 'text-destructive shrink-0' : 'text-muted-foreground shrink-0'} />
                    <span className={`text-xs font-medium ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {isExpired ? 'Expired' : 'Expires'} {safeDate(expiryDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <span className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${st.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${st.pulse ? 'animate-pulse' : ''}`} />
            {st.label}
          </span>
        </div>

        {/* Medicines */}
        <div className="px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            {meds.length} Medicine{meds.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {meds.slice(0, 4).map((m: any, i: number) => (
              <span
                key={i}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  isExpired
                    ? 'bg-muted text-muted-foreground border-border'
                    : 'bg-primary/5 text-primary border-primary/15'
                }`}
              >
                {m.name || '—'}{m.dosage ? ` · ${m.dosage}` : ''}
              </span>
            ))}
            {meds.length > 4 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted text-muted-foreground border border-border">
                +{meds.length - 4} more
              </span>
            )}
          </div>
          {rx.notes && !expanded && !isExpired && (
            <p className="text-xs text-muted-foreground italic mt-2 truncate">📋 "{rx.notes}"</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex justify-end">
          <button
            onClick={() => isExpired ? setShowExpired(true) : setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
          >
            {isExpired
              ? <><AlertTriangle size={11} className="text-destructive" /> Why expired?</>
              : expanded
              ? <><ChevronUp size={11} /> Hide</>
              : <><ChevronDown size={11} /> Full Details</>}
          </button>
        </div>

        {/* Expanded — full table + notes */}
        {expanded && !isExpired && (
          <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/20">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Prescription Details</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      {['Medicine', 'Dosage', 'Frequency', 'Duration'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-muted-foreground font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {meds.map((m: any, i: number) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="px-3 py-2 font-semibold text-foreground">{m.name || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{m.dosage || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{m.frequency || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{m.duration || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {rx.notes && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <StickyNote size={10} /> Doctor's Notes
                </p>
                <div className="bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-3">
                  <p className="text-sm text-amber-800/80 leading-relaxed italic">"{rx.notes}"</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function Prescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'expired'>('all');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'prescriptions'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setPrescriptions(docs);
      setLoading(false);
    }, err => {
      console.error('Prescriptions error:', err);
      toast.error('Could not load prescriptions.');
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const getMedName = (p: any) => p.medicines?.[0]?.name || p.medication || '';
  const filtered = prescriptions.filter(p => {
    const matchFilter = filter === 'all' || (p.status || 'active') === filter;
    const matchSearch = !search
      || getMedName(p).toLowerCase().includes(search.toLowerCase())
      || p.doctorName?.toLowerCase().includes(search.toLowerCase())
      || (p.medicines as any[])?.some((m: any) => m.name?.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const counts = {
    all:       prescriptions.length,
    active:    prescriptions.filter(p => (p.status || 'active') === 'active').length,
    completed: prescriptions.filter(p => p.status === 'completed').length,
    expired:   prescriptions.filter(p => p.status === 'expired').length,
  };

  const filterTabs = [
    { key: 'all',       label: 'All',       count: counts.all,       icon: <FileText size={13} /> },
    { key: 'active',    label: 'Active',    count: counts.active,    icon: <CheckCircle2 size={13} /> },
    { key: 'completed', label: 'Completed', count: counts.completed, icon: <Clock size={13} /> },
    { key: 'expired',   label: 'Expired',   count: counts.expired,   icon: <AlertTriangle size={13} /> },
  ] as const;

  return (
    <div className="space-y-7 animate-in fade-in duration-500">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Prescriptions</h1>
          <p className="text-muted-foreground font-medium mt-1">Your complete prescription history from all doctors.</p>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
          {filterTabs.map(({ key, label, count, icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {icon}
              {label}
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${filter === key ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search medicines or doctor..."
            className="pl-8 pr-4 h-8 bg-background border border-border text-foreground placeholder:text-muted-foreground rounded-xl text-xs focus:outline-none focus:border-primary/40 w-56"
          />
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((rx, i) => <PrescriptionCard key={rx.id} rx={rx} index={i} />)}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Pill size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-bold text-base mb-1">No Prescriptions Found</h3>
          <p className="text-muted-foreground text-sm">
            {search ? `No results for "${search}"` : 'Your prescription records will appear here once your doctor issues one.'}
          </p>
        </div>
      )}
    </div>
  );
}
