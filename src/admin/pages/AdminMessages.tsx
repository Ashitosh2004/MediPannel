import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { writeAuditLog } from '../lib/auditLog';
import { notifySystemUpdate } from '../../lib/notifications';
import { toast } from 'react-hot-toast';
import { Send, MessageSquare, Megaphone, Users } from 'lucide-react';
import { format } from 'date-fns';

export function AdminMessages() {
  const { adminData } = useAdminAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [doctorCount, setDoctorCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Admin broadcast channel
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'adminBroadcasts'), orderBy('timestamp', 'asc'), limit(50)),
      (snap) => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      },
      err => { if (err.code !== 'permission-denied') console.error('Admin messages error:', err); }
    );
    getDocs(collection(db, 'doctors')).then(snap => setDoctorCount(snap.size)).catch(console.error);
    return () => unsub();
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminData || !newMsg.trim()) return;
    try {
      await addDoc(collection(db, 'adminBroadcasts'), {
        senderId: adminData.uid,
        senderName: adminData.name || 'Admin',
        text: newMsg.trim(),
        type: 'admin_message',
        timestamp: serverTimestamp(),
      });
      setNewMsg('');
    } catch (err) { console.error(err); toast.error('Failed to send message'); }
  };

  const broadcastToDoctors = async () => {
    if (!adminData || !broadcastText.trim()) { toast.error('Broadcast message cannot be empty'); return; }
    setIsBroadcasting(true);
    try {
      const doctorsSnap = await getDocs(collection(db, 'doctors'));
      const batch = doctorsSnap.docs.map(d => d.data());

      // Write one broadcast record targeting all doctors
      await addDoc(collection(db, 'adminBroadcasts'), {
        senderId: adminData.uid,
        senderName: adminData.name || 'Admin',
        text: broadcastText.trim(),
        type: 'broadcast',
        targetCount: batch.length,
        timestamp: serverTimestamp(),
      });

      await writeAuditLog(adminData.uid, 'BROADCAST_MESSAGE', 'all_doctors', broadcastText.trim().substring(0, 100));
      // Send a notification to each doctor who has a uid set
      const notifyPromises = batch
        .filter((d: any) => d.uid)
        .map((d: any) => notifySystemUpdate(d.uid, 'Admin Broadcast', broadcastText.trim().substring(0, 120)));
      await Promise.all(notifyPromises);
      setBroadcastText('');
      toast.success(`Broadcast sent to ${batch.length} doctor(s)`);
    } catch (err) { console.error(err); toast.error('Broadcast failed'); }
    finally { setIsBroadcasting(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-7rem)] flex flex-col">
      <div>
        <h1 className="text-2xl font-black text-white">Admin Messages</h1>
        <p className="text-gray-400 text-sm mt-0.5">Broadcast announcements and communicate with staff.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Chat Panel */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <MessageSquare size={16} className="text-blue-400" />
            <h3 className="text-sm font-bold text-white">Admin Broadcast Channel</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-950/30">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 py-16">
                <MessageSquare size={32} className="mb-3 text-gray-800" />
                <p className="text-sm font-semibold">No messages yet</p>
                <p className="text-xs mt-1">Use the input below to send a message to the channel</p>
              </div>
            ) : messages.map(m => (
              <div key={m.id} className="animate-in fade-in slide-in-from-bottom-1">
                <div className={`flex gap-3 ${m.type === 'broadcast' ? 'items-start' : 'items-start'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.type === 'broadcast' ? 'bg-amber-600/20' : 'bg-red-600/20'}`}>
                    {m.type === 'broadcast' ? <Megaphone size={14} className="text-amber-400" /> : <span className="text-red-400 font-black text-xs">{m.senderName?.charAt(0) || 'A'}</span>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-300">{m.senderName || 'Admin'}</span>
                      {m.type === 'broadcast' && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase rounded border border-amber-500/20">BROADCAST → {m.targetCount} doctors</span>}
                      <span className="text-[10px] text-gray-600">{m.timestamp ? format(m.timestamp.toDate(), 'MMM dd, h:mm a') : '—'}</span>
                    </div>
                    <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 inline-block max-w-lg">
                      {m.text}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-gray-800 flex gap-3">
            <input
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              placeholder="Send an admin channel message..."
              className="flex-1 h-10 px-4 bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 rounded-xl text-sm focus:outline-none focus:border-red-500"
            />
            <button type="submit" disabled={!newMsg.trim()} className="h-10 w-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all active:scale-90">
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Broadcast Panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <Megaphone size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white">Broadcast to Doctors</h3>
          </div>
          <div className="p-5 space-y-4 flex-1">
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-400">{doctorCount} Doctors</span>
              </div>
              <p className="text-xs text-gray-400">This message will be broadcast to all registered doctors in the system.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2">Broadcast Message</label>
              <textarea
                value={broadcastText}
                onChange={e => setBroadcastText(e.target.value)}
                placeholder="Type a message to broadcast to all doctors..."
                rows={6}
                className="w-full p-3 bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 rounded-xl text-sm resize-none focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={broadcastToDoctors}
              disabled={isBroadcasting || !broadcastText.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all active:scale-95"
            >
              {isBroadcasting ? (
                <><div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /><span>Broadcasting...</span></>
              ) : (
                <><Megaphone size={15} /><span>Send Broadcast</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
