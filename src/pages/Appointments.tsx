import React, { useState, useEffect } from 'react';
import { 
  Page, 
  PageHeader, 
  PageTitle, 
  PageDescription, 
  PageActions, 
  PageBody, 
  Button, 
  DataTable, 
  Badge, 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Field,
  FieldLabel,
  FieldError,
  EmptyState,
  StatGroup,
  Stat,
  Persona,
  Banner
} from '@blinkdotnew/ui';
import { 
  Plus, 
  Calendar, 
  Clock, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Stethoscope,
  Trash2,
  CalendarDays,
  Phone
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { notifyAppointmentBooked, notifyAppointmentCancelled } from '../lib/notifications';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Backend URL — update this if you restart ngrok
const BACKEND_URL = 'https://catnap-employed-causal.ngrok-free.dev';

const appointmentSchema = z.object({
  doctorId: z.string().min(1, 'Please select a doctor'),
  date: z.string().min(1, 'Please select a date'),
  time: z.string().min(1, 'Please select a time'),
});

type AppointmentForm = z.infer<typeof appointmentSchema>;

interface FirestoreDoctor {
  id: string;
  name: string;
  specialty: string;
  status?: string;
  uid?: string;
  profileImage?: string;
}

export function Appointments() {
  const { user, userData } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // ✅ Real doctors fetched from Firestore — NO hardcoded mock data
  const [doctors, setDoctors] = useState<FirestoreDoctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCallingBack, setIsCallingBack] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
  });

  // ── Real-time doctors list from Firestore ─────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'doctors'), orderBy('name', 'asc')),
      (snap) => {
        const activeDoctors = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as FirestoreDoctor))
          .filter(d => d.status !== 'suspended');
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

  // ── Real-time appointments for this patient ───────────────────────────────
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      query(
        collection(db, 'appointments'),
        where('userId', '==', user.uid)
      ),
      (snapshot) => {
        const sorted = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (a.date > b.date ? -1 : 1));
        setAppointments(sorted);
        setLoading(false);
      },
      (err) => {
        if (err.code !== 'permission-denied') {
          console.warn('Appointments listener error:', err.message);
        }
        setAppointments([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const onSubmit = async (data: AppointmentForm) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // Find the selected doctor from real Firestore data
      const doctor = doctors.find(d => d.id === data.doctorId);
      if (!doctor) {
        toast.error('Selected doctor not found. Please try again.');
        return;
      }
      await addDoc(collection(db, 'appointments'), {
        userId: user.uid,
        patientName: userData?.name || user.email || 'Patient',
        patientEmail: user.email || '',
        // Always use Firebase Auth UID as primary doctorId (doctor queries by authUID)
        // Fall back to Firestore doc ID if UID not synced yet
        doctorId: doctor.uid && doctor.uid !== '' ? doctor.uid : doctor.id,
        // Also store the Firestore doc ID so legacy queries still work
        doctorDocId: doctor.id,
        doctorUid: doctor.uid || '',
        doctorName: doctor.name,
        specialty: doctor.specialty,
        date: data.date,
        time: data.time,
        status: 'upcoming',
        createdAt: serverTimestamp(),
      });
      // Notify using doctor.uid if available, otherwise doctor.id (Firestore doc id)
      const notifyId = doctor.uid || doctor.id;
      await notifyAppointmentBooked(notifyId, userData?.name || user.email || 'A patient');
      toast.success('Appointment booked successfully!');
      setIsModalOpen(false);
      reset();
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'permission-denied') {
        toast.error('Permission denied. Please check Firestore rules.');
      } else {
        toast.error('Failed to book appointment');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const appt = appointments.find(a => a.id === id);
      await updateDoc(doc(db, 'appointments', id), { status: 'cancelled' });
      if (appt?.doctorUid || appt?.doctorId) {
        const notifyId = appt.doctorUid || appt.doctorId;
        await notifyAppointmentCancelled(notifyId, userData?.name || user?.email || 'A patient');
      }
      toast.success('Appointment cancelled');
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel appointment');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', id));
      toast.success('Appointment deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete appointment');
    }
  };

  // ── Request a callback from the hospital via Twilio ──────────────────────
  const handleGetCall = async () => {
    if (!user) {
      toast.error('You must be logged in to request a call.');
      return;
    }

    // Patient must have a phone number saved in their profile
    let phone = userData?.phone?.trim();
    if (!phone) {
      toast.error('No phone number found. Please add your phone number in Profile settings first.');
      return;
    }

    // Normalize to E.164: if Indian number without +91, add it
    if (!phone.startsWith('+')) {
      phone = phone.startsWith('91') ? `+${phone}` : `+91${phone}`;
    }

    setIsCallingBack(true);
    try {
      // Get a fresh Firebase ID token to authenticate with the backend
      const idToken = await user.getIdToken(true);

      console.log('[GetCall] Calling backend:', BACKEND_URL, '| phone:', phone);

      const res = await fetch(`${BACKEND_URL}/start-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          // Required to bypass ngrok's browser-warning interstitial page
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ patient_phone: phone }),
      });

      const responseText = await res.text();
      console.log('[GetCall] Backend response:', res.status, responseText);

      if (!res.ok) {
        let errMsg = 'Unknown error';
        try { errMsg = JSON.parse(responseText)?.error || errMsg; } catch {}
        throw new Error(errMsg || `Server error: ${res.status}`);
      }

      toast.success('📞 Call incoming! Pick up your phone — our AI reception is calling you now.');
    } catch (err: any) {
      console.error('[GetCall] Failed:', err);
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        toast.error('Cannot reach the backend. Is the server running and ngrok active?');
      } else {
        toast.error(`Call failed: ${err.message}`);
      }
    } finally {
      setIsCallingBack(false);
    }
  };

  const columns = [
    { 
      accessorKey: 'doctorName', 
      header: 'Doctor',
      cell: ({ row }: any) => (
        <Persona 
          name={row.original.doctorName} 
          subtitle={row.original.specialty} 
        />
      )
    },
    { 
      accessorKey: 'date', 
      header: 'Date',
      cell: ({ row }: any) => (
        <div className="font-medium">{format(new Date(row.original.date), 'MMM dd, yyyy')}</div>
      )
    },
    { 
      accessorKey: 'time', 
      header: 'Time',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2 text-muted-foreground font-medium">
          <Clock size={14} />
          <span>{row.original.time}</span>
        </div>
      )
    },
    { 
      accessorKey: 'status', 
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.original.status;
        return (
          <Badge 
            variant="outline" 
            className={`rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-wider border-none ${
              status === 'upcoming' ? 'bg-primary/10 text-primary' :
              status === 'completed' ? 'bg-green-500/10 text-green-600' :
              'bg-destructive/10 text-destructive'
            }`}
          >
            {status}
          </Badge>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <div className="flex justify-end gap-2">
           {row.original.status === 'upcoming' && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleCancel(row.original.id)}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg"
              >
                Cancel
              </Button>
           )}
           <Button 
             variant="ghost" 
             size="sm" 
             onClick={() => handleDelete(row.original.id)}
             className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg"
           >
             <Trash2 size={16} />
           </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Appointments</h1>
          <p className="text-muted-foreground font-medium mt-1">Manage and book your medical visits.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95 flex items-center gap-2">
          <Plus size={18} />
          <span>Book New Visit</span>
        </Button>
      </div>

      <StatGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Stat 
          label="Total Bookings" 
          value={appointments.length.toString()} 
          icon={<Calendar size={20} className="text-primary" />}
          className="glass-card border-none p-6"
        />
        <Stat 
          label="Confirmed" 
          value={appointments.filter(a => a.status === 'upcoming').length.toString()} 
          icon={<CheckCircle2 size={20} className="text-green-500" />}
          className="glass-card border-none p-6"
        />
        <Stat 
          label="Cancelled" 
          value={appointments.filter(a => a.status === 'cancelled').length.toString()} 
          icon={<XCircle size={20} className="text-destructive" />}
          className="glass-card border-none p-6"
        />
      </StatGroup>

      <div className="glass-card border-none overflow-hidden">
        <div className="p-8 border-b border-border/40 bg-white/30">
          <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Appointment History</h3>
              <div className="relative w-64 hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input placeholder="Search appointments..." className="pl-10 h-10 rounded-xl bg-white/50 border-border/50" />
              </div>
            </div>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-20 text-center">
              <div className="animate-spin h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground font-medium">Loading records...</p>
            </div>
          ) : appointments.length > 0 ? (
            <DataTable columns={columns} data={appointments} />
          ) : (
            <EmptyState 
              icon={<CalendarDays size={48} className="text-muted-foreground/30" />}
              title="No Appointments Found"
              description="Your appointment list is empty. Start by booking a new visit."
              action={{ label: 'Book First Appointment', onClick: () => setIsModalOpen(true) }}
              className="py-20"
            />
          )}
        </div>
      </div>

      {/* @ts-ignore */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        {/* @ts-ignore */}
        <DialogContent>
          <div className="bg-primary/5 p-8 border-b border-primary/10">
            {/* @ts-ignore */}
            <DialogHeader>
              {/* @ts-ignore */}
              <DialogTitle>
                <Calendar className="w-6 h-6" />
                Book Appointment
              </DialogTitle>
              {/* @ts-ignore */}
              <DialogDescription>
                Fill in the details to schedule your next medical visit.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
            <Field>
              <FieldLabel className="text-foreground/80 font-bold mb-1.5 ml-1">Select Doctor</FieldLabel>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none group-focus-within:text-primary">
                  <Stethoscope size={18} />
                </div>
                {/* @ts-ignore */}
                <Select onValueChange={(val) => setValue('doctorId', val)} disabled={doctorsLoading}>
                  {/* @ts-ignore */}
                  <SelectTrigger>
                    <SelectValue placeholder={doctorsLoading ? 'Loading doctors...' : doctors.length === 0 ? 'No doctors available' : 'Choose a specialist'} />
                  </SelectTrigger>
                  {/* @ts-ignore */}
                  <SelectContent>
                    {doctors.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No doctors added yet. Ask your admin to add doctors.
                      </div>
                    ) : (
                      doctors.map(d => {
                        return (
                          // @ts-ignore
                          <SelectItem key={d.id} value={d.id}>
                            <div className="flex flex-col">
                              <span className="font-bold">{d.name}</span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{d.specialty}</span>
                            </div>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
              {errors.doctorId && <FieldError className="mt-1 ml-1">{errors.doctorId.message}</FieldError>}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel className="text-foreground/80 font-bold mb-1.5 ml-1">Date</FieldLabel>
                <div className="relative group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary">
                    <Calendar size={18} />
                   </div>
                   <Input 
                    type="date" 
                    {...register('date')} 
                    className="pl-12 h-14 bg-white/50 border-border/50 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                   />
                </div>
                {errors.date && <FieldError className="mt-1 ml-1">{errors.date.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel className="text-foreground/80 font-bold mb-1.5 ml-1">Time</FieldLabel>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary">
                    <Clock size={18} />
                  </div>
                  <Input 
                    type="time" 
                    {...register('time')} 
                    className="pl-12 h-14 bg-white/50 border-border/50 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  />
                </div>
                {errors.time && <FieldError className="mt-1 ml-1">{errors.time.message}</FieldError>}
              </Field>
            </div>

            <div className="bg-blue-500/5 rounded-2xl p-4 border border-blue-500/10 flex items-start gap-3">
               <AlertCircle className="text-blue-500 mt-0.5" size={16} />
               <p className="text-[11px] font-medium text-blue-600/80 leading-relaxed">
                 By booking, you agree to our appointment policy. Cancellations must be made at least 24 hours in advance.
               </p>
            </div>

            {/* Get Call button — Twilio calls the patient back (bypasses Indian→US dialing issue) */}
            <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10 space-y-3">
              <p className="text-[11px] font-bold text-emerald-600/80 uppercase tracking-wider">Need to speak with reception?</p>
              <button
                type="button"
                onClick={handleGetCall}
                disabled={isCallingBack}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              >
                <Phone size={15} className={isCallingBack ? 'animate-spin' : 'animate-pulse'} />
                {isCallingBack ? 'Requesting call...' : 'Get Call from Hospital'}
              </button>
              <p className="text-[10px] text-emerald-600/60 leading-relaxed">
                Our AI receptionist will call your registered phone number immediately.
                {!userData?.phone && (
                  <span className="block mt-1 text-amber-500/80 font-semibold">
                    ⚠ Please add your phone number in Profile settings first.
                  </span>
                )}
              </p>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl h-12 px-6 font-bold hover:bg-black/5">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || doctors.length === 0} className="rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95">
                {isSubmitting ? 'Booking...' : 'Confirm Appointment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}