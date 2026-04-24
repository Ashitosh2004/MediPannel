import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, ShieldCheck } from 'lucide-react';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { format } from 'date-fns';
import { groqChat, type GroqMessage } from '../../lib/groqChat';

interface ChatMsg {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  timestamp: Date;
  isError?: boolean;
}

export function DoctorChatBot() {
  const { doctorData } = useDoctorAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [history, setHistory] = useState<GroqMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const doctorFirstName = doctorData?.name?.split(' ')[0] || 'Doctor';

  const systemPrompt: GroqMessage = {
    role: 'system',
    content:
      `You are MedAssist AI, an intelligent clinical support assistant for Dr. ${doctorFirstName} in MedPanel Pro. ` +
      'Help the doctor with: clinical decision support, drug interactions, differential diagnoses, medical knowledge, ' +
      'treatment guidelines (Indian & international), and navigating the hospital portal. ' +
      'Be concise, professional, and evidence-based. Always remind the doctor to apply their own clinical judgment. ' +
      'Use plain text only — no markdown formatting.',
  };

  const addMsg = (msg: Omit<ChatMsg, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now().toString(), timestamp: new Date() }]);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setHistory([systemPrompt]);
      addMsg({
        sender: 'bot',
        text: `Hello, Dr. ${doctorFirstName}! 👋\nI'm MedAssist AI, your clinical support assistant powered by Groq. Ask me about diagnoses, drug interactions, treatment protocols, or patient management.`,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isTyping) return;

    addMsg({ sender: 'user', text });
    setInput('');
    setIsTyping(true);

    const newHistory: GroqMessage[] = [...history, { role: 'user', content: text }];
    setHistory(newHistory);

    try {
      const reply = await groqChat(newHistory);
      addMsg({ sender: 'bot', text: reply });
      setHistory(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      addMsg({ sender: 'bot', text: 'Sorry, I ran into a connection issue. Please try again.', isError: true });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      {isOpen && (
        <div className="w-[360px] h-[520px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-6 zoom-in-95 duration-400">
          {/* Header */}
          <div className="bg-emerald-600 px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">MedAssist AI</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                  <span className="text-[10px] font-semibold text-emerald-100 uppercase tracking-widest">Groq · llama3-70b</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-all active:scale-90">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}>
                <div className={`max-w-[85%] space-y-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-sm'
                      : msg.isError
                      ? 'bg-red-50 text-red-600 border border-red-200 rounded-tl-sm'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[9px] font-medium text-slate-400 px-1">
                    {format(msg.timestamp, 'h:mm a')}
                  </span>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start animate-in fade-in duration-200">
                <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-slate-100 shrink-0">
            <form onSubmit={handleSend} className="flex items-center gap-2 bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-emerald-400 focus-within:bg-white transition-all px-3">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask a clinical question..."
                disabled={isTyping}
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-800 py-2.5 h-10 disabled:opacity-50"
              />
              <button type="submit" disabled={!input.trim() || isTyping}
                className="w-8 h-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0">
                <Send size={14} />
              </button>
            </form>
            <div className="flex items-center justify-center gap-1 mt-2 text-slate-400">
              <ShieldCheck size={9} />
              <span className="text-[8px] font-semibold uppercase tracking-widest">MedAssist AI · Clinical Support Only</span>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`h-14 w-14 rounded-2xl shadow-xl flex items-center justify-center relative group overflow-hidden pointer-events-auto transition-all duration-300 hover:scale-110 active:scale-90 ${
          isOpen ? 'bg-slate-700 shadow-slate-500/30' : 'bg-emerald-600 shadow-emerald-600/30'
        }`}
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        {isOpen ? (
          <X className="text-white w-6 h-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="text-white w-6 h-6" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
          </div>
        )}
      </button>
    </div>
  );
}
