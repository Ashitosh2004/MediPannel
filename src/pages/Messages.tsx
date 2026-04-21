import React, { useState, useEffect, useRef } from 'react';
import { 
  Button, 
  Input, 
  Badge,
} from '@blinkdotnew/ui';
import { 
  Send, 
  Search, 
  Phone, 
  Video, 
  Info, 
  Image as ImageIcon, 
  Paperclip, 
  Smile,
  CheckCheck,
  Clock,
  MessageCircle,
  Stethoscope,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, limit, getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { notifyNewMessage } from '../lib/notifications';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface Doctor {
  id: string;
  uid?: string;
  name: string;
  specialty: string;
  status?: string;
  profileImage?: string;
  email?: string;
}

export function Messages() {
  const { user, userData } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Real-time doctors list from Firestore ─────────────────────────────────
  useEffect(() => {
    // Simple collection query without orderBy to avoid composite index requirement.
    // We sort client-side by name for consistent display.
    const unsub = onSnapshot(
      collection(db, 'doctors'),
      (snap) => {
        const activeDoctors = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Doctor))
          // Deduplicate by email — only show one entry per doctor
          .filter((d, i, arr) => d.email ? arr.findIndex(x => x.email === d.email) === i : true)
          // Only active doctors
          .filter(d => d.status !== 'suspended')
          // Prefer the record with a real uid set
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setDoctors(activeDoctors);
        setDoctorsLoading(false);
      },
      (err) => {
        if (err.code !== 'permission-denied') {
          console.warn('Doctors listener error:', err.message);
        }
        setDoctors([]);
        setDoctorsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ── Real-time messages — query by BOTH possible conversation IDs ──────────
  // The doctor's uid in Firestore may be '' (not yet logged in) OR their Firebase Auth UID.
  // Messages are stored with the conversationId built from [patient.uid, doctor.uid].sort().
  // We query both possible IDs and deduplicate.
  useEffect(() => {
    if (!user || !selectedDoctor) return;

    setLoading(true);
    setMessages([]);

    // Build possible conversation IDs
    const possibleIds: string[] = [];
    // 1) Always include doc ID fallback
    possibleIds.push([user.uid, selectedDoctor.id].sort().join('_'));
    // 2) If doctor has a real UID and it differs from doc ID, include that too
    if (selectedDoctor.uid && selectedDoctor.uid !== '' && selectedDoctor.uid !== selectedDoctor.id) {
      possibleIds.push([user.uid, selectedDoctor.uid].sort().join('_'));
    }

    const uniqueIds = [...new Set(possibleIds)];

    // Map to track all messages deduplicated by document ID
    const msgMap = new Map<string, any>();
    let activeListeners = uniqueIds.length;
    let resolved = 0;

    const unsubscribers: (() => void)[] = [];

    uniqueIds.forEach(convId => {
      const q = query(
        collection(db, 'messages'),
        where('conversationId', '==', convId),
        limit(100)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          snapshot.docs.forEach(msgDoc => {
            msgMap.set(msgDoc.id, { id: msgDoc.id, ...msgDoc.data() });
          });
          // Sort by timestamp and update state
          const sorted = Array.from(msgMap.values()).sort((a, b) => {
            const aMs = a.timestamp?.toMillis?.() ?? 0;
            const bMs = b.timestamp?.toMillis?.() ?? 0;
            return aMs - bMs;
          });
          setMessages(sorted);
          setLoading(false);
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        },
        (err) => {
          if (err.code !== 'permission-denied') {
            console.warn('Messages listener error:', err.message);
          }
          setLoading(false);
        }
      );
      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(u => u());
  }, [user, selectedDoctor]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDoctor || !newMessage.trim()) return;

    // Use doctor's Firebase UID if available, otherwise fall back to doc ID
    const doctorId = selectedDoctor.uid && selectedDoctor.uid !== '' ? selectedDoctor.uid : selectedDoctor.id;
    const conversationId = [user.uid, doctorId].sort().join('_');
    const text = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'messages'), {
        conversationId,
        senderId: user.uid,
        senderName: userData?.name || user.email || 'Patient',
        receiverId: doctorId,
        receiverName: selectedDoctor.name || 'Doctor',
        text,
        timestamp: serverTimestamp(),
        read: false,
      });
      await notifyNewMessage(doctorId, userData?.name || user.email || 'A patient');
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        toast.error('Configure Firestore rules to enable messaging.');
      } else {
        toast.error('Failed to send message');
      }
    }
  };

  const filteredDoctors = doctors.filter(d =>
    !search ||
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.specialty?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-12rem)] min-h-[500px] flex gap-6 animate-in fade-in duration-700">
      {/* Sidebar List */}
      <div className={`w-full lg:w-96 flex flex-col glass-card border-none overflow-hidden ${selectedDoctor ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-6 border-b border-border/40 bg-white/30 space-y-4">
           <h2 className="text-xl font-black text-foreground tracking-tight">Messages</h2>
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search providers..."
                className="pl-12 h-12 bg-white/50 border-border/50 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
              />
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#f8fafc]/30">
          {doctorsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full" />
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <Stethoscope size={28} className="text-muted-foreground/30 mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">No doctors available</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Doctors added by admin will appear here</p>
            </div>
          ) : (
            filteredDoctors.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedDoctor(doc)}
                className={`w-full p-4 flex items-center gap-4 rounded-2xl transition-all duration-300 relative group overflow-hidden ${
                  selectedDoctor?.id === doc.id 
                  ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]' 
                  : 'bg-white hover:bg-accent hover:translate-x-1 border border-border/30 hover:shadow-md'
                }`}
              >
                <div className="relative shrink-0">
                  {/* Simple avatar — avoids @blinkdotnew/ui prop errors */}
                  <div className="h-12 w-12 rounded-full border-2 border-white/20 overflow-hidden flex items-center justify-center bg-primary text-white font-bold text-base shrink-0">
                    {doc.profileImage
                      ? <img src={doc.profileImage} alt={doc.name} className="h-full w-full object-cover" />
                      : doc.name?.charAt(0)?.toUpperCase() || 'D'
                    }
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white bg-green-500" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                     <h3 className={`font-bold truncate ${selectedDoctor?.id === doc.id ? 'text-white' : 'text-foreground'}`}>{doc.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                     <span className={`text-[10px] font-bold truncate uppercase tracking-widest ${selectedDoctor?.id === doc.id ? 'text-white/60' : 'text-primary'}`}>{doc.specialty}</span>
                  </div>
                </div>
                {selectedDoctor?.id === doc.id && (
                  <div className="absolute right-0 top-0 h-full w-1 bg-white/20"></div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col glass-card border-none overflow-hidden h-full ${!selectedDoctor ? 'hidden lg:flex' : 'flex'}`}>
        {selectedDoctor ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-border/40 bg-white/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedDoctor(null)} 
                  className="lg:hidden rounded-full hover:bg-accent"
                >
                  <ChevronLeft size={20} />
                </Button>
                <div className="relative">
                  <div className="h-11 w-11 rounded-full border-2 border-primary/10 overflow-hidden flex items-center justify-center bg-primary text-white font-bold text-base shrink-0">
                    {selectedDoctor.profileImage
                      ? <img src={selectedDoctor.profileImage} alt={selectedDoctor.name} className="h-full w-full object-cover" />
                      : selectedDoctor.name?.charAt(0)?.toUpperCase() || 'D'
                    }
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-green-500 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-foreground leading-tight">{selectedDoctor.name}</span>
                  <div className="flex items-center gap-1.5">
                     <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">{selectedDoctor.specialty}</span>
                     <span className="text-[10px] text-muted-foreground/60">•</span>
                     <span className="text-[10px] font-bold text-muted-foreground/80">Available</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                  <Phone size={18} />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                  <Video size={18} />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                  <Info size={18} />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-gradient-to-b from-white/30 to-[#f8fafc]/50">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full" />
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg, i) => {
                  const isOwn = msg.senderId === user?.uid;
                  const prevMsg = messages[i - 1];
                  const showDate = i === 0 || (
                    prevMsg?.timestamp && msg.timestamp &&
                    format(prevMsg.timestamp.toDate?.() || new Date(), 'yyyy-MM-dd') !== 
                    format(msg.timestamp.toDate?.() || new Date(), 'yyyy-MM-dd')
                  );
                  
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-6">
                           <span className="text-[10px] font-black uppercase tracking-widest bg-muted/50 px-4 py-1.5 rounded-full text-muted-foreground/80 shadow-sm border border-border/30">
                              {msg.timestamp ? format(msg.timestamp.toDate(), 'MMMM dd, yyyy') : 'Today'}
                           </span>
                        </div>
                      )}
                      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`max-w-[75%] space-y-1.5 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div className={`px-5 py-3.5 rounded-3xl shadow-sm text-sm font-medium leading-relaxed relative ${
                            isOwn 
                            ? 'bg-primary text-white rounded-tr-none' 
                            : 'bg-white text-foreground rounded-tl-none border border-border/30'
                          }`}>
                            {msg.text}
                          </div>
                          <div className="flex items-center gap-1.5 px-1">
                             <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                {msg.timestamp ? format(msg.timestamp.toDate(), 'h:mm a') : '...'}
                             </span>
                             {isOwn && (
                               <div className="flex text-primary">
                                 <CheckCheck size={10} strokeWidth={3} />
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-6">
                   <div className="bg-primary/10 w-24 h-24 rounded-[2rem] flex items-center justify-center animate-bounce shadow-inner">
                      <MessageCircle className="text-primary w-12 h-12" />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-xl font-black text-foreground">Start the conversation!</h3>
                      <p className="text-sm font-medium text-muted-foreground max-w-xs leading-relaxed">
                        Say hello to {selectedDoctor.name?.split(' ')[0]} and discuss your health concerns in real-time.
                      </p>
                   </div>
                   <div className="flex gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-500 border-none px-3 py-1 font-bold">Health Question</Badge>
                      <Badge variant="outline" className="bg-green-50 text-green-500 border-none px-3 py-1 font-bold">Prescription Inquiry</Badge>
                   </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-border/40 sticky bottom-0 z-10">
              <div className="flex items-center gap-3 p-2 bg-[#f8fafc] rounded-2xl ring-1 ring-border/50 focus-within:ring-primary/20 focus-within:bg-white transition-all duration-300 shadow-sm">
                <Button variant="ghost" size="icon" type="button" className="rounded-xl h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                  <Paperclip size={18} />
                </Button>
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-foreground py-2 h-10 outline-none"
                />
                <Button variant="ghost" size="icon" type="button" className="rounded-xl h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all hidden sm:flex">
                  <Smile size={18} />
                </Button>
                <Button variant="ghost" size="icon" type="button" className="rounded-xl h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all hidden sm:flex">
                  <ImageIcon size={18} />
                </Button>
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim()} 
                  className="rounded-xl h-10 w-10 flex items-center justify-center p-0 shadow-lg shadow-primary/20 disabled:shadow-none disabled:opacity-50 transition-all active:scale-90"
                >
                  <Send size={18} />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-8 bg-white/20">
             <div className="relative">
                <div className="bg-primary/5 w-40 h-40 rounded-full flex items-center justify-center animate-in zoom-in-50 duration-1000">
                   <div className="bg-white w-32 h-32 rounded-full shadow-2xl flex items-center justify-center">
                      <Stethoscope className="text-primary w-16 h-16" />
                   </div>
                </div>
                <div className="absolute -top-4 -right-4 bg-green-500 text-white p-3 rounded-2xl shadow-xl shadow-green-500/20 animate-bounce">
                   <MessageCircle size={24} />
                </div>
             </div>
             <div className="space-y-3 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <h3 className="text-2xl font-black text-foreground tracking-tight">Direct Access to Your Providers</h3>
                <p className="text-muted-foreground font-medium leading-relaxed">
                   Select a medical professional from the list on the left to start a secure, real-time consultation.
                </p>
             </div>
             <div className="grid grid-cols-2 gap-4 w-full max-w-md animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
                <div className="glass-card p-4 text-left space-y-2 hover:bg-white/50 cursor-default transition-all">
                   <div className="text-primary bg-primary/10 p-2 rounded-lg w-fit"><Check size={16} strokeWidth={3} /></div>
                   <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">Secure Chat</h4>
                   <p className="text-[10px] text-muted-foreground font-medium">Fully encrypted end-to-end communication.</p>
                </div>
                <div className="glass-card p-4 text-left space-y-2 hover:bg-white/50 cursor-default transition-all">
                   <div className="text-green-500 bg-green-500/10 p-2 rounded-lg w-fit"><Clock size={16} strokeWidth={3} /></div>
                   <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">Quick Response</h4>
                   <p className="text-[10px] text-muted-foreground font-medium">Average response time under 2 hours.</p>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
