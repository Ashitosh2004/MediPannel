import React, { useState, useRef, useEffect } from 'react';
import { Button, Card, CardContent } from '@blinkdotnew/ui';
import { MessageCircle, X, Send, Bot, Sparkles, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';

// ─── API config ───────────────────────────────────────────────────────────────
const LLM_URL = 'https://backend.buildpicoapps.com/aero/run/llm-api?pk=v1-Z0FBQUFBQnBYN0haRnpBSFdpSkhRVkZQeXlVMUg4WjA4ZmxTaVowZTZjNHdKTkFUSHRSNGtaaEdJWUJhd0NCM3NXSl9FTjBPdkNaQV93OC1zamxWUGM3RFJmeVZKLTFXenc9PQ==';
const IMG_URL = 'https://backend.buildpicoapps.com/aero/run/image-generation-api?pk=v1-Z0FBQUFBQnBYN0haRnpBSFdpSkhRVkZQeXlVMUg4WjA4ZmxTaVowZTZjNHdKTkFUSHRSNGtaaEdJWUJhd0NCM3NXSl9FTjBPdkNaQV93OC1zamxWUGM3RFJmeVZKLTFXenc9PQ==';

// Prepend a medical persona so the LLM responds in context
const PERSONA = 'You are MedBot, a helpful AI health assistant in MedPanel Pro patient portal. ' +
  'You provide general health info, help patients navigate their portal (appointments, prescriptions, records, messages), ' +
  'and offer supportive medical guidance. Always recommend consulting a real doctor for diagnosis. ' +
  'If the user asks to generate/create an image, reply with "/image " followed by the description. ' +
  'Keep responses concise and warm. User message: ';

interface ChatMessage {
  id: string;
  type: 'text' | 'image' | 'error';
  text?: string;
  imageUrl?: string;
  sender: 'bot' | 'user';
  timestamp: Date;
  actions?: { label: string; onClick: () => void }[];
}

async function callApi(url: string, prompt: string): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return res.json();
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const addMsg = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now().toString(), timestamp: new Date() }]);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  // Initial greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addMsg({
        sender: 'bot',
        type: 'text',
        text: "Hi! I'm MedBot, your AI health assistant 👋\nAsk me anything about your health, or use these shortcuts:",
        actions: [
          { label: '📅 Book Appointment', onClick: () => navigate({ to: '/appointments' }) },
          { label: '💊 Prescriptions', onClick: () => navigate({ to: '/prescriptions' }) },
          { label: '📂 Medical Records', onClick: () => navigate({ to: '/records' }) },
          { label: '💬 Message Doctor', onClick: () => navigate({ to: '/messages' }) },
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

    addMsg({ sender: 'user', type: 'text', text });
    setInput('');
    setIsTyping(true);

    try {
      // Image generation shortcut
      if (text.toLowerCase().startsWith('/image ')) {
        const desc = text.slice(7).trim();
        const data = await callApi(IMG_URL, desc);
        if (data.status === 'success') {
          addMsg({ sender: 'bot', type: 'image', imageUrl: data.imageUrl });
        } else {
          addMsg({ sender: 'bot', type: 'error', text: 'Image generation failed. Please try again.' });
        }
        setIsTyping(false);
        return;
      }

      // Normal LLM call with medical persona
      const data = await callApi(LLM_URL, PERSONA + text);
      if (data.status === 'success') {
        const reply: string = data.text || '';
        // Check if the LLM decided to generate an image
        if (reply.trim().toLowerCase().startsWith('/image')) {
          const desc = reply.substring(reply.toLowerCase().indexOf('/image') + 6).trim();
          setIsTyping(true);
          const imgData = await callApi(IMG_URL, desc);
          if (imgData.status === 'success') {
            addMsg({ sender: 'bot', type: 'image', imageUrl: imgData.imageUrl });
          } else {
            addMsg({ sender: 'bot', type: 'text', text: reply });
          }
        } else {
          addMsg({ sender: 'bot', type: 'text', text: reply });
        }
      } else {
        addMsg({ sender: 'bot', type: 'error', text: 'Sorry, I ran into an issue. Please try again.' });
      }
    } catch (err) {
      addMsg({ sender: 'bot', type: 'error', text: 'Network error. Please check your connection and try again.' });
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
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Always Online</span>
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
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[85%] space-y-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  {msg.type === 'image' && msg.imageUrl ? (
                    <div className="relative">
                      <img
                        src={msg.imageUrl}
                        alt="AI Generated"
                        className="rounded-2xl max-w-[220px] shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(msg.imageUrl, '_blank')}
                      />
                      <a href={msg.imageUrl} download="medbot-image.png"
                        className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-black/80 transition-colors">
                        ⬇ Save
                      </a>
                    </div>
                  ) : (
                    <div className={`px-4 py-3 rounded-3xl shadow-sm text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                      msg.sender === 'user'
                        ? 'bg-primary text-white rounded-tr-none'
                        : msg.type === 'error'
                        ? 'bg-red-50 text-red-600 border border-red-200 rounded-tl-none'
                        : 'bg-white text-foreground rounded-tl-none border border-border/30'
                    }`}>
                      {msg.text}
                    </div>
                  )}
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
                onChange={(e) => setInput(e.target.value)}
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
              <span className="text-[8px] font-black uppercase tracking-widest">Powered by MedBot AI</span>
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
