import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, addDoc, serverTimestamp
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { doctorResetActionSettings } from '../../lib/emailActionSettings';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { writeAuditLog } from '../lib/auditLog';
import { notifySystemUpdate } from '../../lib/notifications';
import { createSecondaryAuthAccount } from '../lib/adminAuthHelper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import {
  Button, Input, Field, FieldLabel, FieldError, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  DataTable, EmptyState, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Banner
} from '@blinkdotnew/ui';
import { Plus, Stethoscope, Mail, User, Trash2, PauseCircle, PlayCircle, Search, ShieldAlert, CheckCircle2 } from 'lucide-react';

const SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics', 'Neurology',
  'Orthopedics', 'Gynecology', 'Ophthalmology', 'Psychiatry', 'Radiology',
  'Emergency Medicine', 'Oncology', 'Urology', 'ENT', 'Endocrinology',
];

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  specialty: z.string().min(1, 'Please select a specialty'),
});
type FormData = z.infer<typeof schema>;

export function DoctorManagement() {
  const { adminData } = useAdminAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'doctors'), orderBy('createdAt', 'desc')),
      (snap) => { setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { if (err.code !== 'permission-denied') console.error('Doctors error:', err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const onSubmit = async (data: FormData) => {
    if (!adminData) return;
    setIsSubmitting(true);
    setSuccessEmail(null);
    try {
      // Step 1: Create the Firebase Auth User using the secondary app helper.
      // This ensures they EXIST in Firebase Auth so sendPasswordResetEmail works,
      // all without logging out the currently active Admin session.
      const newUid = await createSecondaryAuthAccount(data.email);

      // Step 2: Create Firestore doctor record using the newly assigned UID
      const docRef = await addDoc(collection(db, 'doctors'), {
        uid: newUid || '', // Will be '' if email somehow already existed
        name: data.name,
        email: data.email,
        specialty: data.specialty,
        role: 'doctor',
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: adminData.uid,
      });

      // Step 3: Send password-reset / welcome email so the doctor can set their password.
      // ActionCodeSettings redirect the doctor back to /doctor/login after they set their password.
      try {
        await sendPasswordResetEmail(auth, data.email, doctorResetActionSettings);
      } catch (emailErr: any) {
        console.warn('sendPasswordResetEmail failed (non-fatal):', emailErr.message);
      }

      // Step 3: Write audit log
      await writeAuditLog(adminData.uid, 'CREATE_DOCTOR', data.email, `Doctor "${data.name}" (${data.specialty}) created`);

      // Step 4: Notify admin of the creation
      await notifySystemUpdate(adminData.uid, 'Doctor Created', `Dr. ${data.name} (${data.specialty}) account was created.`);

      setSuccessEmail(data.email);
      toast.success(`Doctor "${data.name}" created! Share login instructions with them.`);
      reset();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create doctor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuspend = async (doctor: any) => {
    if (!adminData) return;
    const newStatus = doctor.status === 'suspended' ? 'active' : 'suspended';
    try {
      await updateDoc(doc(db, 'doctors', doctor.id), { status: newStatus, updatedAt: serverTimestamp() });
      await writeAuditLog(adminData.uid, newStatus === 'suspended' ? 'SUSPEND_DOCTOR' : 'UPDATE_DOCTOR', doctor.email, `Doctor "${doctor.name}" ${newStatus}`);
      // Notify the doctor if their uid is known
      if (doctor.uid) {
        await notifySystemUpdate(
          doctor.uid,
          newStatus === 'suspended' ? 'Account Suspended' : 'Account Reactivated',
          newStatus === 'suspended'
            ? 'Your account has been suspended by an administrator.'
            : 'Your account has been reactivated by an administrator.'
        );
      }
      toast.success(`Doctor ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}`);
    } catch (err) {
      console.error(err); toast.error('Failed to update doctor status');
    }
  };

  const handleDelete = async (doctor: any) => {
    if (!adminData) return;
    if (!confirm(`Permanently delete Dr. ${doctor.name}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'doctors', doctor.id));
      await writeAuditLog(adminData.uid, 'DELETE_DOCTOR', doctor.email, `Doctor "${doctor.name}" deleted`);
      toast.success('Doctor removed');
    } catch (err) {
      console.error(err); toast.error('Failed to delete doctor');
    }
  };

  const handleResendSetup = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(`Setup email re-sent to ${email}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
    }
  };

  const filtered = doctors.filter(d =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase()) || d.email?.toLowerCase().includes(search.toLowerCase()) || d.specialty?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      accessorKey: 'name', header: 'Doctor',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600/20 rounded-lg flex items-center justify-center text-emerald-400 font-black text-sm shrink-0">
            {row.original.name?.charAt(0) || 'D'}
          </div>
          <div>
            <div className="text-sm font-bold text-white">{row.original.name}</div>
            <div className="text-xs text-gray-500">{row.original.email}</div>
          </div>
        </div>
      )
    },
    { accessorKey: 'specialty', header: 'Specialty', cell: ({ row }: any) => <span className="text-sm text-gray-300">{row.original.specialty}</span> },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }: any) => {
        const s = row.original.status;
        return (
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${s === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {s || 'active'}
          </span>
        );
      }
    },
    {
      id: 'actions', header: '',
      cell: ({ row }: any) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => handleResendSetup(row.original.email)} className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Resend setup email">
            <Mail size={14} />
          </button>
          <button onClick={() => handleSuspend(row.original)} className={`p-1.5 rounded-lg transition-all ${row.original.status === 'suspended' ? 'text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:text-amber-400 hover:bg-amber-500/10'}`} title={row.original.status === 'suspended' ? 'Reactivate' : 'Suspend'}>
            {row.original.status === 'suspended' ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
          </button>
          <button onClick={() => handleDelete(row.original)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete doctor">
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white">Doctor Management</h1>
          <p className="text-gray-400 text-sm mt-0.5">Manage doctor accounts and onboarding.</p>
        </div>
        <button
          onClick={() => { setIsOpen(true); setSuccessEmail(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-red-600/20"
        >
          <Plus size={16} />
          <span>Add Doctor</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-2xl font-black text-white">{doctors.length}</div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Total</div>
        </div>
        <div className="bg-gray-900 border border-emerald-500/20 rounded-xl p-4">
          <div className="text-2xl font-black text-emerald-400">{doctors.filter(d => d.status !== 'suspended').length}</div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Active</div>
        </div>
        <div className="bg-gray-900 border border-red-500/20 rounded-xl p-4">
          <div className="text-2xl font-black text-red-400">{doctors.filter(d => d.status === 'suspended').length}</div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Suspended</div>
        </div>
        <div className="bg-gray-900 border border-blue-500/20 rounded-xl p-4">
          <div className="text-2xl font-black text-blue-400">{new Set(doctors.map(d => d.specialty)).size}</div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Specialties</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-sm font-bold text-white">All Doctors</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or specialty..."
              className="pl-9 h-9 bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 rounded-xl text-sm focus:outline-none focus:border-red-500 w-64"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-16 text-center text-gray-500 text-sm">
            <div className="animate-spin h-8 w-8 border-2 border-gray-700 border-t-red-500 rounded-full mx-auto mb-3" />
            Loading doctors...
          </div>
        ) : filtered.length > 0 ? (
          <div className="[&_table]:bg-transparent [&_thead]:bg-gray-800/50 [&_thead_th]:text-gray-400 [&_tbody_tr]:border-gray-800 [&_tbody_tr]:hover:bg-gray-800/50 [&_tbody_td]:text-gray-300">
            <DataTable columns={columns} data={filtered} />
          </div>
        ) : (
          <div className="p-16 text-center text-gray-500 text-sm">
            <Stethoscope size={32} className="mx-auto mb-3 text-gray-700" />
            <div className="font-semibold text-gray-400">No doctors found</div>
            <div className="text-xs mt-1">{search ? `No results for "${search}"` : 'Add your first doctor using the button above.'}</div>
          </div>
        )}
      </div>

      {/* Create Doctor Modal */}
      <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) { reset(); setSuccessEmail(null); } }}>
        <DialogContent className="sm:max-w-[520px] bg-gray-900 border border-gray-700 rounded-2xl p-0 shadow-2xl" placeholder={undefined} onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined}>
          <div className="bg-gray-800/60 border-b border-gray-700 p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-white flex items-center gap-3" placeholder={undefined} onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined}>
                <div className="bg-red-600 p-2 rounded-xl"><Stethoscope size={20} className="text-white" /></div>
                Add New Doctor
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-sm mt-1" placeholder={undefined} onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined}>
                Create a doctor account and automatically send them a secure password setup email.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-5">
            {successEmail ? (
              <div className="text-center py-8 space-y-5 animate-in zoom-in-95">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Doctor Created!</h3>
                  <p className="text-gray-400 text-sm mt-1">Account ready for:</p>
                  <p className="text-emerald-400 font-bold mt-1">{successEmail}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-left space-y-2 text-xs text-gray-400">
                  <p className="font-bold text-gray-300">Share these onboarding steps with the doctor:</p>
                  <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold">1.</span> Go to <span className="text-white font-semibold">/doctor/login</span> and click "Forgot password?"</div>
                  <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold">2.</span> Enter their email address to receive a password reset link</div>
                  <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold">3.</span> Click the link in the email to set their new password</div>
                  <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold">4.</span> Sign in to the Doctor Portal with email + new password</div>
                </div>
                <button onClick={() => { setSuccessEmail(null); reset(); }} className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl text-sm transition-all">
                  Add Another Doctor
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Field>
                  <FieldLabel className="text-gray-300 font-semibold text-sm mb-1.5">Full Name</FieldLabel>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"><User size={16} /></div>
                    <Input {...register('name')} placeholder="Dr. John Smith" className="pl-10 h-11 bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 focus:border-red-500 rounded-xl" />
                  </div>
                  {errors.name && <FieldError className="mt-1 text-red-400">{errors.name.message}</FieldError>}
                </Field>

                <Field>
                  <FieldLabel className="text-gray-300 font-semibold text-sm mb-1.5">Email Address</FieldLabel>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"><Mail size={16} /></div>
                    <Input {...register('email')} type="email" placeholder="doctor@hospital.com" className="pl-10 h-11 bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 focus:border-red-500 rounded-xl" />
                  </div>
                  {errors.email && <FieldError className="mt-1 text-red-400">{errors.email.message}</FieldError>}
                </Field>

                <Field>
                  <FieldLabel className="text-gray-300 font-semibold text-sm mb-1.5">Specialty</FieldLabel>
                  <Select onValueChange={(v) => setValue('specialty', v)}>
                    <SelectTrigger className="h-11 bg-gray-800 border-gray-700 text-white rounded-xl focus:border-red-500" placeholder={undefined} onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined}>
                      <SelectValue placeholder="Select specialty..." className="text-gray-600" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700" placeholder={undefined} onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined}>
                      {SPECIALTIES.map(s => (
                        <SelectItem key={s} value={s} className="text-white hover:bg-gray-700 focus:bg-gray-700" placeholder={undefined} onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.specialty && <FieldError className="mt-1 text-red-400">{errors.specialty.message}</FieldError>}
                </Field>

                <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 flex gap-3">
                  <ShieldAlert size={16} className="text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-400/80 leading-relaxed">
                    A password setup email will be automatically sent. <strong>Admin never sets passwords manually.</strong>
                  </p>
                </div>

                <DialogFooter className="pt-2">
                  <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-sm transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all active:scale-95 flex items-center gap-2">
                    {isSubmitting ? <><div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /><span>Creating...</span></> : <><Plus size={15} /><span>Create Doctor</span></>}
                  </button>
                </DialogFooter>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
