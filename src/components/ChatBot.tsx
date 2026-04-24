import React, { useState, useRef, useEffect } from 'react';
import { Button, Card, CardContent } from '@blinkdotnew/ui';
import { MessageCircle, X, Send, Bot, Sparkles, ShieldCheck } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { groqChat, type GroqMessage } from '../lib/groqChat';

// ─── System persona ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT: GroqMessage = {
  role: 'system',
  content:
    'You are MedBot, a helpful AI health assistant inside MedPanel Pro patient portal. ' +
    'You give clear, friendly general health guidance and help patients navigate the portal ' +
    '(appointments, prescriptions, records, MedLocker, messages). ' +
    'Always recommend consulting a real doctor for diagnosis or treatment. ' +
    'Keep responses concise, warm, and in plain text (no markdown). ' +
    'Never make up medical facts. If unsure, say so.',
};

interface ChatMessage {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  timestamp: Date;
  isError?: boolean;
  actions?: { label: string; onClick: () => void }[];
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<GroqMessage[]>([SYSTEM_PROMPT]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const addMsg = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now().toString(), timestamp: new Date() }]);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  // Greeting on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addMsg({
        sender: 'bot',
        text: "Hi! I'm MedBot, your AI health assistant 👋\nAsk me anything about your health, or use the quick links below:",
        actions: [
          { label: '📅 Appointments', onClick: () => navigate({ to: '/appointments' }) },
          { label: '💊 Prescriptions', onClick: () => navigate({ to: '/prescriptions' }) },
          { label: '📂 Records', onClick: () => navigate({ to: '/records' }) },
          { label: '🔒 MedLocker', onClick: () => navigate({ to: '/medlocker' }) },
          { label: '💬 Messages', onClick: () => navigate({ to: '/messages' }) },
        ],
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
      addMsg({ sender: 'bot', text: 'Sorry, I ran into an issue connecting to the AI. Please try again.', isError: true });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
      {isOpen && (
        <Card className="w-[380px] h-[560px] shadow-2xl rounded-[2.5rem] border-none flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-6 zoom-in-95 duration-500 glass-card bg-white shadow-primary/20">
          {/* Header */}
          <div className="bg-primary p-5 text-white flex items-center justify-between shadow-lg shadow-primary/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md shadow-inner ring-1 ring-white/20">
                <Bot size={24} />
              </div>
              <div>
                <span className="font-black text-lg tracking-tight block">MedBot AI</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Powered by Groq</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}
              className="h-9 w-9 p-0 rounded-2xl hover:bg-white/20 text-white transition-all active:scale-90">
              <X size={18} />
            </Button>
          </div>

          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-white/30 to-[#f8fafc]/50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[85%] space-y-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`px-4 py-3 rounded-3xl shadow-sm text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-primary text-white rounded-tr-none'
                      : msg.isError
                      ? 'bg-red-50 text-red-600 border border-red-200 rounded-tl-none'
                      : 'bg-white text-foreground rounded-tl-none border border-border/30'
                  }`}>
                    {msg.text}
                  </div>
                  {msg.actions && (
                    <div className="flex flex-wrap gap-2 mt-1 px-1">
                      {msg.actions.map((action, i) => (
                        <button key={i} onClick={action.onClick}
                          className="px-3 py-1.5 bg-white border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary/5 hover:border-primary/50 transition-all shadow-sm active:scale-95">
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-tighter px-2">
                    {format(msg.timestamp, 'h:mm a')}
                  </span>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <div className="bg-white border border-border/30 px-5 py-3.5 rounded-3xl rounded-tl-none shadow-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </CardContent>

          {/* Input */}
          <div className="p-4 bg-white border-t border-border/40">
            <form onSubmit={handleSend} className="flex items-center gap-2 p-1.5 bg-[#f8fafc] rounded-2xl ring-1 ring-border/50 focus-within:ring-primary/20 focus-within:bg-white transition-all duration-300">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={isTyping}
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm font-medium text-foreground py-2 px-3 h-10 disabled:opacity-50"
              />
              <Button type="submit" disabled={!input.trim() || isTyping}
                className="rounded-xl h-10 w-10 flex items-center justify-center p-0 shadow-md shadow-primary/20 disabled:shadow-none disabled:opacity-50 transition-all active:scale-90 bg-primary">
                <Send size={16} className="text-white" />
              </Button>
            </form>
            <div className="flex items-center justify-center gap-1.5 mt-3 text-muted-foreground/40">
              <ShieldCheck size={10} />
              <span className="text-[8px] font-black uppercase tracking-widest">MedBot · Groq llama3-70b</span>
            </div>
          </div>
        </Card>
      )}

      {/* FAB */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-16 w-16 p-0 rounded-[2rem] shadow-2xl hover:scale-110 active:scale-90 transition-all duration-300 pointer-events-auto flex items-center justify-center relative group overflow-hidden ${
          isOpen ? 'bg-destructive shadow-destructive/40' : 'bg-primary shadow-primary/40'
        }`}
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        {isOpen ? (
          <X className="text-white w-7 h-7 animate-in spin-in-90 duration-300" />
        ) : (
          <div className="relative">
            <MessageCircle className="text-white w-7 h-7 animate-in zoom-in-50 duration-500" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping opacity-75" />
          </div>
        )}
      </Button>
    </div>
  );
}
