import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { toast } from 'react-hot-toast';
import { notifyNewMessage } from '../../lib/notifications';
import { MessageSquare, Send, Search } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: Timestamp | null;
  read: boolean;
}

interface Conversation {
  conversationId: string;
  partnerId: string;
  partnerName: string;
  lastMessage: string;
  lastTimestamp: Timestamp | null;
  unreadCount: number;
  messages: Message[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTimestamp(ts: Timestamp | null): string {
  if (!ts) return '';
  try {
    return formatDistanceToNow(ts.toDate(), { addSuffix: true });
  } catch {
    return '';
  }
}

function formatMessageTime(ts: Timestamp | null): string {
  if (!ts) return '';
  try {
    return format(ts.toDate(), 'h:mm a');
  } catch {
    return '';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DoctorMessages() {
  const { doctorUser, doctorData, loading: authLoading } = useDoctorAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const uid = doctorUser?.uid;
  // The Firestore doc ID may differ from the Firebase Auth UID for older accounts.
  // Patients may have stored receiverId = docId, so we listen on both.
  const originalDocId = doctorData?.originalDocId;

  // ── Real-time listeners ───────────────────────────────────────────────────
  // We listen on 3 queries because patients may have stored receiverId as either
  // the doctor's Firebase Auth UID _or_ their older Firestore document ID.
  // Query 1: messages the doctor SENT (senderId == uid)
  // Query 2: messages received under the Auth UID (receiverId == uid)
  // Query 3: messages received under the old doc ID (receiverId == originalDocId)
  useEffect(() => {
    if (!uid || authLoading) return;

    let sentMsgs: Message[] = [];
    let receivedMsgs: Message[] = [];   // union of q2 + q3 results
    let legacyMsgs: Message[] = [];     // q3 results keyed separately to avoid clobber

    // All ID strings that identify this doctor so we can detect "isDoctor" correctly
    const myIds = new Set([uid, ...(originalDocId && originalDocId !== uid ? [originalDocId] : [])]);

    const rebuild = () => {
      const map = new Map<string, Conversation>();

      const processMsg = (msg: Message) => {
        const isDoctor = myIds.has(msg.senderId);
        const partnerId = isDoctor ? msg.receiverId : msg.senderId;
        const partnerName = isDoctor
          ? (msg as any).receiverName || partnerId
          : msg.senderName || partnerId;

        // Normalize conversation ID: always use the Auth UID side so both
        // legacy (docId) and new (authUID) conversations merge into one thread.
        const rawConvId = msg.conversationId || [uid, partnerId].sort().join('_');
        // Re-key using authUID so legacy and new messages share the same conversation
        const convId = rawConvId.replace(originalDocId ?? '__NOPE__', uid);

        if (!map.has(convId)) {
          map.set(convId, {
            conversationId: convId,
            partnerId,
            partnerName,
            lastMessage: '',
            lastTimestamp: null,
            unreadCount: 0,
            messages: [],
          });
        }

        const conv = map.get(convId)!;
        if (!isDoctor && msg.senderName) {
          conv.partnerName = msg.senderName;
        }

        // Deduplicate by Firestore doc ID
        if (!conv.messages.find(m => m.id === msg.id)) {
          conv.messages.push(msg);
        }

        const tsMs = msg.timestamp?.toMillis() ?? 0;
        const lastMs = conv.lastTimestamp?.toMillis() ?? 0;
        if (tsMs >= lastMs) {
          conv.lastMessage = msg.text;
          conv.lastTimestamp = msg.timestamp;
        }

        if (!isDoctor && !msg.read) {
          conv.unreadCount += 1;
        }
      };

      // Merge all sources — deduplicated by Firestore doc ID inside processMsg
      const merged = [...sentMsgs, ...receivedMsgs, ...legacyMsgs];
      // Remove exact Firestore-doc-ID duplicates before processing
      const seen = new Set<string>();
      merged.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }).forEach(processMsg);

      map.forEach((conv) => {
        conv.messages.sort((a, b) => {
          const aMs = a.timestamp?.toMillis() ?? 0;
          const bMs = b.timestamp?.toMillis() ?? 0;
          return aMs - bMs;
        });
      });

      const sorted = Array.from(map.values()).sort((a, b) => {
        const aMs = a.lastTimestamp?.toMillis() ?? 0;
        const bMs = b.lastTimestamp?.toMillis() ?? 0;
        return bMs - aMs;
      });

      setConversations(sorted);
    };

    // Q1 – messages SENT by doctor
    const q1 = query(collection(db, 'messages'), where('senderId', '==', uid));

    // Q2 – messages RECEIVED by doctor (via Auth UID)
    const q2 = query(collection(db, 'messages'), where('receiverId', '==', uid));

    const unsub1 = onSnapshot(
      q1,
      (snap) => {
        sentMsgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
        rebuild();
      },
      (err) => {
        if (err.code !== 'permission-denied') console.error('Doctor sent messages error:', err);
      }
    );

    const unsub2 = onSnapshot(
      q2,
      (snap) => {
        receivedMsgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
        rebuild();
      },
      (err) => {
        if (err.code !== 'permission-denied') console.error('Doctor received messages error:', err);
      }
    );

    // Q3 – messages RECEIVED via old Firestore doc ID (legacy patients)
    let unsub3: (() => void) | null = null;
    if (originalDocId && originalDocId !== uid) {
      const q3 = query(collection(db, 'messages'), where('receiverId', '==', originalDocId));
      unsub3 = onSnapshot(
        q3,
        (snap) => {
          legacyMsgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
          rebuild();
        },
        (err) => {
          if (err.code !== 'permission-denied') console.error('Doctor legacy messages error:', err);
        }
      );
    }

    return () => {
      unsub1();
      unsub2();
      unsub3?.();
    };
  }, [uid, originalDocId, authLoading]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  }, [selectedConvId, conversations]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !doctorData || !selectedConvId || !messageText.trim()) return;

    const activeConv = conversations.find(c => c.conversationId === selectedConvId);
    if (!activeConv) return;

    const conversationId = [uid, activeConv.partnerId].sort().join('_');
    const text = messageText.trim();

    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        conversationId,
        senderId: uid,
        senderName: doctorData.name,
        receiverId: activeConv.partnerId,
        text,
        timestamp: serverTimestamp(),
        read: false,
      });
      // Notify the patient
      await notifyNewMessage(activeConv.partnerId, `Dr. ${doctorData.name}`);
      setMessageText('');
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        toast.error('Permission denied. Please check Firestore rules.');
      } else {
        toast.error('Failed to send message');
      }
    } finally {
      setSending(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredConversations = conversations.filter((c) =>
    c.partnerName.toLowerCase().includes(search.toLowerCase()) ||
    c.partnerId.toLowerCase().includes(search.toLowerCase())
  );

  const activeConversation = conversations.find((c) => c.conversationId === selectedConvId);

  const handleSelectConversation = (convId: string) => {
    setSelectedConvId(convId);
    setMobileShowChat(true);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Page Title */}
      <div className="mb-4 shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Messages</h1>
        <p className="text-sm text-slate-500 mt-0.5">Real-time conversations with patients.</p>
      </div>

      {/* Split panel */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex overflow-hidden">

        {/* ── Left: Conversation list ── */}
        <div className={`
          w-full md:w-1/3 border-r border-slate-100 flex flex-col shrink-0
          ${mobileShowChat ? 'hidden md:flex' : 'flex'}
        `}>
          {/* Search */}
          <div className="p-3 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <MessageSquare size={22} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-600">No conversations yet</p>
                <p className="text-xs text-slate-400 mt-1">Patient messages will appear here</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.conversationId}
                  onClick={() => handleSelectConversation(conv.conversationId)}
                  className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors hover:bg-slate-50 ${
                    selectedConvId === conv.conversationId ? 'bg-emerald-50 hover:bg-emerald-50' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    selectedConvId === conv.conversationId
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {getInitials(conv.partnerName)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {conv.partnerName}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatTimestamp(conv.lastTimestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 truncate">{conv.lastMessage}</span>
                      {conv.unreadCount > 0 && (
                        <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center px-1">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right: Chat panel ── */}
        <div className={`
          flex-1 flex flex-col min-w-0
          ${mobileShowChat ? 'flex' : 'hidden md:flex'}
        `}>
          {!activeConversation ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-emerald-400" />
              </div>
              <p className="text-base font-semibold text-slate-700">Select a conversation</p>
              <p className="text-sm text-slate-400 mt-1.5 max-w-xs">
                Choose a conversation from the left panel to start chatting
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
                <button
                  className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                  onClick={() => setMobileShowChat(false)}
                >
                  ←
                </button>
                <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {getInitials(activeConversation.partnerName)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{activeConversation.partnerName}</p>
                  <p className="text-xs text-slate-400">Patient</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
                {activeConversation.messages.map((msg) => {
                  const isDoctor = msg.senderId === uid;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isDoctor ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[75%] group">
                        {!isDoctor && (
                          <p className="text-[10px] font-semibold text-slate-400 mb-1 ml-1">
                            {msg.senderName}
                          </p>
                        )}
                        <div className={`px-4 py-2.5 text-sm leading-relaxed ${
                          isDoctor
                            ? 'bg-emerald-600 text-white rounded-2xl rounded-br-sm'
                            : 'bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm'
                        }`}>
                          {msg.text}
                        </div>
                        <p className={`text-[10px] text-slate-400 mt-1 ${isDoctor ? 'text-right mr-1' : 'ml-1'}`}>
                          {formatMessageTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={handleSend}
                className="px-4 py-3 border-t border-slate-100 flex items-center gap-3 shrink-0"
              >
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || sending}
                  className="shrink-0 w-10 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors active:scale-95"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
