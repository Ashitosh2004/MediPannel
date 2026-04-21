import React, { useState } from 'react';
import { 
  Button, 
  Input, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  Badge,
  Banner,
  Textarea,
  Field,
  FieldLabel,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Avatar,
  AvatarImage,
  AvatarFallback
} from '@blinkdotnew/ui';
import { 
  Search, 
  MessageCircle, 
  Phone, 
  Mail, 
  FileText, 
  Send, 
  AlertCircle,
  LifeBuoy,
  ShieldCheck,
  Stethoscope,
  Activity,
  Calendar,
  Pill,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

export function Help() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const faqs = [
    { 
      question: 'How do I book an appointment?', 
      answer: 'Navigate to the Appointments page and click "Book New Visit". Select your doctor, preferred date, and time to confirm.',
      icon: <Calendar className="text-primary" size={18} />
    },
    { 
      question: 'Can I download my records?', 
      answer: 'Yes. Go to Medical Records and click "View" next to any document to open or download it as a PDF.',
      icon: <FileText className="text-indigo-500" size={18} />
    },
    { 
      question: 'Is my data secure?', 
      answer: 'MedPanel Pro uses end-to-end encryption and follows strict HIPAA guidelines to ensure your data is always protected.',
      icon: <Lock className="text-green-500" size={18} />
    },
    { 
      question: 'How do I request a prescription refill?', 
      answer: 'Visit the Prescriptions page and click "Refill Request". Your doctor will review and respond within 24 hours.',
      icon: <Pill className="text-amber-500" size={18} />
    },
    { 
      question: 'How do I message my doctor?', 
      answer: 'Click "Messages" in the sidebar, select your provider from the list, and start a real-time secure chat.',
      icon: <MessageCircle className="text-primary" size={18} />
    },
    { 
      question: 'How do I change my password?', 
      answer: 'Go to Settings → Security tab → Change Password. Enter your current password and confirm the new one.',
      icon: <Lock className="text-rose-500" size={18} />
    },
  ];

  const handleSubmitTicket = async () => {
    if (!user || !subject.trim() || !message.trim()) {
      toast.error('Please fill in subject and message.');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'support_tickets'), {
        userId: user.uid,
        subject: subject.trim(),
        message: message.trim(),
        status: 'open',
        createdAt: serverTimestamp(),
      });
      toast.success('Support ticket submitted!');
      setIsModalOpen(false);
      setSubject('');
      setMessage('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div className="max-w-xl space-y-2">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Help Center</h1>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Need assistance with MedPanel Pro? Browse the FAQs or contact our support team.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input placeholder="Search help topics..." className="pl-10 h-11 bg-background border-border rounded-xl text-sm" />
        </div>
      </div>

      {/* Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 overflow-hidden">
          <CardContent className="p-7 space-y-5">
            <div className="bg-primary-foreground/15 p-3.5 rounded-2xl w-fit">
              <MessageCircle size={28} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black">Live Support</h3>
              <p className="text-primary-foreground/75 font-medium text-sm leading-relaxed">
                Chat with our technical support team for immediate assistance with the portal.
              </p>
            </div>
            <Button 
              onClick={() => setIsModalOpen(true)} 
              className="w-full h-12 bg-primary-foreground text-primary font-bold rounded-xl hover:bg-primary-foreground/90 active:scale-95 transition-all shadow-md border-0"
            >
              Start Live Chat
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm overflow-hidden">
          <CardContent className="p-7 space-y-5">
            <div className="bg-primary/10 p-3.5 rounded-2xl w-fit text-primary">
              <Phone size={28} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-foreground">Call Us</h3>
              <p className="text-muted-foreground font-medium text-sm leading-relaxed">
                Prefer talking? Our patient helpline is available around the clock.
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-base font-black text-primary">+1 (800) MED-HELP</div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Toll-free • 24/7</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm overflow-hidden">
          <CardContent className="p-7 space-y-5">
            <div className="bg-primary/10 p-3.5 rounded-2xl w-fit text-primary">
              <Mail size={28} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-foreground">Email Support</h3>
              <p className="text-muted-foreground font-medium text-sm leading-relaxed">
                Send us a detailed inquiry and we'll reply within 4 business hours.
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-base font-black text-primary">support@medpanel.pro</div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Avg. response: 4 hours</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl text-primary">
              <LifeBuoy size={20} />
            </div>
            <h2 className="text-xl font-black text-foreground tracking-tight">Frequently Asked Questions</h2>
          </div>
          <Button 
            onClick={() => setIsModalOpen(true)} 
            variant="outline" 
            size="sm"
            className="rounded-xl border-border text-primary hover:bg-primary/5 hover:border-primary/40 font-bold text-xs"
          >
            Ask a Question
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {faqs.map((faq, i) => (
            <Card key={i} className="border border-border bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="bg-muted p-3 rounded-xl h-fit shrink-0">
                    {faq.icon}
                  </div>
                  <div className="space-y-2 min-w-0">
                    <h4 className="text-sm font-bold text-foreground leading-tight">{faq.question}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom Banner */}
      <div className="bg-muted/40 border border-border rounded-3xl p-7 md:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge className="bg-primary/10 text-primary border-transparent rounded-full px-4 py-1.5 font-bold text-[10px] tracking-widest uppercase hover:bg-primary/20">
                24/7 Support
              </Badge>
              <h2 className="text-2xl md:text-3xl font-black text-foreground leading-tight tracking-tight">
                Need personalized technical help?
              </h2>
              <p className="text-muted-foreground font-medium leading-relaxed">
                Our dedicated support team can help you troubleshoot any portal issue in real-time via a secure ticket.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-background p-2.5 rounded-xl shadow-sm ring-1 ring-border">
                  <ShieldCheck className="text-primary" size={18} />
                </div>
                <span className="text-sm font-bold text-foreground">Secure & Private</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-background p-2.5 rounded-xl shadow-sm ring-1 ring-border">
                  <Activity className="text-primary" size={18} />
                </div>
                <span className="text-sm font-bold text-foreground">Real-time Status</span>
              </div>
            </div>
            <Button 
              onClick={() => setIsModalOpen(true)} 
              className="h-12 px-7 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all flex items-center gap-2"
            >
              <MessageCircle size={18} />
              <span>Submit a Ticket</span>
            </Button>
          </div>

          <div className="hidden lg:block">
            <Card className="border border-border bg-card shadow-xl p-7">
              <div className="space-y-5">
                <div className="flex gap-4 items-center">
                  <Avatar className="h-13 w-13 ring-2 ring-primary/10 border-2 border-background">
                    <AvatarImage src="https://images.unsplash.com/photo-1559839734-2b71f1536783?auto=format&fit=crop&q=80&w=200" />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">SJ</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Dr. Sarah Johnson</h4>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Medical Support Lead</p>
                  </div>
                </div>
                <div className="bg-muted/50 p-5 rounded-2xl space-y-3">
                  {['24/7 Patient Concierge', 'Integrated Video Consults', 'Universal Health Records'].map(item => (
                    <div key={item} className="flex items-center gap-3 text-sm font-semibold text-foreground">
                      <CheckCircle2 size={16} className="text-primary shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Support Ticket Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl border border-border shadow-2xl bg-card p-0 overflow-hidden">
          <div className="bg-primary/5 p-7 border-b border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-foreground flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-xl text-primary">
                  <MessageCircle className="w-5 h-5" />
                </div>
                Submit Support Ticket
              </DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium mt-1 text-sm">
                Describe your issue and our team will respond within 4 hours.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-7 space-y-5">
            <Field>
              <FieldLabel className="text-foreground font-semibold mb-1.5">Subject</FieldLabel>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  <AlertCircle size={16} />
                </div>
                <Input 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  placeholder="e.g. Issue with appointment booking" 
                  className="pl-10 h-12 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                />
              </div>
            </Field>

            <Field>
              <FieldLabel className="text-foreground font-semibold mb-1.5">Message</FieldLabel>
              <Textarea 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                placeholder="Describe your issue in detail..." 
                className="min-h-[130px] bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl p-4 resize-none text-sm"
              />
            </Field>

            <Banner variant="info" className="rounded-xl border-none bg-blue-500/5 text-blue-600">
              <div className="flex gap-2.5 p-1">
                <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                  For medical emergencies, call 911 immediately. This form is for portal support only.
                </p>
              </div>
            </Banner>
          </div>

          <DialogFooter className="px-7 pb-7 pt-0 gap-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl h-11 px-5 font-bold hover:bg-muted">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitTicket} 
              disabled={loading || !subject.trim() || !message.trim()} 
              className="rounded-xl h-11 px-7 font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Submit Ticket</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
