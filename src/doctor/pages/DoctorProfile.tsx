import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Edit3, Save, Shield, Info } from 'lucide-react';
import { format } from 'date-fns';

// ─── Schema ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  specialty: z.string().min(2, 'Specialty is required'),
  experience: z.string().min(1, 'Experience is required'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name?: string): string {
  if (!name) return 'DR';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatCreatedAt(ts: any): string {
  if (!ts) return '—';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return format(date, 'MMM dd, yyyy');
  } catch {
    return '—';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DoctorProfile() {
  const { doctorUser, doctorData, refreshDoctorData } = useDoctorAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: doctorData?.name ?? '',
      specialty: doctorData?.specialty ?? '',
      experience: doctorData?.experience ?? '',
      bio: '',
    },
  });

  const bioValue = watch('bio') ?? '';

  const onSubmit = async (data: ProfileFormData) => {
    if (!doctorUser) return;
    setLoading(true);
    try {
      const updateData = {
        name: data.name,
        specialty: data.specialty,
        experience: data.experience,
        ...(data.bio !== undefined && data.bio !== '' ? { bio: data.bio } : {}),
        updatedAt: serverTimestamp(),
      };

      // Update the main uid doc
      await updateDoc(doc(db, 'doctors', doctorUser.uid), updateData);

      // If there's an originalDocId (from admin creation), update that too
      if (doctorData?.originalDocId) {
        await updateDoc(doc(db, 'doctors', doctorData.originalDocId), updateData);
      }

      await refreshDoctorData();
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    reset({
      name: doctorData?.name ?? '',
      specialty: doctorData?.specialty ?? '',
      experience: doctorData?.experience ?? '',
      bio: '',
    });
    setIsEditing(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">My Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your professional information.</p>
      </div>

      {/* ── Profile header card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <User size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-700">Doctor Information</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-emerald-600 flex items-center justify-center text-white text-2xl font-bold shrink-0 select-none shadow-md">
              {getInitials(doctorData?.name)}
            </div>
            {/* Info */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h2 className="text-xl font-bold text-slate-800 truncate">
                {doctorData?.name ?? 'Doctor'}
              </h2>
              {doctorData?.specialty && (
                <span className="inline-block mt-1.5 bg-emerald-100 text-emerald-700 rounded-full px-3 py-1 text-sm font-semibold">
                  {doctorData.specialty}
                </span>
              )}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-slate-500">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{doctorData?.email ?? '—'}</span>
                </div>
                {doctorData?.experience && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-slate-500">
                    <Info size={14} className="text-slate-400 shrink-0" />
                    <span>{doctorData.experience} years of experience</span>
                  </div>
                )}
                <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-slate-500">
                  <Shield size={14} className="text-emerald-500 shrink-0" />
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold capitalize">
                    {doctorData?.role ?? 'doctor'}
                  </span>
                </div>
                {doctorData?.createdAt && (
                  <div className="text-xs text-slate-400">
                    Member since {formatCreatedAt(doctorData.createdAt)}
                  </div>
                )}
              </div>
            </div>
            {/* Edit toggle */}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors inline-flex items-center gap-2 shrink-0"
              >
                <Edit3 size={14} />
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit form ── */}
      {isEditing && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Edit3 size={16} className="text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-700">Edit Profile</h2>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <User size={16} />
                </div>
                <input
                  {...register('name')}
                  placeholder="Dr. Jane Smith"
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Specialty */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Specialty
              </label>
              <input
                {...register('specialty')}
                placeholder="e.g. Cardiology, Pediatrics..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
              {errors.specialty && (
                <p className="text-red-500 text-xs mt-1">{errors.specialty.message}</p>
              )}
            </div>

            {/* Experience */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Experience (years)
              </label>
              <input
                {...register('experience')}
                placeholder="e.g. 8"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
              {errors.experience && (
                <p className="text-red-500 text-xs mt-1">{errors.experience.message}</p>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Bio / About <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                {...register('bio')}
                rows={4}
                placeholder="Share a brief professional biography..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1 text-right">
                {bioValue.length}/500
              </p>
              {errors.bio && (
                <p className="text-red-500 text-xs mt-1">{errors.bio.message}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={loading || !isDirty}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors inline-flex items-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Save Changes
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Read-only info card ── */}
      {!isEditing && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Account Details</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                <div className="w-full border border-slate-100 bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-500 select-all">
                  {doctorData?.email ?? '—'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Role</label>
                <div className="w-full border border-slate-100 bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-500 capitalize">
                  {doctorData?.role ?? 'doctor'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">User ID</label>
                <div className="w-full border border-slate-100 bg-slate-50 rounded-xl px-4 py-2.5 text-xs text-slate-400 font-mono truncate select-all">
                  {doctorUser?.uid ?? '—'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Member Since</label>
                <div className="w-full border border-slate-100 bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-500">
                  {formatCreatedAt(doctorData?.createdAt)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
