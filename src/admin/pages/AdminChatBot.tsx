import React, { useState, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { Bot, Send } from 'lucide-react';
import { groqChat, type GroqMessage } from '../../lib/groqChat';

// ─── Admin system prompt ────────────────────────────────────────────────────────
const SYSTEM_PROMPT: GroqMessage = {
  role: 'system',
  content:
    'You are MedAdmin AI, an intelligent assistant for a hospital management admin portal (MedPanel Pro). ' +
    'Help admins with: system analytics interpretation, hospital management best practices, doctor/patient ' +
    'management strategies, healthcare compliance (DPDP Act 2023, NABH, ABDM), and general administration. ' +
    'Be concise, data-driven, and professional. Use plain text only — no markdown.',
};

const QUICK_ACTIONS = [
  { label: '📊 System Summary', query: 'Give me a summary of the current system stats.' },
  { label: '🩺 Doctor Count', query: 'doctors' },
  { label: '👥 Patient Count', query: 'patients' },
  { label: '📅 Appointment Stats', query: 'appointments' },
];

interface Msg {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  timestamp: Date;
  isError?: boolean;
}

// ─── Local Firestore stats (instant, no AI needed) ─────────────────────────────
async function handleFirestoreQuery(q: string): Promise<string | null> {
  const lower = q.toLowerCase();
  try {
    if (lower.includes('doctor')) {
      const snap = await getDocs(collection(db, 'doctors'));
      const docs = snap.docs.map(d => d.data());
      const active = docs.filter(d => d.status !== 'suspended').length;
      return `📊 Doctor Overview:\n• Total: ${docs.length}\n• Active: ${active}\n• Suspended: ${docs.length - active}\n• Specialties: ${new Set(docs.map(d => d.specialty)).size}`;
    }
    if (lower.includes('patient')) {
      const snap = await getDocs(collection(db, 'users'));
      const pts = snap.docs.map(d => d.data());
      return `👥 Patient Overview:\n• Total registered: ${pts.length}\n• Flagged: ${pts.filter(p => p.flagged).length}\n• Deactivated: ${pts.filter(p => p.deactivated).length}`;
    }
    if (lower.includes('appointment')) {
      const snap = await getDocs(collection(db, 'appointments'));
      const appts = snap.docs.map(d => d.data());
      return `📅 Appointments:\n• Total: ${appts.length}\n• Upcoming: ${appts.filter(a => a.status === 'upcoming').length}\n• Completed: ${appts.filter(a => a.status === 'completed').length}\n• Emergency: ${appts.filter(a => a.status === 'emergency').length}\n• Cancelled: ${appts.filter(a => a.status === 'cancelled').length}`;
    }
    if (lower.includes('summary') || lower.includes('stats') || lower.includes('overview')) {
      const [doc, usr, appt, msg] = await Promise.all([
        getDocs(collection(db, 'doctors')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'appointments')),
        getDocs(collection(db, 'messages')),
      ]);
      return `📊 System Summary:\n• 👨‍⚕️ Doctors: ${doc.size}\n• 👥 Patients: ${usr.size}\n• 📅 Appointments: ${appt.size}\n• 💬 Messages: ${msg.size}`;
    }
  } catch {
    return null;
  }
  return null;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function AdminChatBot() {
  const { adminData } = useAdminAuth();

  const [messages, setMessages] = useState<Msg[]>([{
    id: '0', sender: 'bot', timestamp: new Date(),
    text: `Hello, ${adminData?.name || 'Admin'}! 👋 I'm MedAdmin AI powered by Groq.\nAsk me about system stats, hospital management, or compliance guidelines.`,
  }]);
  const [history, setHistory] = useState<GroqMessage[]>([SYSTEM_PROMPT]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addMsg = (msg: Omit<Msg, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now().toString(), timestamp: new Date() }]);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleQuery = async (query: string) => {
    if (isTyping) return;
    addMsg({ sender: 'user', text: query });
    setIsTyping(true);

    try {
      // Try Firestore stats first (instant, no API call)
      const firestoreAnswer = await handleFirestoreQuery(query);
      if (firestoreAnswer) {
        addMsg({ sender: 'bot', text: firestoreAnswer });
        setIsTyping(false);
        return;
      }

      // Fall back to Groq for open-ended questions
      const newHistory: GroqMessage[] = [...history, { role: 'user', content: query }];
      setHistory(newHistory);
      const reply = await groqChat(newHistory);
      addMsg({ sender: 'bot', text: reply });
      setHistory(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      addMsg({ sender: 'bot', text: 'Sorry, I encountered an error. Please try again.', isError: true });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    handleQuery(text);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-white">Admin AI Assistant</h1>
        <p className="text-gray-400 text-sm mt-0.5">Ask about system stats, management advice, or compliance. Powered by Groq.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col h-[65vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3 bg-gray-800/40">
          <div className="bg-red-600/20 p-2 rounded-xl border border-red-600/30">
            <Bot size={18} className="text-red-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">MedAdmin AI</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Groq · llama3-70b · Online</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-950/20">
          {messages.map(m => (
            <div key={m.id} className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}>
              {m.sender === 'bot' && (
                <div className="w-7 h-7 bg-red-600/20 rounded-lg flex items-center justify-center shrink-0 mt-1">
                  <Bot size={13} className="text-red-400" />
                </div>
              )}
              <div className={`max-w-lg px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-line ${
                m.sender === 'user'
                  ? 'bg-red-600 text-white ml-4'
                  : m.isError
                  ? 'bg-red-900/40 text-red-300 border border-red-700/40'
                  : 'bg-gray-800 text-gray-200'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-7 h-7 bg-red-600/20 rounded-lg flex items-center justify-center shrink-0">
                <Bot size={13} className="text-red-400" />
              </div>
              <div className="bg-gray-800 px-4 py-3 rounded-xl flex items-center gap-1.5">
                {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Quick Actions */}
        <div className="px-5 py-3 border-t border-gray-800 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(qa => (
            <button key={qa.query} onClick={() => handleQuery(qa.query)} disabled={isTyping}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
              {qa.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800 flex gap-3 bg-gray-900">
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about hospital management..."
            disabled={isTyping}
            className="flex-1 h-10 px-4 bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 rounded-xl text-sm focus:outline-none focus:border-red-500 disabled:opacity-50" />
          <button type="submit" disabled={!input.trim() || isTyping}
            className="h-10 w-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all active:scale-90">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
