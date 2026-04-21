import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { writeAuditLog } from '../lib/auditLog';
import { toast } from 'react-hot-toast';
import { Clock, Plus, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import { format, isValid } from 'date-fns';

export function AvailabilityManagement() {
  const { adminData } = useAdminAuth();
  const [availability, setAvailability] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', reason: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAvail = onSnapshot(
      query(collection(db, 'availability'), orderBy('doctorName', 'asc')),
      (snap) => { setAvailability(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { if (err.code !== 'permission-denied') console.error('Availability error:', err); setLoading(false); }
    );
    const unsubHolidays = onSnapshot(
      query(collection(db, 'globalHolidays'), orderBy('date', 'asc')),
      (snap) => setHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => { if (err.code !== 'permission-denied') console.error('Holidays error:', err); }
    );
    return () => { unsubAvail(); unsubHolidays(); };
  }, []);

  const addHoliday = async () => {
    if (!adminData || !newHoliday.date || !newHoliday.reason) {
      toast.error('Please provide date and reason'); return;
    }
    try {
      await addDoc(collection(db, 'globalHolidays'), { date: newHoliday.date, reason: newHoliday.reason, createdAt: serverTimestamp(), createdBy: adminData.uid });
      await writeAuditLog(adminData.uid, 'SET_HOLIDAY', newHoliday.date, `Holiday set: ${newHoliday.reason}`);
      setNewHoliday({ date: '', reason: '' });
      toast.success('Holiday added');
    } catch (err) { console.error(err); toast.error('Failed to add holiday'); }
  };

  const deleteHoliday = async (id: string, reason: string) => {
    if (!adminData) return;
    if (!confirm('Remove this holiday?')) return;
    try {
      await deleteDoc(doc(db, 'globalHolidays', id));
      await writeAuditLog(adminData.uid, 'SET_HOLIDAY', id, `Holiday removed: ${reason}`);
      toast.success('Holiday removed');
    } catch (err) { console.error(err); toast.error('Failed to remove holiday'); }
  };

  const toggleAvailabilityOverride = async (avail: any) => {
    if (!adminData) return;
    try {
      await updateDoc(doc(db, 'availability', avail.id), { overrideUnavailable: !avail.overrideUnavailable, updatedAt: serverTimestamp() });
      await writeAuditLog(adminData.uid, 'OVERRIDE_AVAILABILITY', avail.doctorName || avail.id, `Override set to ${!avail.overrideUnavailable}`);
      toast.success(`Availability ${!avail.overrideUnavailable ? 'blocked' : 'restored'}`);
    } catch (err) { console.error(err); toast.error('Failed to update availability'); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-white">Availability Management</h1>
        <p className="text-gray-400 text-sm mt-0.5">Manage doctor schedules and set global holidays.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctor Availability */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <Clock size={16} className="text-blue-400" />
            <h3 className="text-sm font-bold text-white">Doctor Schedules</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {loading ? (
              <div className="p-10 text-center text-gray-500 text-sm">
                <div className="animate-spin h-6 w-6 border-2 border-gray-700 border-t-blue-500 rounded-full mx-auto mb-2" />Loading...
              </div>
            ) : availability.length === 0 ? (
              <div className="p-10 text-center text-gray-600 text-sm">
                <Clock size={24} className="mx-auto mb-2 text-gray-700" />
                No availability records yet. Doctors will show here once they set their schedules.
              </div>
            ) : availability.map(a => (
              <div key={a.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{a.doctorName || a.doctorId}</div>
                  <div className="text-xs text-gray-500">{a.days?.join(', ') || 'No days set'} · {a.startTime || '—'} – {a.endTime || '—'}</div>
                </div>
                <button
                  onClick={() => toggleAvailabilityOverride(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${a.overrideUnavailable ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'}`}
                >
                  {a.overrideUnavailable ? 'Blocked' : 'Block'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Global Holidays */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <Calendar size={16} className="text-red-400" />
            <h3 className="text-sm font-bold text-white">Global Holidays</h3>
          </div>
          <div className="p-5 border-b border-gray-800">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Date</label>
                  <input type="date" value={newHoliday.date} onChange={e => setNewHoliday(p => ({ ...p, date: e.target.value }))}
                    className="w-full h-9 px-3 bg-gray-800 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Reason</label>
                  <input type="text" value={newHoliday.reason} onChange={e => setNewHoliday(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. National Holiday"
                    className="w-full h-9 px-3 bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 rounded-xl text-sm focus:outline-none focus:border-red-500" />
                </div>
              </div>
              <button onClick={addHoliday} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all active:scale-95">
                <Plus size={14} />
                <span>Add Holiday</span>
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
            {holidays.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm">No holidays set</div>
            ) : holidays.map(h => (
              <div key={h.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-red-600/10 p-2 rounded-lg"><Calendar size={14} className="text-red-400" /></div>
                  <div>
                    <div className="text-sm font-semibold text-white">{h.reason}</div>
                    <div className="text-xs text-gray-500">{h.date}</div>
                  </div>
                </div>
                <button onClick={() => deleteHoliday(h.id, h.reason)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 flex gap-3">
        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-400/80 leading-relaxed">
          Blocking a doctor's availability will prevent patients from booking appointments with them. Global holidays affect all doctors across the system.
        </p>
      </div>
    </div>
  );
}
