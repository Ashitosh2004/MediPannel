import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { writeAuditLog } from '../lib/auditLog';
import { toast } from 'react-hot-toast';
import { DataTable } from '@blinkdotnew/ui';
import { Search, Users, Flag, UserX, UserCheck } from 'lucide-react';
import { format, isValid } from 'date-fns';

export function PatientManagement() {
  const { adminData } = useAdminAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // No orderBy to avoid composite index requirements — sort client-side
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => {
            const aMs = a.createdAt?.toMillis?.() ?? 0;
            const bMs = b.createdAt?.toMillis?.() ?? 0;
            return bMs - aMs;
          });
        setPatients(list);
        setLoading(false);
      },
      (err) => { if (err.code !== 'permission-denied') console.error('Patients error:', err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const safeDate = (v: any) => {
    try {
      const d = v?.toDate ? v.toDate() : new Date(v);
      return isValid(d) ? format(d, 'MMM dd, yyyy') : '—';
    } catch { return '—'; }
  };

  const handleFlag = async (patient: any) => {
    if (!adminData) return;
    const newFlagged = !patient.flagged;
    try {
      await updateDoc(doc(db, 'users', patient.id), { flagged: newFlagged, updatedAt: serverTimestamp() });
      await writeAuditLog(adminData.uid, 'FLAG_PATIENT', patient.email, `Patient "${patient.name}" ${newFlagged ? 'flagged' : 'unflagged'}`);
      toast.success(`Patient ${newFlagged ? 'flagged' : 'unflagged'}`);
    } catch (err) { console.error(err); toast.error('Failed to flag patient'); }
  };

  const handleDeactivate = async (patient: any) => {
    if (!adminData || isProcessing) return;
    const newStatus = patient.deactivated ? 'active' : 'deactivated';
    const verb = patient.deactivated ? 'Reactivate' : 'Deactivate';
    // Use a simple prompt to avoid rapid-fire UI crashes from automated tools
    const confirmed = window.confirm(`${verb} patient "${patient.name || patient.email}"?`);
    if (!confirmed) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'users', patient.id), { deactivated: !patient.deactivated, updatedAt: serverTimestamp() });
      await writeAuditLog(adminData.uid, 'DEACTIVATE_PATIENT', patient.email, `Patient "${patient.name}" ${newStatus}`);
      toast.success(`Patient ${newStatus}`);
    } catch (err) { console.error(err); toast.error('Failed to update patient'); }
    finally { setIsProcessing(false); }
  };

  const filtered = patients.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      accessorKey: 'name', header: 'Patient',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          {row.original.profileImage ? (
            <img src={row.original.profileImage} alt="" className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
              {row.original.name?.charAt(0) || 'P'}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              {row.original.name || 'Unknown'}
              {row.original.flagged && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase rounded border border-amber-500/20">Flagged</span>}
              {row.original.deactivated && <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[9px] font-black uppercase rounded border border-red-500/20">Inactive</span>}
            </div>
            <div className="text-xs text-gray-500">{row.original.email}</div>
          </div>
        </div>
      )
    },
    {
      accessorKey: 'phone', header: 'Phone',
      cell: ({ row }: any) => <span className="text-sm text-gray-400">{row.original.phone || '—'}</span>
    },
    {
      accessorKey: 'createdAt', header: 'Joined',
      cell: ({ row }: any) => <span className="text-sm text-gray-400">{safeDate(row.original.createdAt)}</span>
    },
    {
      id: 'actions', header: '',
      cell: ({ row }: any) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleFlag(row.original)}
            className={`p-1.5 rounded-lg transition-all ${row.original.flagged ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' : 'text-gray-500 hover:text-amber-400 hover:bg-amber-500/10'}`}
            title={row.original.flagged ? 'Remove flag' : 'Flag patient'}
          >
            <Flag size={14} />
          </button>
          <button
            onClick={() => handleDeactivate(row.original)}
            className={`p-1.5 rounded-lg transition-all ${row.original.deactivated ? 'text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'}`}
            title={row.original.deactivated ? 'Reactivate' : 'Deactivate'}
          >
            {row.original.deactivated ? <UserCheck size={14} /> : <UserX size={14} />}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-white">Patient Management</h1>
        <p className="text-gray-400 text-sm mt-0.5">View and manage all registered patients.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-2xl font-black text-white">{patients.length}</div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Total Patients</div>
        </div>
        <div className="bg-gray-900 border border-amber-500/20 rounded-xl p-4">
          <div className="text-2xl font-black text-amber-400">{patients.filter(p => p.flagged).length}</div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Flagged</div>
        </div>
        <div className="bg-gray-900 border border-red-500/20 rounded-xl p-4">
          <div className="text-2xl font-black text-red-400">{patients.filter(p => p.deactivated).length}</div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Deactivated</div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-400" />
            <span className="text-sm font-bold text-white">All Patients</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients..." className="pl-9 h-8 bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 rounded-xl text-xs focus:outline-none focus:border-red-500 w-56" />
          </div>
        </div>
        {loading ? (
          <div className="p-14 text-center text-gray-500 text-sm">
            <div className="animate-spin h-7 w-7 border-2 border-gray-700 border-t-red-500 rounded-full mx-auto mb-3" />Loading...
          </div>
        ) : filtered.length > 0 ? (
          <div className="[&_table]:bg-transparent [&_thead]:bg-gray-800/50 [&_thead_th]:text-gray-400 [&_tbody_tr]:border-gray-800 [&_tbody_tr]:hover:bg-gray-800/30 [&_tbody_td]:text-gray-300">
            <DataTable columns={columns} data={filtered} />
          </div>
        ) : (
          <div className="p-14 text-center text-gray-500 text-sm"><Users size={28} className="mx-auto mb-3 text-gray-700" /><div>No patients found</div></div>
        )}
      </div>
    </div>
  );
}
