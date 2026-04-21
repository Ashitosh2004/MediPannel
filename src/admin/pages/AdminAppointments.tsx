import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { writeAuditLog } from '../lib/auditLog';
import { toast } from 'react-hot-toast';
import { DataTable } from '@blinkdotnew/ui';
import { Search, Calendar, Trash2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { format, isValid } from 'date-fns';

const STATUS_OPTIONS = ['upcoming', 'completed', 'cancelled'];
const statusStyle: Record<string, string> = {
  upcoming: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export function AdminAppointments() {
  const { adminData } = useAdminAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'appointments'), orderBy('createdAt', 'desc')),
      (snap) => { setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { if (err.code !== 'permission-denied') console.error('Admin appointments error:', err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const safeDate = (v: any) => {
    try { const d = v?.toDate ? v.toDate() : new Date(v); return isValid(d) ? format(d, 'MMM dd, yyyy') : v || '—'; } catch { return v || '—'; }
  };

  const handleStatusChange = async (id: string, status: string, doctorName: string) => {
    if (!adminData) return;
    try {
      await updateDoc(doc(db, 'appointments', id), { status, updatedAt: serverTimestamp() });
      await writeAuditLog(adminData.uid, 'UPDATE_APPOINTMENT', id, `Status changed to ${status} for appointment with ${doctorName}`);
      toast.success(`Status updated to ${status}`);
    } catch (err) { console.error(err); toast.error('Failed to update status'); }
  };

  const handleDelete = async (appt: any) => {
    if (!adminData) return;
    if (!confirm('Delete this appointment record?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', appt.id));
      await writeAuditLog(adminData.uid, 'DELETE_APPOINTMENT', appt.id, `Appointment deleted`);
      toast.success('Appointment deleted');
    } catch (err) { console.error(err); toast.error('Failed to delete'); }
  };

  const filtered = appointments.filter(a => {
    const matchSearch = !search || a.doctorName?.toLowerCase().includes(search.toLowerCase()) || a.userId?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    upcoming: appointments.filter(a => a.status === 'upcoming').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  };

  const columns: any[] = [
    {
      accessorKey: 'doctorName', header: 'Doctor',
      cell: ({ row }: any) => (
        <div>
          <div className="text-sm font-semibold text-white">{row.original.doctorName || '—'}</div>
          <div className="text-xs text-gray-500">{row.original.specialty}</div>
        </div>
      )
    },
    {
      accessorKey: 'date', header: 'Date & Time',
      cell: ({ row }: any) => (
        <div>
          <div className="text-sm text-gray-300">{safeDate(row.original.date)}</div>
          <div className="text-xs text-gray-500">{row.original.time}</div>
        </div>
      )
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }: any) => (
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusStyle[row.original.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
          {row.original.status}
        </span>
      )
    },
    {
      id: 'actions', header: '',
      cell: ({ row }: any) => (
        <div className="flex items-center justify-end gap-1">
          {row.original.status !== 'completed' && (
            <button onClick={() => handleStatusChange(row.original.id, 'completed', row.original.doctorName)} className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all" title="Mark completed">
              <CheckCircle2 size={14} />
            </button>
          )}
          {row.original.status !== 'cancelled' && (
            <button onClick={() => handleStatusChange(row.original.id, 'cancelled', row.original.doctorName)} className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all" title="Mark cancelled">
              <XCircle size={14} />
            </button>
          )}
          {row.original.status === 'cancelled' && (
            <button onClick={() => handleStatusChange(row.original.id, 'upcoming', row.original.doctorName)} className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Restore">
              <RefreshCw size={14} />
            </button>
          )}
          <button onClick={() => handleDelete(row.original)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-white">Appointments Management</h1>
        <p className="text-gray-400 text-sm mt-0.5">View and manage all patient appointments across the system.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Upcoming', count: counts.upcoming, color: 'border-blue-500/20 text-blue-400' },
          { label: 'Completed', count: counts.completed, color: 'border-emerald-500/20 text-emerald-400' },
          { label: 'Cancelled', count: counts.cancelled, color: 'border-red-500/20 text-red-400' },
        ].map(s => (
          <div key={s.label} className={`bg-gray-900 border ${s.color} rounded-xl p-4`}>
            <div className={`text-2xl font-black ${s.color.split(' ')[1]}`}>{s.count}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-amber-400" />
            <span className="text-sm font-bold text-white">All Appointments</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {['all', 'upcoming', 'completed', 'cancelled'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${filterStatus === s ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-8 bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 rounded-xl text-xs focus:outline-none focus:border-red-500 w-48" />
            </div>
          </div>
        </div>
        {loading ? (
          <div className="p-14 text-center text-gray-500 text-sm">
            <div className="animate-spin h-7 w-7 border-2 border-gray-700 border-t-red-500 rounded-full mx-auto mb-3" />Loading...
          </div>
        ) : filtered.length > 0 ? (
          <DataTable columns={columns} data={filtered} className="[&_table]:bg-transparent [&_thead]:bg-gray-800/50 [&_thead_th]:text-gray-400 [&_tbody_tr]:border-gray-800 [&_tbody_tr]:hover:bg-gray-800/30 [&_tbody_td]:text-gray-300" />
        ) : (
          <div className="p-14 text-center text-gray-500 text-sm"><Calendar size={28} className="mx-auto mb-3 text-gray-700" /><div>No appointments found</div></div>
        )}
      </div>
    </div>
  );
}
