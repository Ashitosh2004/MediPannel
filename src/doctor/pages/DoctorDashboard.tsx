import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, getDocs, limit, addDoc, updateDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { CalendarDays, Users, Clock, Calendar, TrendingUp, RefreshCw, Lock, FileText, Eye, Upload, ShieldAlert, X, Search, ChevronDown, Trash2, AlertTriangle } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
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
// DoctorMedLockerTab — inline component
// ─────────────────────────────────────────────────────────────────────────────
type MedCat = 'general'|'genetic'|'mental_health'|'sexual_health'|'hiv'|'pregnancy';
const MCAT: Record<MedCat,{label:string;color:string}> = {
  general:{label:'General',color:'bg-blue-100 text-blue-700'},
  genetic:{label:'Genetic',color:'bg-purple-100 text-purple-700'},
  mental_health:{label:'Mental Health',color:'bg-teal-100 text-teal-700'},
  sexual_health:{label:'Sexual Health',color:'bg-pink-100 text-pink-700'},
  hiv:{label:'HIV',color:'bg-red-100 text-red-700'},
  pregnancy:{label:'Pregnancy',color:'bg-green-100 text-green-700'},
};
interface MLReport {id:string;userId:string;fileUrl:string;fileName:string;category:MedCat;createdAt:any;isRestricted:boolean;isDeleted:boolean;accessList:Record<string,boolean>;uploadedByDoctorId?:string;uploadedByDoctor?:string;}
interface MLPatient {id:string;name:string;}

function UploadReportModal({patients,doctorId,doctorName,onClose}:{patients:MLPatient[];doctorId:string;doctorName:string;onClose:()=>void}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [patient,setPatient]=useState<MLPatient|null>(patients[0]??null);
  const [file,setFile]=useState<File|null>(null);
  const [cat,setCat]=useState<MedCat>('general');
  const [restricted,setRestricted]=useState(false);
  const [prog,setProg]=useState(0);
  const [busy,setBusy]=useState(false);
  async function upload() {
    if (!patient){toast.error('Select a patient');return;}
    if (!file){toast.error('Select a file');return;}
    setBusy(true);
    const r=ref(storage,`medlocker/${patient.id}/${Date.now()}_${file.name}`);
    const task=uploadBytesResumable(r,file);
    task.on('state_changed',s=>setProg(Math.round(s.bytesTransferred/s.totalBytes*100)),
      ()=>{toast.error('Upload failed');setBusy(false);},
      async()=>{
        const url=await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db,'medlocker'),{userId:patient.id,fileUrl:url,fileName:file.name,fileType:restricted?'restricted':'normal',category:cat,isRestricted:restricted,createdAt:serverTimestamp(),isDeleted:false,accessList:{[doctorId]:true},uploadedByDoctorId:doctorId,uploadedByDoctor:doctorName});
        toast.success(`Report uploaded for ${patient.name}`);onClose();
      });
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center"><Upload size={15} className="text-emerald-600"/></div>
            <div>
              <p className="font-black text-slate-800 text-sm">Upload Medical Report</p>
              <p className="text-xs text-slate-400">Stored in patient's secure MedLocker</p>
            </div>
          </div>
          <button onClick={onClose}><X size={15} className="text-slate-400"/></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Patient selector */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Patient</p>
            <div className="relative">
              <select value={patient?.id??''} onChange={e=>setPatient(patients.find(p=>p.id===e.target.value)??null)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:border-emerald-400 appearance-none pr-8">
                <option value="">— Select patient —</option>
                {patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            </div>
          </div>
          {/* File drop zone */}
          <div onClick={()=>fileRef.current?.click()} className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-6 text-center cursor-pointer transition-all group">
            <input ref={fileRef} type="file" className="hidden" onChange={e=>setFile(e.target.files?.[0]??null)}/>
            {file
              ? <div className="flex items-center gap-2 justify-center"><FileText size={16} className="text-emerald-600 shrink-0"/><p className="text-sm font-semibold text-slate-800 truncate max-w-xs">{file.name}</p></div>
              : <><Upload size={22} className="text-slate-300 group-hover:text-emerald-400 mx-auto mb-2 transition-colors"/><p className="text-sm text-slate-400">Click to select a file (PDF, image, document)</p></>
            }
          </div>
          {/* Category */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Category</p>
            <select value={cat} onChange={e=>setCat(e.target.value as MedCat)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:border-emerald-400">
              {(Object.keys(MCAT) as MedCat[]).map(c=><option key={c} value={c}>{MCAT[c].label}</option>)}
            </select>
          </div>
          {/* Sensitivity */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Sensitivity</p>
            <div className="flex gap-2">
              {(['normal','restricted'] as const).map(t=>(
                <button key={t} onClick={()=>setRestricted(t==='restricted')} className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${(t==='restricted')===restricted?(t==='restricted'?'bg-red-50 text-red-600 border-red-200':'bg-emerald-50 text-emerald-700 border-emerald-200'):'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  {t==='restricted'?'🔒 Restricted':'📄 Normal'}
                </button>
              ))}
            </div>
            {restricted&&<p className="text-xs text-amber-600 mt-1.5">⚠️ Patient must verify their password to view this file.</p>}
          </div>
          {/* Progress */}
          {busy&&<div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{width:`${prog}%`}}/></div>}
          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={upload} disabled={busy||!file||!patient} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 transition-all active:scale-95">
              {busy?`Uploading… ${prog}%`:'Upload Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoctorMedLockerTab({doctorId,doctorName}:{doctorId:string;doctorName:string}) {
  const [patients,setPatients]=useState<MLPatient[]>([]);
  const [selected,setSelected]=useState<MLPatient|null>(null);
  const [reports,setReports]=useState<MLReport[]>([]);
  const [loading,setLoading]=useState(false);
  const [showUpload,setShowUpload]=useState(false);
  const [search,setSearch]=useState('');

  useEffect(()=>{
    if (!doctorId) return;
    getDocs(query(collection(db,'appointments'),where('doctorId','==',doctorId))).then(snap=>{
      const seen=new Set<string>(); const list:MLPatient[]=[];
      snap.docs.forEach(d=>{const{userId,patientName}=d.data();if(userId&&!seen.has(userId)){seen.add(userId);list.push({id:userId,name:patientName||'Patient'});}});
      setPatients(list);
    });
  },[doctorId]);

  useEffect(()=>{
    if (!selected||!doctorId){setReports([]);return;}
    setLoading(true);
    const q=query(collection(db,'medlocker'),where('userId','==',selected.id),where('isDeleted','==',false));
    const unsub=onSnapshot(q,snap=>{
      const all=snap.docs.map(d=>({id:d.id,...d.data()} as MLReport))
        .filter(r=>r.accessList?.[doctorId]===true||r.uploadedByDoctorId===doctorId)
        .sort((a,b)=>(b.createdAt?.toMillis?.()??0)-(a.createdAt?.toMillis?.()??0));
      setReports(all); setLoading(false);
    });
    return()=>unsub();
  },[selected,doctorId]);

  async function handleDelete(id:string){
    try{await updateDoc(doc(db,'medlocker',id),{isDeleted:true});toast.success('Deleted');}catch{toast.error('Failed');}
  }

  const shown=search?reports.filter(r=>r.fileName.toLowerCase().includes(search.toLowerCase())):reports;

  return(
    <div className="space-y-5">
      {showUpload&&<UploadReportModal patients={patients} doctorId={doctorId} doctorName={doctorName} onClose={()=>setShowUpload(false)}/>}

      {/* Header row — upload button ALWAYS visible */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Patient MedLocker</h2>
          <p className="text-xs text-slate-400 mt-0.5">Upload &amp; manage secure medical reports for your patients.</p>
        </div>
        <button onClick={()=>setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm shadow-emerald-500/20">
          <Upload size={14}/>Upload Report
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
        <ShieldAlert size={14} className="text-amber-600 shrink-0 mt-0.5"/>
        <p className="text-xs text-amber-800 leading-relaxed">Reports you upload are stored in the patient's MedLocker. You automatically get access. Governed by <strong>DPDP Act 2023</strong> &amp; ABDM guidelines.</p>
      </div>

      {/* Patient filter for viewing reports */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <select value={selected?.id??''} onChange={e=>setSelected(patients.find(p=>p.id===e.target.value)??null)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:border-emerald-400 appearance-none pr-8">
            <option value="">— View all patients' reports —</option>
            {patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
        </div>
        {selected&&<button onClick={()=>setSelected(null)} className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 shrink-0">Clear</button>}
      </div>

      {/* Report list */}
      {loading?(
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse"/>)}</div>
      ):(
        <>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files…"
              className="pl-8 pr-4 h-8 w-full bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl text-xs focus:outline-none focus:border-emerald-400"/>
          </div>
          {shown.length===0?(
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <Lock size={20} className="text-slate-300 mx-auto mb-2"/>
              <p className="text-sm text-slate-500">{search?`No results for "${search}"`:'No reports uploaded yet. Click "Upload Report" to add one.'}</p>
            </div>
          ):(
            <div className="space-y-2">
              {shown.map(r=>{
                const cat=MCAT[r.category]??MCAT.general;
                const mine=r.uploadedByDoctorId===doctorId;
                return(
                  <div key={r.id} className={`bg-white border rounded-2xl p-4 flex items-start gap-3 hover:shadow-md transition-all ${r.isRestricted?'border-amber-200':'border-slate-200'}`}>
                    <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${r.isRestricted?'bg-amber-50':'bg-emerald-50'}`}>
                      {r.isRestricted?<Lock size={16} className="text-amber-600"/>:<FileText size={16} className="text-emerald-600"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{r.fileName}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
                        {r.isRestricted&&<span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Restricted</span>}
                        {mine&&<span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Uploaded by you</span>}
                        <span className="text-xs text-slate-400">{r.createdAt?.toDate?format(r.createdAt.toDate(),'MMM dd, yyyy'):'—'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={()=>window.open(r.fileUrl,'_blank')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all"><Eye size={14}/></button>
                      {mine&&<button onClick={()=>{if(confirm('Delete this report?'))handleDelete(r.id);}} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"><Trash2 size={14}/></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
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
  const [activeTab, setActiveTab] = useState<'overview'|'medlocker'>('overview');

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
      {/* ── Tab bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {([['overview','📊 Overview'],['medlocker','🔒 MedLocker']] as const).map(([key,label])=>(
            <button key={key} onClick={()=>setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab===key?'bg-white text-slate-800 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MedLocker tab ── */}
      {activeTab==='medlocker' && doctorUser && (
        <DoctorMedLockerTab doctorId={doctorUser.uid} doctorName={doctorData?.name??'Doctor'}/>
      )}

      {/* ── Overview tab ── */}
      {activeTab==='overview' && (<>
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
      </>)}
    </div>
  );
}
